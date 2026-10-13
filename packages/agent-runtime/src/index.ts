import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";
import { GrokAcpPeer } from "./grok-acp.mjs";

interface Env {
  GROK_PROXY_API_KEY: string;
}

const PROXY_HOST = "cf-ai-rate-proxy.brasaimainstream.workers.dev";
const PROXY_URL = "https://" + PROXY_HOST + "/v1/chat/completions";
const AI_MODEL = "@cf/qwen/qwen3.8-27b";
const MAX_PROMPT_BYTES = 65_536;
const MAX_RESPONSE_CHARS = 250_000;
const BINARY_VERSION = "1.0.50";

function assertText(text: string) {
  if (!text || new TextEncoder().encode(text).length > MAX_PROMPT_BYTES) {
    throw new Error("GROK_INVALID_PROMPT");
  }
}

/** Private Worker service RPC; no HTTP route grants access to a container. */
export class GrokRuntime extends WorkerEntrypoint<Env> {
  async prompt(workspaceId: string, chatId: number, prompt: string, operationId: string) {
    if (!workspaceId || workspaceId.length > 160 ||
        !Number.isSafeInteger(chatId) || chatId < 0 ||
        !/^[a-zA-Z0-9_:.-]{8,160}$/.test(operationId)) {
      throw new Error("GROK_INVALID_SCOPE");
    }
    assertText(prompt);
    // The caller is the trusted Workshop service binding. Do not expose this
    // method by HTTP or accept a browser token as proof of Workspace access.
    const name = workspaceId + ":" + chatId;
    return this.ctx.exports.GrokSandbox.getByName(name).prompt(prompt, operationId);
  }

  async cancel(workspaceId: string, chatId: number) {
    if (!workspaceId || !Number.isSafeInteger(chatId) || chatId < 0) {
      throw new Error("GROK_INVALID_SCOPE");
    }
    return this.ctx.exports.GrokSandbox.getByName(workspaceId + ":" + chatId).cancel();
  }
}

/** Credential and model policy live in Worker, never in the Linux sandbox. */
export class GrokEgress extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.href !== PROXY_URL) {
      return Response.json({ error: "GROK_EGRESS_DENIED" }, { status: 403 });
    }
    if ((Number(request.headers.get("content-length")) || 0) > 1_000_000) {
      return Response.json({ error: "GROK_EGRESS_SIZE" }, { status: 413 });
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 1_000_000) {
      return Response.json({ error: "GROK_EGRESS_SIZE" }, { status: 413 });
    }
    let body: { model?: unknown; messages?: unknown; stream?: unknown };
    try { body = JSON.parse(raw); } catch {
      return Response.json({ error: "GROK_EGRESS_BAD_JSON" }, { status: 400 });
    }
    if (!body || body.model !== AI_MODEL || !Array.isArray(body.messages) ||
        body.messages.length < 1 || body.messages.length > 200 ||
        (body.stream !== undefined && typeof body.stream !== "boolean")) {
      return Response.json({ error: "GROK_EGRESS_MODEL_DENIED" }, { status: 403 });
    }
    if (!this.env.GROK_PROXY_API_KEY || this.env.GROK_PROXY_API_KEY.length < 12) {
      return Response.json({ error: "GROK_PROXY_NOT_CONFIGURED" }, { status: 503 });
    }
    const upstream = await fetch(PROXY_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + this.env.GROK_PROXY_API_KEY,
        "Content-Type": "application/json",
        Accept: body.stream ? "text/event-stream" : "application/json"
      },
      body: raw,
      redirect: "manual",
      signal: AbortSignal.timeout(180_000)
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      return Response.json({ error: "GROK_EGRESS_REDIRECT" }, { status: 502 });
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ??
          (body.stream ? "text/event-stream" : "application/json"),
        "Cache-Control": "no-store"
      }
    });
  }
}

type PromptResult = { status: "SUCCEEDED"; text: string } |
  { status: "CANCELLED" | "UNKNOWN"; text: string };

/**
 * One DO/container per bound Workshop chat. Its state is only CLI execution,
 * not chat history; Overseer persists the canonical transcript.
 */
export class GrokSandbox extends DurableObject<Env> {
  private peer?: GrokAcpPeer;
  private acpId?: string;
  private inFlight?: string;
  private socket?: WebSocket;

  private get container() {
    if (!this.ctx.container) throw new Error("GROK_CONTAINER_BINDING_MISSING");
    return this.ctx.container;
  }

