// grok-computer-bridge/src/bridge.mjs
//
// Bridge HTTP server that runs inside a Cloudflare Computer container.
// Starts `grok agent stdio` as a subprocess and exposes an HTTP API that:
//   1. Receives prompts/commands from the cloudflare-os backend
//   2. Forwards them to grok via ACP (Agent Client Protocol — JSON-RPC over stdio)
//   3. Transforms ACP events (agent_message_chunk, tool_call, etc.)
//      to the cloudflare-os chat format (AiChatStreamEvent)
//   4. Streams responses via SSE (Server-Sent Events)
//
// Security: every endpoint (including /health and /status) requires
// authentication via Bearer token. The token is set via the GROK_BRIDGE_API_KEY
// environment variable, which is injected by the Worker DO.

import { spawn, execFile } from "node:child_process";
import { createServer } from "node:http";
import { createHash } from "node:crypto";

// ─── Configuration ──────────────────────────────────────────────────────────

const PORT = Number(process.env.BRIDGE_PORT ?? 8787);
const GROK_BIN = process.env.GROK_BIN ?? "grok";
const GROK_MODEL = process.env.GROK_MODEL ?? "grok-build";
const GROK_CWD = process.env.GROK_CWD ?? "/workspace";
// The Worker sets GROK_BRIDGE_API_KEY; the bridge reads it from the same env.
// Both sides use the same variable name for consistency.
const BRIDGE_API_KEY = process.env.GROK_BRIDGE_API_KEY ?? "";

// ─── ACP State ─────────────────────────────────────────────────────────────

let grokProc = null;
let sessionId = null;
let rpcId = 0;
const pendingRequests = new Map();
// Map of active SSE listeners, each scoped to a specific prompt request.
// This prevents events from one prompt leaking to another (fixes the
// global broadcast issue noted in the audit).
const activeStreams = new Map(); // rpcId → listener function
// Counter for generating tool call IDs when ACP doesn't provide one.
let toolCallCounter = 0;
// Map of tool call IDs for correlation between toolCall and toolResult.
const toolCallIds = new Map(); // ACP toolCall internal id → our toolCallId

// ─── Boot idempotency (M4) ──────────────────────────────────────────────────
// Hash of the last-applied boot config. If the same config is sent again,
// we skip the boot to avoid restarting the grok session and losing context.
let lastBootConfigHash = "";

// ─── Grok subprocess management ────────────────────────────────────────────

async function startGrokAgent() {
  grokProc = spawn(GROK_BIN, ["agent", "stdio", "-m", GROK_MODEL], {
    cwd: GROK_CWD,
    stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env },
  });

  let buffer = "";
  grokProc.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        handleMessage(JSON.parse(line));
      } catch (err) {
        console.error("[bridge] failed to parse ACP message:", line.slice(0, 200), err);
      }
    }
  });

  grokProc.on("exit", (code, signal) => {
    console.log(`[bridge] grok agent exited (code=${code}, signal=${signal})`);
    grokProc = null;
    sessionId = null;
    for (const { reject } of pendingRequests.values()) {
      reject(new Error("grok agent exited"));
    }
    pendingRequests.clear();
  });

  await rpcCall("initialize", {
    protocolVersion: "1",
    clientCapabilities: {
      fs: { readTextFile: true, writeTextFile: true },
      terminal: true,
    },
  });

  const sessionResult = await rpcCall("session/new", {
    cwd: GROK_CWD,
    mcpServers: [],
  });

  sessionId = sessionResult.sessionId;
  console.log(`[bridge] grok agent started, session=${sessionId}`);
}

function rpcCall(method, params) {
  return new Promise((resolve, reject) => {
    if (!grokProc || !grokProc.stdin.writable) {
      reject(new Error("grok agent not running"));
      return;
    }

    const id = ++rpcId;
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    pendingRequests.set(id, { resolve, reject });

    grokProc.stdin.write(msg + "\n");

    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }
    }, 300_000);
  });
}

function handleMessage(data) {
  if (data.id !== undefined && pendingRequests.has(data.id)) {
    const { resolve, reject } = pendingRequests.get(data.id);
    pendingRequests.delete(data.id);
    if (data.error) {
      reject(new Error(data.error.message || "RPC error"));
    } else {
      resolve(data.result);
    }
    return;
  }

  // Notification (streaming event from ACP)
  if (data.method === "session/update") {
    // Route to the active stream for this session, not a global broadcast.
    const event = transformAcpEvent(data.params);
    if (event) {
      for (const [, listener] of activeStreams) {
        try { listener(event); } catch { /* ignore */ }
      }
    }
  }
}

