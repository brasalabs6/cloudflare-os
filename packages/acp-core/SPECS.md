# ACP Core — SPECS

**Kind:** shared TypeScript library; not a Worker deployment.  
**Status:** specification; implementation pending.

## Responsibility

Provide the transport-independent, versioned protocol primitives shared by the runtime supervisor and harness adapters. This package is the only place that owns JSON-RPC framing, request correlation, ACP envelope validation and normalized protocol event types.

## Public contract

Export typed models for protocol envelopes, request IDs, initialize capabilities, session lifecycle requests, prompt/tool events, permission requests, cancellation, shutdown, protocol errors and normalized platform events. Keep platform domain IDs separate from ACP session IDs.

Required primitives:
- Incremental bounded JSON-RPC/NDJSON decoder and encoder.
- Request correlation map with timeout, cancellation and cleanup on disconnect.
- Notification dispatch and server-initiated request handling.
- Schema/version validation for events crossing a Worker or persistence boundary.
- Capability negotiation that records advertised versus effective capabilities.
- Error taxonomy separating protocol errors, harness exits, transport loss, authorization denials and unknown outcomes.
- Backpressure and limits for frame bytes, outstanding requests, event payloads and queued writes.

## Invariants

1. Reject malformed frames, invalid IDs and oversized payloads before JSON decoding or persistence.
2. Never assume event arrival order across a reconnect; assign platform event sequence at the authoritative SessionRuntime.
3. A cancelled request is not proof that the harness side effect did not occur.
4. No dependency on NestJS, DOM APIs, Node-only streams or a particular Cloudflare deployment.
5. No authorization decisions based on protocol payload fields.

## Tests and acceptance

Unit tests cover partial frames, multiple frames, invalid UTF-8, malformed JSON, oversized payloads, duplicate IDs, timeouts, cancellation races, disconnect with outstanding requests, server requests, backpressure and unknown message types. Contract fixtures are required for Grok, codex-acp and OpenCode. Typecheck and tests must run through the repository's package tooling before a consumer imports this package.


## Normative protocol contract

Use [ACP_CONTRACTS_V1](../../docs/architecture/ACP_CONTRACTS_V1.md) sections 3, 5 and 6. Export validators for `RuntimeRequest`, `RuntimeResult`, `AgentEvent` and per-harness protocol fixtures. A complete implementation supplies actual JSON schema files, typed discriminated unions, examples, compatibility ranges and negative fixtures; this descriptive package spec alone is not sufficient. The Grok 1.0.50 probe used a version 1 initialize envelope; do not copy Hub's initialize blindly. Distinguish JSON-RPC wire IDs from platform event sequences and ACP session IDs. Test frames crossing chunk boundaries, invalid UTF-8, duplicate outstanding IDs, unknown notifications and cancelled operations with unknown side-effect outcome.
