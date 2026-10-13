/**
 * Narrow ACP JSON-RPC 2.0 peer for the Grok CLI. No MCP or public transport.
 * The Grokbot smoke source used protocolVersion 1 and session/new.
 */
export class GrokAcpPeer {
  constructor(socket, { timeoutMs = 150_000, onText = (_delta) => {} } = {}) {
    this.socket = socket;
    this.timeoutMs = timeoutMs;
    this.onText = onText;
    this.nextId = 1;
    this.pending = new Map();
    this.closed = false;
    socket.addEventListener("message", (event) => this.receive(event.data));
    socket.addEventListener("close", () => this.abort(new Error("ACP_CONNECTION_CLOSED")));
    socket.addEventListener("error", () => this.abort(new Error("ACP_CONNECTION_ERROR")));
  }

  request(method, params) {
    if (this.closed) return Promise.reject(new Error("ACP_CONNECTION_CLOSED"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("ACP_REQUEST_TIMEOUT_OUTCOME_UNKNOWN"));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.socket.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
      } catch (error) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  receive(raw) {
    if (this.closed || typeof raw !== "string" || raw.length > 256_000) {
      this.abort(new Error("ACP_INVALID_FRAME"));
      return;
    }
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      this.abort(new Error("ACP_INVALID_JSON"));
      return;
    }
    if (message?.jsonrpc !== "2.0" || typeof message !== "object") {
      this.abort(new Error("ACP_INVALID_JSON_RPC"));
      return;
    }
    if (message.method === "session/update") {
      const delta = extractAgentText(message.params?.update);
      if (delta) this.onText(delta);
      return;
    }
    if (message.method && message.id !== undefined) {
      // Phase 1 grants no file/terminal or tool callback permissions.
      // For ACP's request_permission shape, reject explicitly rather than auto-approve.
      this.socket.send(JSON.stringify({
        jsonrpc: "2.0", id: message.id,
        result: { outcome: { outcome: "cancelled" } }
      }));
      return;
    }
    if (message.id === undefined) return;
    const p = this.pending.get(message.id);
    if (!p) return;
    this.pending.delete(message.id);
    clearTimeout(p.timer);
    if (message.error) p.reject(new Error("ACP_REMOTE_ERROR:" + String(message.error.code)));
    else p.resolve(message.result);
  }

  abort(error = new Error("ACP_DISCONNECTED")) {
    if (this.closed) return;
    this.closed = true;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    this.pending.clear();
    try { this.socket.close(1000, "session closed"); } catch {}
  }
}

/** Only user-visible assistant text, never thinking or tool output. */
export function extractAgentText(update) {
  if (!update || update.sessionUpdate !== "agent_message_chunk") return "";
  const c = update.content;
  if (c?.type === "text" && typeof c.text === "string") return c.text;
  if (Array.isArray(c)) return c.filter((x) => x?.type === "text" && typeof x.text === "string").map((x) => x.text).join("");
  return "";
}