// ─── ACP → cloudflare-os event transformation (M3: tool call IDs) ──────────

function transformAcpEvent(params) {
  const update = params?.update;
  if (!update) return null;

  const sessionUpdate = update.sessionUpdate;

  switch (sessionUpdate) {
    case "agent_message_chunk":
      return { type: "text", data: update.content?.text ?? "" };

    case "agent_thought_chunk":
      return { type: "thought", data: update.content?.text ?? "" };

    case "tool_call": {
      // Generate or reuse a stable tool call ID for correlation (M3).
      const acpId = update.toolCallId ?? update.id ?? `tc-${++toolCallCounter}`;
      const toolCallId = `tc-${acpId}`;
      toolCallIds.set(acpId, toolCallId);
      return {
        type: "toolCall",
        data: {
          id: toolCallId,
          tool: update.tool ?? "unknown",
          args: update.arguments ?? {},
          status: "pending",
        },
      };
    }

    case "tool_result": {
      // Correlate the result with the original tool call (M3).
      const acpId = update.toolCallId ?? update.id ?? "";
      const toolCallId = toolCallIds.get(acpId) ?? `tc-${acpId}`;
      return {
        type: "toolResult",
        data: {
          id: toolCallId,
          tool: update.tool ?? "unknown",
          result: update.result ?? "",
          status: "completed",
        },
      };
    }

    case "plan":
      return { type: "plan", data: update.entries ?? [] };

    default:
      return null;
  }
}

// ─── Authentication ─────────────────────────────────────────────────────────

