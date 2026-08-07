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
//
// Container communication uses the low-level DurableObject Container API:
//   - this.ctx.container.start() to boot the container
//   - this.ctx.container.getTcpPort(8787).fetch() to send HTTP requests
//   - this.ctx.container.running to check if the container is running

import { DurableObject } from "cloudflare:workers";

// ─── Low-level Container API types ──────────────────────────────────────────
//
// The Cloudflare Workers runtime provides a `container` property on
// `DurableObjectState` when a container binding is configured in
// wrangler.jsonc. The type is not in @cloudflare/workers-types yet, so
// we define it here.

interface ContainerStartOptions {
  env?: Record<string, string>;
  entrypoint?: string[];
  enableInternet?: boolean;
}

interface TcpPort {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
}

interface ContainerHandle {
  running: boolean;
  start(options?: ContainerStartOptions): void;
  getTcpPort(port: number): TcpPort;
  destroy(error?: string): Promise<void>;
  signal(signal: number): void;
  monitor(): Promise<void>;
}

// Type assertion to access the container API on DurableObjectState.
function getContainer(ctx: DurableObjectState): ContainerHandle | null {
  const c = (ctx as unknown as { container?: ContainerHandle }).container;
  return c ?? null;
}

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

  /**
   * Ensures the container is running and the bridge is ready.
   *
   * Uses the low-level Container API:
   *   1. Calls this.ctx.container.start() to boot the container process
   *   2. Polls the /health endpoint via getTcpPort(8787).fetch() until ready
   *
   * The container needs time to cold-start (pull image, run entrypoint,
   * start bridge.mjs). The bridge starts its HTTP server before the grok
   * agent, so /health responds quickly even if the agent is still starting.
   */
  async ensureStarted(): Promise<void> {
    if (this.started) return;

    const container = getContainer(this.ctx);
    if (!container) {
      throw new Error(
        "No container binding found. Ensure the container is configured in wrangler.jsonc.",
      );
    }

    // Start the container if it's not already running.
    // start() does not block until the container is ready — it just
    // initiates the boot process. We poll /health afterwards.
    if (!container.running) {
      container.start({
        env: {
          // Pass XAI_API_KEY to the container so the grok CLI can authenticate.
          ...(this.env.XAI_API_KEY ? { XAI_API_KEY: this.env.XAI_API_KEY } : {}),
          // Pass GROK_BRIDGE_API_KEY so the bridge can authenticate requests.
          ...(this.env.GROK_BRIDGE_API_KEY
            ? { GROK_BRIDGE_API_KEY: this.env.GROK_BRIDGE_API_KEY }
            : {}),
          // Default model for the grok agent.
          GROK_MODEL: this.env.GROK_MODEL ?? "grok-build",
        },
        enableInternet: true,
      });
    }

    // Get the TCP port for the bridge HTTP server (port 8787).
    const port = container.getTcpPort(8787);

    // Poll /health until the bridge is ready.
    // 60 attempts × 1s = 60s max. The bridge starts its HTTP server
    // before the grok agent, so /health responds quickly.
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        const response = await port.fetch("http://localhost:8787/health");
        if (response.ok) {
          this.started = true;
          console.log("[grok-computer] container is ready");
          return;
        }
      } catch {
        // Container not ready yet; retry after a short delay.
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(
      "Container failed to start within 60 seconds. Check container logs in the Cloudflare dashboard.",
    );
  }

  /**
   * Handles incoming HTTP requests by proxying them to the bridge
   * inside the container. The container is started on first request
   * and the health endpoint is polled before forwarding.
   */
  override async fetch(request: Request): Promise<Response> {
    await this.ensureStarted();

    const container = getContainer(this.ctx);
    if (!container) throw new Error("No container binding.");

    const port = container.getTcpPort(8787);
    const url = new URL(request.url);

    // Build headers for the bridge request. Copy original headers and
    // add the bridge auth token for defense in depth.
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    if (this.env.GROK_BRIDGE_API_KEY) {
      headers.set("Authorization", `Bearer ${this.env.GROK_BRIDGE_API_KEY}`);
    }

    // Proxy the request to the bridge inside the container.
    // The bridge (bridge.mjs) handles all routing: /health, /prompt,
    // /boot, /status, /session/*, /command.
    return port.fetch(`http://localhost:8787${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    });
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

    // Proxy the request to the DO. The DO's fetch() method handles
    // container startup, health checking, and request forwarding.
    return stub.fetch(request);
  },
} satisfies ExportedHandler<Env>;
