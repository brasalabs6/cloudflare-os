# agent-runtime/plan.md — Phase 1, Grok only

> **ACTIVE IMPLEMENTATION PLAN**, status NOT STARTED; see [ROADMAP](../../ROADMAP.md), [MVP contract](../../docs/architecture/PHASE1_GROK_MVP.md). This folder currently has **no runtime source code, build or Worker configuration**.

## Workstream A — source extraction and characterization

- [ ] **A01** Pin SHA `9171b11c7269f6f305e99fd697a4dd885aad5459` of Grokbot PR #1, list exact source files, test fixtures and staging run links; compare Grokbot `Dockerfile`, `src/index.ts`, `tools/acp-smoke.mjs`, `src/ai-gateway.ts`.
- [ ] **A02** Inspect Workshop current `AiChatMetadata`, `ChatInterface`, `runAgent` dispatch, `Overseer` permission and chat subscriber; identify smallest private RPC seam for Grok engine.
- [ ] **A03** Characterize native chat regression (create, send, stream, replay, cancel, tool/approval, multiple chats) before adding new engine.
- [ ] **A04** Verify pinned Grok version, CLI launch syntax, ACP schema, initialize/session/new/session/prompt/session/update/cancel and protocol permission behavior with fixture tests. Distinguish smoke-only `--always-approve`/`yoloMode` from production.

## Workstream B — real Cloudflare runtime

- [ ] **B01** Add `package.json` using existing workspace scripts/TypeScript conventions and build/test scripts; choose one Worker/DO/Container target from existing Cloudflare config conventions.
- [ ] **B02** Add `Dockerfile` with pinned Grok binary hash, non-root process, bounded workspace, Node supervisor if necessary; no credentials/images tagged latest.
- [ ] **B03** Implement private Worker entrypoint and `GrokSession` DO keyed from authenticated Workshop chat reference; scoped RPC, schema checks, idempotent open/cancel/close and lifecycle state.
- [ ] **B04** Implement Container start/health/provisioning with real Cloudflare API, image registration, generation fences; no public TCP endpoint.
- [ ] **B05** Implement minimal Grok ACP stdio JSON-RPC client internal to this package: newline framing, pending IDs, deadlines, server callbacks denied unless explicitly supported, stderr isolation, state updates.
- [ ] **B06** Implement prompt admission ledger (persist before dispatch), normalized sequenced event journal, bounded polling/replay for Workshop, crash/no-blind-retry/UNKNOWN behavior.
- [ ] **B07** Implement trusted egress bridge **inside runtime** using Grokbot source and existing Workshop provider strategy: `enableInternet:false`, HTTPS interception, ephemeral trusted CA, model allowlist, Worker-only secret, bounded redirects/timeouts. Do not create `agent-egress` package.
- [ ] **B08** Add file path limits, resource quotas, cleanup on chat stop/revoke, timeout error classification, per-workspace confinement and sanitised diagnostics.

## Workstream C — Workshop vertical slice

- [ ] **C01** Extend `workshop-shared` public chat types minimally/additively (engine selection default native and status); review before implementation.
- [ ] **C02** Add private backend-to-runtime Worker service binding using generated config/release manifest; no router/MCP routes or new Gatekeeper.
- [ ] **C03** On Grok chat prompt, Overseer persists user message once and invokes private runtime; suppress native pi-agent-core for that specific chat, preserve unchanged native behavior for all existing chats.
- [ ] **C04** Pump events back to Overseer, map text to existing chat events/assistant messages and persist dedup by runtime session/generation/sequence before frontend publishing.
- [ ] **C05** Reuse existing `ChatInterface` to select Grok and render progress/text/error/cancel. No new UI package or separate frontend app.
- [ ] **C06** Restore client connection through existing chat API and a bounded runtime event catch-up; if Grok process died, show explicit lost/unknown state instead of fabricated session resume.

## Workstream D — acceptance, deployment and proof

- [ ] **D01** Unit tests: JSON-RPC partial frames/IDs/timeout, double prompt/duplicate event, stale generations, runtime crash, canceled chat, source-aware dedup.
- [ ] **D02** Security tests: cross-tenant isolation, arbitrary user-provided session IDs denied, no public runtime control, denied unsafe CLI tool permission, forbidden network/TLS/redirect/model and secrets leakage.
- [ ] **D03** Native regressions: Workshop chat+stream+agent tool flows, AgentSpawner callable, Gatekeeper approvals, release/config checks and existing browser chat tests.
- [ ] **D04** Run build/typecheck/lint/package integration and real Cloudflare staging E2E: ChatInterface → Overseer → Container Grok → inference → streamed response → persisted history → reconnect.
- [ ] **D05** Capture exact commits and staging run URLs, package/container digest, rollback to native-only engine, launch docs; **only then close Phase 1**.

## Explicit deferrals

No MCP, registry, generalized ACP package, separate harness adapter package, scheduler, background tasks, 24/7 loops, subagents, terminal, UI file explorer, R2 checkpoint, A/B release router or Codex/OpenCode. These are in ROADMAP Phase 2+ and must not be added as dependencies on B01–D05.
