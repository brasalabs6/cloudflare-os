// grok-computer-bridge/src/worker.ts
//
// Cloudflare Worker that hosts a Cloudflare Computer running Grok Build.
// This Worker:
//   1. Creates a Durable Object per workspace (isolated agent/container)
//   2. The DO manages a container running grok + bridge.mjs
//   3. Exposes an HTTP API that the cloudflare-os backend calls to:
//      - Send prompts to the grok agent (SSE streaming)
//      - Boot/configure the container (repos, dotfiles, credentials)
//      - Control the agent lifecycle (pause, resume, stop, reset)
//
// Architecture:
//
//   cloudflare-os (Overseer DO)
//       │  service binding fetch()
//       ▼
//   grok-computer-bridge Worker (this file)
//       │  authenticates every request at the Worker boundary
//       │  routes to a per-workspace DO via X-Grok-Workspace header
//       ▼
//   GrokComputer DO (one per workspace)
//   ├── container (Docker: Debian + Node + grok CLI + bridge.mjs)
//   │   ├── bridge.mjs (HTTP :8787, ACP → SSE)
//   │   ├── grok agent stdio (ACP JSON-RPC)
//   │   └── /workspace (FUSE mount from Computer VFS)
//   └── run state (SQLite DO storage)

import { DurableObject } from "cloudflare:workers";

// ─── Authentication at the Worker boundary ──────────────────────────────────
//
// Every request to this Worker must carry a valid Bearer token matching
// GROK_BRIDGE_API_KEY. This is the first line of defense: the Worker is
// reachable via its public URL AND via the service binding from the
// workshop backend. Without this check, anyone who discovers the URL
// could execute arbitrary shell commands, read/write the workspace, or
// consume xAI API credits.
//
// In dev mode (GROK_BRIDGE_API_KEY is empty), authentication is skipped.
// This must never be the case in production.

function authenticate(request: Request, env: Env): boolean {
  if (!env.GROK_BRIDGE_API_KEY) return true; // dev mode
  const auth = request.headers.get("Authorization") ?? "";
  return auth === `Bearer ${env.GROK_BRIDGE_API_KEY}`;
}

/** Returns a 401 response for unauthenticated requests. */
function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

// ─── Durable Object: GrokComputer ───────────────────────────────────────────
//
// One Durable Object per workspace. The DO ID is derived from the workspace
// ID passed by the Overseer, ensuring complete isolation between workspaces:
// different workspaces get different containers, different /workspace
// filesystems, and different grok agent sessions.

export class GrokComputer extends DurableObject<Env> {
  // Whether the container has been started and the bridge is ready.
  private started = false;

  // Hash of the last-applied boot config, for idempotency (M4).
  private bootConfigHash = "";

  /**
   * Ensures the container is running and the bridge is ready.
   * Uses the Cloudflare Containers API to start the container and
   * poll its health endpoint.
   */
  async ensureStarted(): Promise<void> {
    if (this.started) return;

    // The container is accessed via ctx.container. The Workers runtime
    // provides a fetch() interface to communicate with the container process.
    const container = (this.ctx as unknown as { container: { fetch: typeof fetch } }).container;
    if (!container) {
      throw new Error("No container binding found. Ensure the container is configured in wrangler.jsonc.");
    }

    // Wait for the container to be ready by polling /health.
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const response = await container.fetch("http://localhost:8787/health");
        if (response.ok) {
          this.started = true;
          return;
        }
      } catch {
        // Container not ready yet; retry after a short delay.
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error("Container failed to start within 30 seconds.");
  }

  /**
   * Makes an authenticated fetch to the bridge inside the container.
   */
  private async bridgeFetch(path: string, init: RequestInit = {}): Promise<Response> {
    await this.ensureStarted();
    const container = (this.ctx as unknown as { container: { fetch: typeof fetch } }).container;
    if (!container) throw new Error("No container binding.");

    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (this.env.GROK_BRIDGE_API_KEY) {
      headers.set("Authorization", `Bearer ${this.env.GROK_BRIDGE_API_KEY}`);
    }

    return container.fetch(`http://localhost:8787${path}`, {
      ...init,
      headers,
    });
  }

  /**
   * Sends a prompt to the grok agent and streams the response via SSE.
   */
  async prompt(prompt: string, alwaysApprove: boolean): Promise<ReadableStream<Uint8Array>> {
    const response = await this.bridgeFetch("/prompt", {
      method: "POST",
      body: JSON.stringify({ prompt, alwaysApprove }),
    });

    if (!response.ok) {
      throw new Error(`Bridge error: ${response.status} ${await response.text()}`);
    }

    return response.body as ReadableStream<Uint8Array>;
  }

