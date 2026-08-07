// grok-computer-bridge/src/bridge.mjs
//
// Bridge HTTP server que roda dentro de um Cloudflare Computer (container backend).
// Inicia `grok agent stdio` como subprocesso e expõe uma API HTTP que:
//   1. Recebe prompts/comandos do cloudflare-os backend
//   2. Encaminha para o grok via ACP (Agent Client Protocol — JSON-RPC over stdio)
//   3. Transforma os eventos ACP (agent_message_chunk, tool_call, plan, etc.)
//      para o formato de chat do cloudflare-os (AiChatStreamEvent)
//   4. Faz streaming das respostas via SSE (Server-Sent Events)
//
// Arquitetura:
//
//   cloudflare-os backend (Worker)
//       │  POST /prompt  (SSE response)
//       ▼
//   ┌─────────────────────────────────┐
//   │  grok-bridge.mjs (HTTP server)  │  ← roda dentro do Computer container
//   │    │                             │
//   │    ├── stdin  → grok agent stdio  │  (ACP JSON-RPC)
//   │    ├── stdout ← grok agent stdio  │  (ACP events → SSE)
//   │    └── /workspace (VFS do Computer)│
//   └─────────────────────────────────┘
//
// O grok opera no /workspace do container, que é o filesystem virtual do
// Cloudflare Computer (SQLite-backed, persistente entre execuções). O agente
// pode ler, escrever e executar código nesse filesystem como se fosse um
// computador real.

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

// ─── Configuração ───────────────────────────────────────────────────────────

const PORT = Number(process.env.BRIDGE_PORT ?? 8787);
const GROK_BIN = process.env.GROK_BIN ?? "grok";
const GROK_MODEL = process.env.GROK_MODEL ?? "grok-build";
// Diretório de trabalho do grok dentro do container (VFS do Computer)
const GROK_CWD = process.env.GROK_CWD ?? "/workspace";
// Chave de API para autenticar requests ao bridge (opcional)
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY ?? "";

// ─── Estado do ACP ───────────────────────────────────────────────────────────

// Um processo `grok agent stdio` persistente. O ACP mantém sessão e contexto
// entre prompts, então reusamos o mesmo processo.
let grokProc = null;
let sessionId = null;
let rpcId = 0;
const pendingRequests = new Map(); // rpcId → { resolve, reject }
const eventListeners = new Set();  // SSE streams ativos

// ─── Gerenciamento do subprocesso grok ──────────────────────────────────────

/**
 * Inicia o processo `grok agent stdio` e faz o handshake ACP (initialize +
 * session/new). O processo persiste para manter o contexto da conversa.
 */
async function startGrokAgent() {
  grokProc = spawn(GROK_BIN, ["agent", "stdio", "-m", GROK_MODEL], {
    cwd: GROK_CWD,
    stdio: ["pipe", "pipe", "inherit"],
    env: {
      ...process.env,
      // O grok precisa de autenticação. Em um container sem browser,
      // usamos XAI_API_KEY (ou auth_provider_command configurado).
      // O cloudflare-os pode injetar a chave via env do container.
    },
  });

  // Parser de linhas JSON-RPC vindas do stdout do grok.
  // Cada linha é um message JSON-RPC:要么 uma response (com "result" ou "error"
  // e um "id" correspondente a um request pendente), ou uma notification
  // (com "method" e sem "id").
  let buffer = "";
  grokProc.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop(); // última linha incompleta fica no buffer

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
    // Rejeita todos os requests pendentes
    for (const { reject } of pendingRequests.values()) {
      reject(new Error("grok agent exited"));
    }
    pendingRequests.clear();
  });

  // Handshake ACP: initialize → session/new
  const initResult = await rpcCall("initialize", {
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

/**
 * Envia um request JSON-RPC para o grok e retorna a resposta.
 * Usa o padrão request-response: cada request tem um ID único, e a response
 * correspondente é identificada pelo mesmo ID.
 */
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

    // Timeout: se o grok não responder em 5 minutos, rejeita
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }
    }, 300_000);
  });
}

/**
 * Processa uma mensagem JSON-RPC recebida do grok.
 * - Response (tem "id"): resolve o request pendente correspondente.
 * - Notification (tem "method", sem "id"): encaminha para os SSE listeners.
 */