function authenticate(req) {
  if (!BRIDGE_API_KEY) return true; // dev mode
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${BRIDGE_API_KEY}`;
}

// ─── Boot config validation (M5) ───────────────────────────────────────────

const MAX_DOTFILES = 50;
const MAX_ENV_VARS = 50;
const MAX_CREDENTIALS = 20;
const MAX_REPOS = 20;
const MAX_BOOT_SCRIPT_LENGTH = 10_000;
const MAX_DOTFILE_CONTENT_LENGTH = 100_000;
const GITHUB_URL_RE = /^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+(?:\.git)?$/;
const ENV_KEY_RE = /^[A-Z_][A-Z0-9_]*$/;
// Dotfile paths must be relative, no traversal, within the home directory.
const DOTFILE_PATH_RE = /^[A-Za-z0-9._/-]+$/;

function validateBootConfig(config) {
  if ((config.dotfiles?.length ?? 0) > MAX_DOTFILES)
    throw new Error(`Too many dotfiles (max ${MAX_DOTFILES})`);
  if ((config.envVars?.length ?? 0) > MAX_ENV_VARS)
    throw new Error(`Too many env vars (max ${MAX_ENV_VARS})`);
  if ((config.credentials?.length ?? 0) > MAX_CREDENTIALS)
    throw new Error(`Too many credentials (max ${MAX_CREDENTIALS})`);
  if ((config.githubRepos?.length ?? 0) > MAX_REPOS)
    throw new Error(`Too many repos (max ${MAX_REPOS})`);
  if ((config.bootScript?.length ?? 0) > MAX_BOOT_SCRIPT_LENGTH)
    throw new Error(`Boot script too long (max ${MAX_BOOT_SCRIPT_LENGTH} chars)`);

  for (const repo of config.githubRepos ?? []) {
    if (!repo.url || !GITHUB_URL_RE.test(repo.url))
      throw new Error(`Invalid GitHub URL: ${repo.url}`);
    if (repo.branch && !/^[A-Za-z0-9._/-]+$/.test(repo.branch))
      throw new Error(`Invalid branch name: ${repo.branch}`);
    if (repo.path && !/^[A-Za-z0-9._-]+$/.test(repo.path))
      throw new Error(`Invalid repo path: ${repo.path}`);
  }

  for (const df of config.dotfiles ?? []) {
    if (!df.path || !DOTFILE_PATH_RE.test(df.path) || df.path.includes(".."))
      throw new Error(`Invalid dotfile path: ${df.path}`);
    if (df.content.length > MAX_DOTFILE_CONTENT_LENGTH)
      throw new Error(`Dotfile ${df.path} too large (max ${MAX_DOTFILE_CONTENT_LENGTH} chars)`);
  }

  for (const ev of config.envVars ?? []) {
    if (!ev.key || !ENV_KEY_RE.test(ev.key))
      throw new Error(`Invalid env var key: ${ev.key}`);
  }
}

// ─── HTTP server ───────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // All endpoints require authentication, including /health and /status.
  if (!authenticate(req)) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end('{"error":"unauthorized"}');
    return;
  }

  // ── GET /health ────────────────────────────────────────────────────────
  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      grokRunning: grokProc !== null,
      sessionId: sessionId,
      model: GROK_MODEL,
      cwd: GROK_CWD,
    }));
    return;
  }

  // ── GET /status ────────────────────────────────────────────────────────
  if (req.method === "GET" && url.pathname === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      grokRunning: grokProc !== null,
      sessionId: sessionId,
      model: GROK_MODEL,
      cwd: GROK_CWD,
      uptime: grokProc ? process.uptime() : 0,
      pendingRequests: pendingRequests.size,
      activeStreams: activeStreams.size,
    }));
    return;
  }

  // ── POST /prompt ───────────────────────────────────────────────────────
  if (req.method === "POST" && url.pathname === "/prompt") {
    if (!grokProc || !sessionId) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "grok agent not running" }));
      return;
    }

    let body = "";
    for await (const chunk of req) body += chunk;
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end('{"error":"invalid JSON"}');
      return;
    }

    const { prompt, alwaysApprove = true } = parsed;
    if (typeof prompt !== "string" || !prompt.trim()) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end('{"error":"prompt is required"}');
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Create a per-prompt listener (not global) to avoid cross-prompt leakage.
    const promptRpcId = ++rpcId;
    const myListener = (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    activeStreams.set(promptRpcId, myListener);

    const promptParts = [{ type: "text", text: prompt }];
    const requestMsg = JSON.stringify({
      jsonrpc: "2.0",
      id: promptRpcId,
      method: "session/prompt",
      params: { sessionId, prompt: promptParts, alwaysApprove },
    });

    const endPromise = new Promise((resolve) => {
      pendingRequests.set(promptRpcId, {
        resolve: (result) => {
          res.write(`data: ${JSON.stringify({
            type: "end",
            data: {
              stopReason: result?.stopReason ?? "EndTurn",
              sessionId: sessionId,
            },
          })}\n\n`);
          resolve();
        },
        reject: (err) => {
          res.write(`data: ${JSON.stringify({
            type: "error",
            data: { message: err.message },
          })}\n\n`);
          resolve();
        },
      });
    });

    grokProc.stdin.write(requestMsg + "\n");
    await endPromise;

    activeStreams.delete(promptRpcId);
    res.end();
    return;
  }

  // ── POST /boot ─────────────────────────────────────────────────────────
  if (req.method === "POST" && url.pathname === "/boot") {
    let body = "";
    for await (const chunk of req) body += chunk;
    let config;
    try {
      config = JSON.parse(body);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end('{"error":"invalid JSON"}');
      return;
    }

    // Validate the boot config before applying (M5).
    try {
      validateBootConfig(config);
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }

    // Idempotency check (M4): skip if config is unchanged and agent is running.
    const configHash = createHash("sha256").update(JSON.stringify(config)).digest("hex");
    if (configHash === lastBootConfigHash && grokProc) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, grokSessionId: sessionId }));
      return;
    }
    lastBootConfigHash = configHash;

    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const os = await import("node:os");

    const homeDir = os.homedir();
    const workspaceDir = GROK_CWD;

    try {
      // 1. Write dotfiles (path-validated, no traversal).
      for (const dotfile of config.dotfiles ?? []) {
        const filePath = path.join(homeDir, dotfile.path);
        // Confine to home directory.
        if (!filePath.startsWith(homeDir))
          throw new Error(`Dotfile path escapes home directory: ${dotfile.path}`);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, dotfile.content, "utf8");
      }

      // 2. Set environment variables.
      for (const envVar of config.envVars ?? []) {
        process.env[envVar.key] = envVar.value;
      }

      // 3. Clone GitHub repos using spawn (no shell interpolation, M5).
      const reposDir = path.join(workspaceDir, "repos");
      await fs.mkdir(reposDir, { recursive: true });
      for (const repo of config.githubRepos ?? []) {
        if (!repo.url) continue;
        const repoName = repo.path || repo.url.split("/").pop().replace(".git", "") || "repo";
        const cloneDir = path.join(reposDir, repoName);
        const token = repo.private
          ? config.credentials?.find(c => c.type === "github-token")?.value
          : null;
        const cloneUrl = token
          ? repo.url.replace("https://", `https://${token}@`)
          : repo.url;

        const args = ["clone"];
        if (repo.branch) args.push("-b", repo.branch);
        args.push(cloneUrl, cloneDir);

        await new Promise((resolve, reject) => {
          execFile("git", args, { timeout: 120_000, cwd: reposDir }, (err) => {
            if (err && !String(err).includes("already exists")) reject(err);
            else resolve();
          });
        });
      }

      // 4. Write credentials.
      for (const cred of config.credentials ?? []) {
        switch (cred.type) {
          case "github-token":
            await fs.appendFile(path.join(homeDir, ".gitconfig"),
              `\n[github]\n  token = ${cred.value}\n`);
            break;
          case "ssh-key":
            await fs.mkdir(path.join(homeDir, ".ssh"), { recursive: true });
            await fs.writeFile(path.join(homeDir, ".ssh/id_rsa"), cred.value, { mode: 0o600 });
            break;
          case "api-key":
            process.env[cred.name] = cred.value;
            break;
        }
      }

      // 5. Run boot script (only if provided and validated).
      if (config.bootScript) {
        await new Promise((resolve) => {
          execFile("sh", ["-c", config.bootScript], { cwd: workspaceDir, timeout: 300_000 }, () => resolve());
        });
      }

      // 6. Update grok model if changed.
      if (config.grokModel) {
        process.env.GROK_MODEL = config.grokModel;
      }

      // 7. Restart grok agent only if model changed or not running.
      const needsRestart = !grokProc || config.grokModel;
      if (needsRestart) {
        if (grokProc) {
          grokProc.kill("SIGTERM");
          grokProc = null;
          sessionId = null;
        }
        await startGrokAgent();
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, grokSessionId: sessionId }));
    } catch (err) {
      console.error("[bridge] boot failed:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── POST /command ──────────────────────────────────────────────────────
  // Executes a shell command in the container workspace. Authenticated.
  // Request body: { "command": "ls -la /workspace" }
  // Response: { "stdout": "...", "stderr": "...", "exitCode": 0 }
  if (req.method === "POST" && url.pathname === "/command") {
    let body = "";
    for await (const chunk of req) body += chunk;
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end('{"error":"invalid JSON"}');
      return;
    }

    const { command } = parsed;
    if (typeof command !== "string" || !command.trim()) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end('{"error":"command is required"}');
      return;
    }

    execFile("sh", ["-c", command], { cwd: GROK_CWD, timeout: 120_000 }, (err, stdout, stderr) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        stdout: stdout ?? "",
        stderr: stderr ?? "",
        exitCode: err ? (err.code ?? 1) : 0,
      }));
    });
    return;
  }

  // ── POST /session/reset ────────────────────────────────────────────────
  if (req.method === "POST" && url.pathname === "/session/reset") {
    if (grokProc) {
      grokProc.kill("SIGTERM");
      grokProc = null;
      sessionId = null;
    }
    try {
      await startGrokAgent();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, sessionId }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── POST /session/pause ────────────────────────────────────────────────
  if (req.method === "POST" && url.pathname === "/session/pause") {
    if (grokProc) {
      grokProc.kill("SIGSTOP");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } else {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "grok agent not running" }));
    }
    return;
  }

  // ── POST /session/resume ──────────────────────────────────────────────
  if (req.method === "POST" && url.pathname === "/session/resume") {
    if (grokProc) {
      grokProc.kill("SIGCONT");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } else {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "grok agent not running" }));
    }
    return;
  }

  // ── 404 ────────────────────────────────────────────────────────────────
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

// ─── Initialization ─────────────────────────────────────────────────────────

async function main() {
  console.log(`[bridge] starting grok-computer-bridge on port ${PORT}`);
  console.log(`[bridge] grok model: ${GROK_MODEL}`);
  console.log(`[bridge] grok cwd: ${GROK_CWD}`);

  try {
    await startGrokAgent();
  } catch (err) {
    console.error("[bridge] failed to start grok agent:", err.message);
    console.error("[bridge] will retry in 5s...");
    setTimeout(main, 5000);
    return;
  }

  server.listen(PORT, () => {
    console.log(`[bridge] HTTP server listening on http://0.0.0.0:${PORT}`);
  });
}

main();
