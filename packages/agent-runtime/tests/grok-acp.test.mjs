import test from "node:test";
import assert from "node:assert/strict";
import { GrokAcpPeer, extractAgentText } from "../src/grok-acp.mjs";

class FakeSocket {
  listeners = {};
  sent = [];
  addEventListener(event, listener) { (this.listeners[event] ??= []).push(listener); }
  send(value) { this.sent.push(JSON.parse(value)); }
  close() { this.listeners.close?.forEach((fn) => fn({})); }
  emit(value) { this.listeners.message?.forEach((fn) => fn({ data: JSON.stringify(value) })); }
}
test("ACP initialize and request ID correlation", async () => {
  const sock = new FakeSocket();
  const acp = new GrokAcpPeer(sock, { timeoutMs: 200 });
  const one = acp.request("initialize", { protocolVersion: 1 });
  const two = acp.request("session/new", { cwd: "/workspace", mcpServers: [] });
  assert.deepEqual(sock.sent.map((x) => x.method), ["initialize", "session/new"]);
  sock.emit({ jsonrpc: "2.0", id: 2, result: { sessionId: "s" } });
  sock.emit({ jsonrpc: "2.0", id: 1, result: { protocolVersion: 1 } });
  assert.equal((await one).protocolVersion, 1);
  assert.equal((await two).sessionId, "s");
  acp.abort();
});
test("server request for permission fails closed", () => {
  const sock = new FakeSocket();
  const acp = new GrokAcpPeer(sock);
  sock.emit({ jsonrpc: "2.0", method: "session/request_permission", id: 8, params: {} });
  assert.deepEqual(sock.sent[0].result, { outcome: { outcome: "cancelled" } });
  acp.abort();
});
test("only assistant text enters chat", () => {
  assert.equal(extractAgentText({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "Olá" } }), "Olá");
  assert.equal(extractAgentText({ sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "secret" } }), "");
  assert.equal(extractAgentText({ sessionUpdate: "tool_call_update", content: { type: "text", text: "unsafe" } }), "");
});
test("disconnect rejects every pending request", async () => {
  const sock = new FakeSocket();
  const acp = new GrokAcpPeer(sock);
  const request = acp.request("session/prompt", { sessionId: "s" });
  acp.abort();
  await assert.rejects(request, /ACP_DISCONNECTED/);
});
test("malformed frame closes and rejects", async () => {
  const sock = new FakeSocket();
  const acp = new GrokAcpPeer(sock);
  const request = acp.request("session/prompt", {});
  acp.receive("{invalid");
  await assert.rejects(request, /ACP_INVALID_JSON/);
});

test("ACP streams only assistant text; tool, thought and other updates remain private", () => {
  const sock = new FakeSocket();
  const seen = [];
  const acp = new GrokAcpPeer(sock, { onText: (text) => seen.push(text) });
  sock.emit({ jsonrpc: "2.0", method: "session/update",
    params: { update: { sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "Hello" } } } });
  sock.emit({ jsonrpc: "2.0", method: "session/update",
    params: { update: { sessionUpdate: "agent_thought_chunk",
      content: { type: "text", text: "private" } } } });
  sock.emit({ jsonrpc: "2.0", method: "session/update",
    params: { update: { sessionUpdate: "tool_call",
      content: { type: "text", text: "untrusted tool output" } } } });
  assert.deepEqual(seen, ["Hello"]);
  acp.abort();
});
test("oversized frame aborts all outstanding ACP requests", async () => {
  const sock = new FakeSocket();
  const acp = new GrokAcpPeer(sock, { timeoutMs: 500 });
  const pending = acp.request("session/prompt", {});
  acp.receive("x".repeat(256_001));
  await assert.rejects(pending, /ACP_INVALID_FRAME/);
});
test("ACP prompt timeout is an unknown outcome, not a safe automatic retry", async () => {
  const sock = new FakeSocket();
  const acp = new GrokAcpPeer(sock, { timeoutMs: 15 });
  const pending = acp.request("session/prompt", { sessionId: "s", prompt: [] });
  await assert.rejects(pending, /ACP_REQUEST_TIMEOUT_OUTCOME_UNKNOWN/);
  assert.equal(acp.pending.size, 0);
  acp.abort();
});