function handleMessage(data) {
  // Response para um request nosso
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

  // Notification (evento de streaming do ACP)
  if (data.method === "session/update") {
    broadcastEvent(transformAcpEvent(data.params));
  }
}

// ─── Transformação ACP → cloudflare-os ─────────────────────────────────────

/**
 * Transforma um evento ACP (Agent Client Protocol) para o formato
 * AiChatStreamEvent do cloudflare-os.
 *
 * Eventos ACP possíveis (session/update com sessionUpdate):
 *   - agent_message_chunk:  texto da resposta do agente
 *   - agent_thought_chunk:   reasoning/pensamento do modelo
 *   - tool_call:             chamada de ferramenta (bash, edit, search, etc.)
 *   - tool_result:           resultado de uma tool call
 *   - plan:                  plano estruturado do agente
 *
 * O cloudflare-os espera eventos no formato:
 *   { type: "text" | "thought" | "toolCall" | "toolResult" | "plan" | "end",
 *     data: ... }
 */
function transformAcpEvent(params) {
  const update = params?.update;
  if (!update) return null;

  const sessionUpdate = update.sessionUpdate;

  switch (sessionUpdate) {
    case "agent_message_chunk":
      // Texto da resposta do agente — streaming token a token.
      // No cloudflare-os, isso vira um evento "text" com o delta.
      return {
        type: "text",
        data: update.content?.text ?? "",
      };

    case "agent_thought_chunk":
      // Reasoning do modelo (chain-of-thought). O cloudflare-os mostra
      // isso em um painel colapsável de "thinking".
      return {
        type: "thought",
        data: update.content?.text ?? "",
      };

    case "tool_call":
      // O agente está chamando uma ferramenta (bash, edit_file, search, etc.)
      // Transformamos para o formato que o cloudflare-os usa para renderizar
      // tool calls no chat.
      return {
        type: "toolCall",
        data: {
          tool: update.tool ?? "unknown",
          args: update.arguments ?? {},
          status: "pending",
        },
      };

    case "tool_result":
      // Resultado da execução de uma tool.
      return {
        type: "toolResult",
        data: {
          tool: update.tool ?? "unknown",
          result: update.result ?? "",
          status: "completed",
        },
      };

    case "plan":
      // Plano estruturado do agente (plan mode).
      return {
        type: "plan",
        data: update.entries ?? [],
      };

    default:
      // Eventos desconhecidos são ignorados (não quebram o stream).
      return null;
  }
}

/**
 * Encaminha um evento transformado para todos os SSE listeners ativos.
 * Cada listener é um response stream de um POST /prompt em andamento.
 */
function broadcastEvent(event) {
  if (!event) return;
  for (const listener of eventListeners) {
    try {
      listener(event);
    } catch {
      eventListeners.delete(listener);
    }
  }
}

// ─── Servidor HTTP ──────────────────────────────────────────────────────────

/**
 * Autentica o request comparando o Bearer token com BRIDGE_API_KEY.
 * Se BRIDGE_API_KEY está vazio, aceita qualquer request (modo dev).
 */