  /**
   * Applies boot configuration to the container. Writes dotfiles, sets env
   * vars, clones repos, writes credentials, runs the boot script, and
   * restarts the grok agent.
   *
   * Idempotency (M4): if the config hash matches the last applied config,
   * the boot is skipped to avoid restarting the grok session and losing
   * context.
   */
  async boot(config: {
    githubRepos?: Array<{ url: string; branch?: string; path?: string; private?: boolean }>;
    dotfiles?: Array<{ path: string; content: string }>;
    envVars?: Array<{ key: string; value: string; secret?: boolean }>;
    credentials?: Array<{ type: string; name: string; value: string }>;
    bootScript?: string;
    grokModel?: string;
    autoApprove?: boolean;
  }): Promise<{ ok: boolean; grokSessionId: string }> {
    // Compute a hash of the config to check idempotency.
    const configHash = JSON.stringify(config);
    if (configHash === this.bootConfigHash && this.started) {
      // Config unchanged and container already running — skip boot.
      return { ok: true, grokSessionId: "" };
    }
    this.bootConfigHash = configHash;

    // Inject XAI_API_KEY into the container environment (H5).
    // The key is read from the Worker's env (set via `wrangler secret put`)
    // and passed to the container as an env var so the grok CLI can authenticate.
    const envVars = [...(config.envVars ?? [])];
    if (this.env.XAI_API_KEY) {
      envVars.push({ key: "XAI_API_KEY", value: this.env.XAI_API_KEY, secret: true });
    }

    const response = await this.bridgeFetch("/boot", {
      method: "POST",
      body: JSON.stringify({ ...config, envVars }),
    });

    if (!response.ok) {
      throw new Error(`Boot failed: ${response.status} ${await response.text()}`);
    }

    return response.json();
  }

  /**
   * Returns detailed status of the bridge and grok agent.
   */
  async status(): Promise<Record<string, unknown>> {
    const response = await this.bridgeFetch("/status");
    return response.json();
  }

  /**
   * Health check.
   */
  async health(): Promise<Record<string, unknown>> {
    const response = await this.bridgeFetch("/health");
    return response.json();
  }

  /**
   * Pauses the grok agent (SIGSTOP).
   */
  async pauseSession(): Promise<{ ok: boolean }> {
    const response = await this.bridgeFetch("/session/pause", { method: "POST" });
    return response.json();
  }

  /**
   * Resumes a paused grok agent (SIGCONT).
   */
  async resumeSession(): Promise<{ ok: boolean }> {
    const response = await this.bridgeFetch("/session/resume", { method: "POST" });
    return response.json();
  }

  /**
   * Stops and resets the grok agent session.
   */
  async resetSession(): Promise<{ ok: boolean }> {
    const response = await this.bridgeFetch("/session/reset", { method: "POST" });
    return response.json();
  }

  /**
   * Executes a shell command in the container workspace.
   * This is authenticated at the Worker boundary and only accessible
   * via the service binding from the Overseer.
   */
  async command(command: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    const response = await this.bridgeFetch("/command", {
      method: "POST",
      body: JSON.stringify({ command }),
    });
    return response.json();
  }
}

// ─── Worker Entrypoint ──────────────────────────────────────────────────────
//
// The Worker authenticates every incoming request at the boundary, then
// routes to the GrokComputer DO identified by the workspace ID (C2).
// The workspace ID is passed by the Overseer via the X-Grok-Workspace
// header — it is never derived from client-controllable input.

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // ── Authenticate at the Worker boundary (C1) ────────────────────────
    if (!authenticate(request, env)) {
      return unauthorized();
    }

    const url = new URL(request.url);

    // ── Workspace isolation (C2) ────────────────────────────────────────
    // Derive the DO ID from the X-Grok-Workspace header, which the Overseer
    // sets to its own ctx.id.toString(). This ensures each workspace gets
    // its own isolated DO/container/session. Never use a client-controllable
    // default.
    const workspaceId = request.headers.get("X-Grok-Workspace");
    if (!workspaceId) {
      return Response.json(
        { error: "X-Grok-Workspace header is required" },
        { status: 400 },
      );
    }

    const doId = env.GROK_COMPUTER.idFromName(workspaceId);
    const stub = env.GROK_COMPUTER.get(doId) as DurableObjectStub<GrokComputer>;

    // ── Route HTTP → DO methods ────────────────────────────────────────
    // All endpoints are authenticated at the Worker boundary (C1).

    if (request.method === "GET" && url.pathname === "/health") {
      const result = await stub.health();
      return Response.json(result);
    }

    if (request.method === "POST" && url.pathname === "/prompt") {
      const body = await request.json() as { prompt: string; alwaysApprove?: boolean };
      const stream = await stub.prompt(body.prompt, body.alwaysApprove ?? true);
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    if (request.method === "POST" && url.pathname === "/boot") {
      const body = await request.json() as Parameters<GrokComputer["boot"]>[0];
      const result = await stub.boot(body);
      return Response.json(result);
    }

    if (request.method === "GET" && url.pathname === "/status") {
      const result = await stub.status();
      return Response.json(result);
    }

    if (request.method === "POST" && url.pathname === "/session/pause") {
      const result = await stub.pauseSession();
      return Response.json(result);
    }

    if (request.method === "POST" && url.pathname === "/session/resume") {
      const result = await stub.resumeSession();
      return Response.json(result);
    }

    if (request.method === "POST" && url.pathname === "/session/reset") {
      const result = await stub.resetSession();
      return Response.json(result);
    }

    // Shell command execution (authenticated at the boundary).
    if (request.method === "POST" && url.pathname === "/command") {
      const body = await request.json() as { command: string };
      const result = await stub.command(body.command);
      return Response.json(result);
    }

    return Response.json({ error: "not found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