  private async connect(): Promise<void> {
    if (this.peer && !this.peer.closed && this.acpId) return;
    if (!this.container.running) {
      // Egress interception MUST precede start. The container gets only a
      // daemon authentication secret, never the provider credential.
      await this.container.interceptOutboundHttps(
        PROXY_HOST, this.ctx.exports.GrokEgress({ props: {} }));
      const secret = crypto.randomUUID() + crypto.randomUUID();
      await this.ctx.storage.put("daemonSecret", secret);
      this.container.start({
        image: this.container.images.grok,
        instance: "standard-1",
        enableInternet: false,
        env: {
          GROK_AGENT_SECRET: secret,
          GROK_EXPECT_CA: "1"
        }
      });
      await this.container.setInactivityTimeout(30 * 60 * 1000);
      await this.ctx.storage.put("generation",
        ((await this.ctx.storage.get<number>("generation")) ?? 0) + 1);
    }
    const secret = await this.ctx.storage.get<string>("daemonSecret");
    if (!secret) throw new Error("GROK_DAEMON_SECRET_MISSING");
    let upstream: Response | undefined;
    // Container.start is asynchronous; TCP port availability is not readiness.
    for (let i = 0; i < 30; i++) {
      const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
      const req = new Request(
        "http://container/ws?server-key=" + encodeURIComponent(secret), {
          headers: {
            Upgrade: "websocket",
            Connection: "Upgrade",
            "Sec-WebSocket-Version": "13",
            "Sec-WebSocket-Key": key
          }
        });
      try {
        upstream = await this.container.getTcpPort(2419).fetch(req);
        if (upstream.status === 101 && upstream.webSocket) break;
      } catch { /* not ready yet */ }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (upstream?.status !== 101 || !upstream.webSocket) {
      throw new Error("GROK_ACP_DAEMON_NOT_READY");
    }
    const socket = upstream.webSocket;
    socket.accept();
    this.socket = socket;
    const peer = new GrokAcpPeer(socket);
    const initialized = await peer.request("initialize", {
      protocolVersion: 1,
      clientInfo: { name: "cloudflare-os", version: "1.0" },
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false }
    });
    if (initialized?.protocolVersion !== 1) {
      peer.abort(new Error("GROK_ACP_VERSION_UNSUPPORTED"));
      throw new Error("GROK_ACP_VERSION_UNSUPPORTED");
    }
    let id = await this.ctx.storage.get<string>("acpSessionId");
    if (id) {
      // Reuse is never silently emulated by session/new: lost transcript
      // continuity must be surfaced as an explicit runtime error.
      await peer.request("session/load", { cwd: "/workspace", mcpServers: [], sessionId: id });
    } else {
      const created = await peer.request("session/new", {
        cwd: "/workspace", mcpServers: []
      });
      if (!created?.sessionId || typeof created.sessionId !== "string") {
        peer.abort();
        throw new Error("GROK_ACP_SESSION_MISSING");
      }
      id = created.sessionId;
      await this.ctx.storage.put("acpSessionId", id);
    }
    this.acpId = id;
    this.peer = peer;
  }

  async prompt(text: string, operationId: string): Promise<PromptResult> {
    assertText(text);
    if (this.inFlight) throw new Error("GROK_PROMPT_ALREADY_ACTIVE");
    const key = "op:" + operationId;
    const prior = await this.ctx.storage.get<PromptResult>(key);
    if (prior) return prior;
    if (await this.ctx.storage.get<string>("intent:" + operationId)) {
      throw new Error("GROK_PREVIOUS_PROMPT_OUTCOME_UNKNOWN");
    }
    // Exactly one attempted external dispatch per operation; never replay
    // after ambiguous timeout or DO restart.
    await this.ctx.storage.put("intent:" + operationId, await crypto.subtle.digest(
      "SHA-256", new TextEncoder().encode(text)).then(x =>
        Array.from(new Uint8Array(x)).map(v=>v.toString(16).padStart(2,"0")).join("")));
    this.inFlight = operationId;
    let output = "";
    try {
      await this.connect();
      this.peer!.onText = (delta: string) => {
        output += delta;
        if (output.length > MAX_RESPONSE_CHARS) {
          this.peer?.abort(new Error("GROK_RESPONSE_TOO_LARGE"));
        }
      };
      const result = await this.peer!.request("session/prompt", {
        sessionId: this.acpId, prompt: [{ type: "text", text }]
      });
      const final: PromptResult = {
        status: result?.stopReason === "cancelled" ? "CANCELLED" : "SUCCEEDED",
        text: output
      };
      await this.ctx.storage.put(key, final);
      return final;
    } catch (e) {
      this.peer?.abort();
      this.peer = undefined;
      this.acpId = undefined;
      throw e;
    } finally {
      this.inFlight = undefined;
    }
  }

  async cancel(): Promise<void> {
    if (!this.peer || !this.acpId || !this.inFlight) return;
    // ACP cancel is a notification and cannot promise rollback of tool effects.
    this.socket?.send(JSON.stringify({
      jsonrpc: "2.0", method: "session/cancel", params: { sessionId: this.acpId }
    }));
  }
}

export default {
  fetch() {
    return Response.json({ error: "PRIVATE_WORKER" }, { status: 404 });
  }
} satisfies ExportedHandler<Env>;