function authenticate(req) {
  if (!BRIDGE_API_KEY) return true;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${BRIDGE_API_KEY}`;
}

/**
 * Cria o servidor HTTP com os endpoints do bridge.
 */
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ── GET /health ─────────────────────────────────────────────────────────
  // Health check simples. Retorna o estado do grok agent.
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

  // ── POST /prompt ────────────────────────────────────────────────────────
  // Envia um prompt para o grok agent e faz streaming da resposta via SSE.
  //
  // Request body: { "prompt": "string", "alwaysApprove": true }
  // Response: text/event-stream com eventos transformados (um por linha):
  //   data: {"type":"text","data":"Here's"}\n\n
  //   data: {"type":"text","data":" a summary"}\n\n
  //   data: {"type":"thought","data":"Analyzing..."}\n\n
  //   data: {"type":"toolCall","data":{"tool":"bash","args":{"command":"ls"}}}\n\n
  //   data: {"type":"end","data":{"stopReason":"EndTurn","sessionId":"..."}}\n\n
  if (req.method === "POST" && url.pathname === "/prompt") {
    if (!authenticate(req)) {
      res.writeHead(401);
      res.end('{"error":"unauthorized"}');
      return;
    }

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
      res.writeHead(400);
      res.end('{"error":"invalid JSON"}');
      return;
    }

    const { prompt, alwaysApprove = true } = parsed;
    if (typeof prompt !== "string" || !prompt.trim()) {
      res.writeHead(400);
      res.end('{"error":"prompt is required"}');
      return;
    }

    // Inicia SSE stream
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Registra um listener para receber eventos ACP transformados
    // e encaminhá-los como SSE.
    const myListener = (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    eventListeners.add(myListener);

    // Envia o prompt para o grok via ACP
    const promptParts = [{ type: "text", text: prompt }];
    const requestMsg = JSON.stringify({
      jsonrpc: "2.0",
      id: ++rpcId,
      method: "session/prompt",
      params: { sessionId, prompt: promptParts },
    });

    // Quando o grok envia a response final (result), enviamos o evento "end"
    // e fechamos o stream.
    const endPromise = new Promise((resolve) => {
      pendingRequests.set(rpcId, {
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

    // Aguarda a resposta final
    await endPromise;

    // Cleanup
    eventListeners.delete(myListener);
    res.end();
    return;
  }

  // ── POST /command ──────────────────────────────────────────────────────
  // Envia um comando shell direto para o workspace do Computer (não passa
  // pelo grok — executa diretamente no container). Útil para inspecionar
  // arquivos, rodar testes, etc.
  //
  // Request body: { "command": "ls -la /workspace" }
  // Response: { "stdout": "...", "stderr": "...", "exitCode": 0 }
  if (req.method === "POST" && url.pathname === "/command") {
    if (!authenticate(req)) {
      res.writeHead(401);
      res.end('{"error":"unauthorized"}');
      return;
    }

    let body = "";
    for await (const chunk of req) body += chunk;
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400);
      res.end('{"error":"invalid JSON"}');
      return;
    }

    const { command } = parsed;
    if (typeof command !== "string" || !command.trim()) {
      res.writeHead(400);
      res.end('{"error":"command is required"}');
      return;
    }

    // Executa o comando no container (não no grok — direto no shell)
    const { exec } = await import("node:child_process");
    exec(command, { cwd: GROK_CWD, timeout: 120_000 }, (err, stdout, stderr) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        stdout: stdout ?? "",
        stderr: stderr ?? "",
        exitCode: err ? (err.code ?? 1) : 0,
      }));
    });
    return;
  }

  // ── POST /session/reset ─────────────────────────────────────────────────
  // Reinicia a sessão do grok (limpa o contexto da conversa).
  if (req.method === "POST" && url.pathname === "/session/reset") {
    if (!authenticate(req)) {
      res.writeHead(401);
      res.end('{"error":"unauthorized"}');
      return;
    }

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

  // ── POST /boot ──────────────────────────────────────────────────────────
  // Applies boot configuration to the Computer container:
  //   1. Writes dotfiles to ~/ (e.g. .bashrc, .gitconfig, .grok/config.toml)
  //   2. Sets environment variables for the grok process
  //   3. Clones GitHub repos into /workspace/repos/
  //   4. Writes credentials (git tokens, SSH keys, API keys)
  //   5. Runs the boot script (if provided)
  //   6. Restarts the grok agent with the new configuration
  //
  // Request body: { githubRepos, dotfiles, envVars, credentials, bootScript, grokModel, autoApprove }
  // Response: { ok: true, grokSessionId: "..." }
  if (req.method === "POST" && url.pathname === "/boot") {
    if (!authenticate(req)) {
      res.writeHead(401);
      res.end('{"error":"unauthorized"}');
      return;
    }

    let body = "";
    for await (const chunk of req) body += chunk;
    let config;
    try {
      config = JSON.parse(body);
    } catch {
      res.writeHead(400);
      res.end('{"error":"invalid JSON"}');
      return;
    }

    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const os = await import("node:os");
    const { exec } = await import("node:child_process");

    const homeDir = os.homedir();
    const workspaceDir = GROK_CWD;

    try {
      // 1. Write dotfiles to the container's home directory
      for (const dotfile of config.dotfiles ?? []) {
        const filePath = path.join(homeDir, dotfile.path);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, dotfile.content, "utf8");
      }

      // 2. Set environment variables (inherited by the restarted grok process)
      for (const envVar of config.envVars ?? []) {
        process.env[envVar.key] = envVar.value;
      }

      // 3. Clone GitHub repos into /workspace/repos/
      const reposDir = path.join(workspaceDir, "repos");
      await fs.mkdir(reposDir, { recursive: true });
      for (const repo of config.githubRepos ?? []) {
        if (!repo.url) continue;
        const repoName = repo.path || repo.url.split("/").pop()?.replace(".git", "") || "repo";
        const cloneDir = path.join(reposDir, repoName);
        const branchFlag = repo.branch ? ` -b ${repo.branch}` : "";
        const token = repo.private
          ? config.credentials?.find(c => c.type === "github-token")?.value
          : null;
        const cloneUrl = token
          ? repo.url.replace("https://", `https://${token}@`)
          : repo.url;

        await new Promise((resolve, reject) => {
          exec(`git clone ${branchFlag} ${cloneUrl} ${cloneDir}`,
            { timeout: 120_000 }, (err) => {
              if (err && !String(err).includes("already exists")) reject(err);
              else resolve();
            });
        });
      }

      // 4. Write credentials
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

      // 5. Run boot script (after repos cloned, dotfiles written, env set)
      if (config.bootScript) {
        await new Promise((resolve) => {
          exec(config.bootScript, { cwd: workspaceDir, timeout: 300_000 }, () => resolve());
        });
      }

      // 6. Restart grok agent with new model/config
      if (grokProc) {
        grokProc.kill("SIGTERM");
        grokProc = null;
        sessionId = null;
      }

      if (config.grokModel) {
        process.env.GROK_MODEL = config.grokModel;
      }

      await startGrokAgent();

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, grokSessionId: sessionId }));
    } catch (err) {
      console.error("[bridge] boot failed:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── GET /status ──────────────────────────────────────────────────────────
  // Returns detailed status of the bridge and grok agent, including uptime and
  // active connection metrics. Used by the Overseer for run status reporting.
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
      eventListeners: eventListeners.size,
    }));
    return;
  }

  // ── POST /session/pause ─────────────────────────────────────────────────
  // Pauses the grok agent by sending SIGSTOP to the process. The process stays
  // alive but is suspended. Use /session/resume to continue.
  if (req.method === "POST" && url.pathname === "/session/pause") {
    if (!authenticate(req)) {
      res.writeHead(401);
      res.end('{"error":"unauthorized"}');
      return;
    }
    if (grokProc) {
      grokProc.kill("SIGSTOP");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, message: "grok agent paused" }));
    } else {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "grok agent not running" }));
    }
    return;
  }

  // ── POST /session/resume ────────────────────────────────────────────────
  // Resumes a paused grok agent by sending SIGCONT.
  if (req.method === "POST" && url.pathname === "/session/resume") {
    if (!authenticate(req)) {
      res.writeHead(401);
      res.end('{"error":"unauthorized"}');
      return;
    }
    if (grokProc) {
      grokProc.kill("SIGCONT");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, message: "grok agent resumed" }));
    } else {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "grok agent not running" }));
    }
    return;
  }

  // ── 404 ─────────────────────────────────────────────────────────────────
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

// ─── Inicialização ──────────────────────────────────────────────────────────

async function main() {
  console.log(`[bridge] starting grok-computer-bridge on port ${PORT}`);
  console.log(`[bridge] grok model: ${GROK_MODEL}`);
  console.log(`[bridge] grok cwd: ${GROK_CWD}`);

  // Inicia o grok agent
  try {
    await startGrokAgent();
  } catch (err) {
    console.error("[bridge] failed to start grok agent:", err.message);
    console.error("[bridge] will retry in 5s...");
    setTimeout(main, 5000);
    return;
  }

  // Inicia o servidor HTTP
  server.listen(PORT, () => {
    console.log(`[bridge] HTTP server listening on http://0.0.0.0:${PORT}`);
    console.log(`[bridge] endpoints:`);
    console.log(`[bridge]   GET  /health         — health check`);
    console.log(`[bridge]   POST /prompt         — send prompt (SSE stream)`);
    console.log(`[bridge]   POST /command        — run shell command`);
    console.log(`[bridge]   POST /session/reset  — reset grok session`);
  });
}

main();
