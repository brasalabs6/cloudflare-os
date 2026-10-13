# ACP Agent Platform for Cloudflare OS

> **SUPERSEDED AS ACTIVE IMPLEMENTATION PLAN — 2026-10-13:** [ROADMAP](../../ROADMAP.md) authorizes only Grok-in-Cloudflare-Container + existing Workshop chat in Phase 1. This page is **historical research, migration backlog or earlier audit snapshot**, not permission to implement any removed package. See [simplification decision](./SIMPLIFICATION_DECISION.md). Existing security contracts in root SPECS.md remain authoritative.

> **Scope note (2026-10-13):** This page is the original ACP CLI vertical-slice architecture. Persistent AgentDefinitions, autonomous Tasks, native Workshop pi-agent-core, subagents, loop strategies, and MCP/REST module projection are governed by [AGENT_PLATFORM_UNIFIED_V2](./AGENT_PLATFORM_UNIFIED_V2.md). ACP is one pluggable driver, not the platform's sole execution protocol. Both documents refer to implementation plans; the new v2 packages are not deployed.

**Status:** normative implementation specification; runtime implementation pending  
**Date:** 2026-10-13  
**Owner:** Cloudflare OS platform  
**Scope:** Grok Build, Codex and OpenCode CLI harnesses running in isolated Cloudflare sandboxes.

## 1. Decision summary

Cloudflare OS remains the system of record for identity, workspace membership, capability grants, user-facing workflows, Gatekeeper registration, approvals and observability. The agent runtime is a separate Cloudflare Worker deployment with a Durable Object and one isolated Container per logical agent session. ACP is the protocol boundary between the runtime supervisor and CLI harnesses.

The first release consists of:
- shared ACP protocol library and versioned harness registry;
- one independent agent-runtime Worker, SessionRuntime Durable Object and isolated Container;
- three adapters: Grok Build, Codex through codex-acp, and OpenCode through opencode acp;
- two independent Gatekeeper Workers: Coding Agents and Computers;
- trusted inference egress, initially deployable as a private WorkerEntrypoint/service binding;
- Workshop UI for session creation, event replay, approvals, terminal and file inspection;
- immutable runtime releases and sticky experiment assignment.

Do not create one Gatekeeper per CLI. Do not turn harnesses into fake LLM providers. Do not fork the Workshop kernel or duplicate its workspace identity model.

## 2. Architecture

~~~mermaid
flowchart TB
  UI[Workshop Agent Sessions UI] <--> OS[Workshop Backend / Overseer DO]
  OS --> GCA[Gatekeeper Coding Agents]
  OS --> GCO[Gatekeeper Computers]
  GCA --> RT[Agent Runtime Router]
  GCO --> RT
  RT --> R1[Runtime Release A]
  RT --> R2[Runtime Release B]
  R1 --> DO1[SessionRuntime DO]
  R2 --> DO2[SessionRuntime DO]
  DO1 --> C1[Cloudflare Container]
  DO2 --> C2[Cloudflare Container]
  C1 --> ACP[ACP Supervisor]
  ACP --> GROK[Grok Build]
  ACP --> CODEX[Codex ACP]
  ACP --> OPEN[OpenCode ACP]
  C1 --> EG[Trusted Egress Worker]
  EG --> INF[Authorized Inference Proxy]
  DO1 --> LOG[Durable event journal]
  DO1 --> BK[R2 checkpoint archive]
~~~

## 3. Responsibility boundaries

| Component | Owns | Must not own |
|---|---|---|
| Workshop backend and Overseer | Identity, workspace access, session capabilities, UI integration, existing agent orchestration | ACP framing, Linux processes, harness secrets |
| Gatekeeper Coding Agents | Capability API for creating and operating authorized sessions, resource grants, approval integration and observation authorization | Container lifecycle, raw ACP transport |
| Gatekeeper Computers | Separately granted terminal, file and command capabilities | Session/run journal or ACP process supervision |
| Agent Runtime | Container, session generation, ACP supervisor, PTY, event sequence, run/operation lifecycle, recovery | User identity decisions based on caller-supplied IDs |
| ACP Core | JSON-RPC framing, request correlation, schema validation, typed events and protocol compatibility | Cloudflare provisioning or user authorization |
| Harness Registry | Versioned manifests, compatibility, effective capabilities and model/mode metadata | Direct container creation |
| Harness adapters | CLI command, version-specific config, protocol quirks and normalized events | User authentication, public API |
| Agent Egress | Destination and model policy, secret injection, bounded proxying and redacted usage telemetry | Returning credentials to the container or browser |
| Workshop UI | Session interaction, approval prompts, terminal and file views | Authoritative session state |

## 4. Identity and persistence

These IDs are different by design: workspaceId, chatId, agentSessionId, agentRunId, agentOperationId, sandboxId, sandboxGeneration, acpSessionId, eventSequence and releaseId. Never reuse a provider ACP session ID as the platform session ID.

The SessionRuntime Durable Object is authoritative for active session state, run transitions, operations, approvals, terminals and monotonic event sequence. Use DO SQLite/storage for transactional state and R2 for independently checksummed checkpoint/archive objects. R2 is not the live run database. A SQL database may be used for search/projection, but it must not race the DO as a second authority.

Minimum logical records:
- Session: owner account, workspace, optional chat, harness and pinned version, runtime profile, permission policy, release assignment, generation, state and optimistic version.
- Run: session, generation, idempotency key, request hash, model alias, state, timestamps, final reason and event cursor.
- Operation: kind, idempotency key, expected session version, generation, state and error code.
- Event: schema version, session, optional run, generation, monotonically increasing sequence, timestamp, type and validated payload.
- Approval: session, run, tool-call ID, bounded request summary, expiry, decision and deciding principal.
- Checkpoint: session/generation, manifest, content checksum, creation status and archive reference.

## 5. Session and run lifecycle

Session states: CREATED, PROVISIONING, READY, RUNNING, WAITING_APPROVAL, IDLE, SUSPENDING, SUSPENDED, RESUMING, RECOVERING, DEGRADED, STOPPING, STOPPED, FAILED and DELETED. Invalid transitions must be rejected and recorded.

Run states: QUEUED_FOR_DISPATCH, DISPATCHING, RUNNING, WAITING_APPROVAL, CANCELLING, SUCCEEDED, FAILED, CANCELLED and OUTCOME_UNKNOWN. OUTCOME_UNKNOWN is required when the caller cannot prove whether a non-idempotent command reached the harness.

Every mutation accepts an idempotency key. Reusing a key with a different request hash is a conflict. Every sandbox start increments a monotonic generation. Commands, terminal tickets and events from stale generations are rejected. A browser disconnect never cancels a run.

## 6. ACP contract

The default internal transport is ACP JSON-RPC over stdio, supervised inside the sandbox. A private sidecar bridge may carry framed messages to the Worker, but ACP itself must not be described as WebSocket. The browser-facing transport is separate and authenticated.

Required protocol path: initialize, session/new or session/load when negotiated, session/prompt, session/cancel, event streaming, permission requests, shutdown and recovery diagnostics. Model and mode changes are conditional on negotiated capabilities. The effective capability set comes from the live initialize handshake, not static marketing metadata.

Adapters:
- Grok Build: pinned Grok CLI and supported stdio ACP command; reuse proven configuration semantics without copying insecure bootstrap shortcuts.
- Codex: pinned codex-acp bridge around Codex App Server; no direct App Server integration in the Workshop kernel.
- OpenCode: pinned opencode acp command and isolated config directory.

## 7. Authorization and security

- Workspace membership and principal identity come from Workshop-authenticated context, not arbitrary URL or header fields.
- A CodingAgent capability is scoped to one session and permitted operations. Computer access requires a separate explicit grant.
- Read operations that expose protected resource data call authorizeObservation. Side effects submitted by agents go through submitAction and applyAction / approval semantics from the canonical Gatekeeper API.
- Terminal tickets are short-lived, single-use, bound to principal, session, sandbox generation, origin and nonce. Never expose a reusable runtime secret.
- The runtime bridge is private to service bindings or authenticated tickets; do not make an unauthenticated public control-plane endpoint.
- Egress defaults to deny. Permit only explicit model/provider endpoints and necessary bootstrap services. Prevent redirects, DNS rebinding, arbitrary URLs, metadata endpoints and user-controlled hostnames from bypassing policy.
- Secrets remain in trusted Workers. Do not persist long-lived credentials in container filesystems, command logs, ACP events or browser state.
- Paths are normalized and checked against the granted root; defend against traversal, symlinks and time-of-check/time-of-use races.
- Bound message size, event size, stdout/stderr, file reads, command runtime, CPU/memory, concurrent sessions and storage.
- Redact prompts and secrets from operational logs by default. Audit actions without copying sensitive payloads into logs.

## 8. Immutable releases and A/B

A release pins runtime Worker/version, container image digest, harness ID/version, adapter version, ACP compatibility range, configuration schema, permission policy and checkpoint compatibility. Never use floating image tags for production sessions.

Assignment happens at session creation and is persisted. Use a stable hash of experiment ID plus eligible principal/workspace cohort, with explicit opt-in/allowlist and deterministic salt. All future runs in a session remain on the same release. Never move a live session between incompatible releases without a migration plan.

Rollback stops new assignments to the bad release; it does not silently kill sessions already pinned to it. Record assignment, exposure, outcomes, latency, startup time, error rates, approvals and usage by release. Support kill switch, quota, budget and a safe control variant.

## 9. Deployment units

Libraries (not independent deployments): acp-core, agent-harness-registry and the three harness adapter packages. Independent deployment units: agent-runtime, gatekeeper-coding-agents and gatekeeper-computers. Agent-egress starts as a private service-bound WorkerEntrypoint and can become a separate Worker when policy, ownership or load justify it.

All deployments must use generated configuration conventions and deployment registration used by this repository. New Workers require explicit service bindings, secrets declarations, environment separation, tests and observability. Do not bypass the Gatekeeper authoring guide.

## 10. Implementation gates

- G0 — contract review: approve domain IDs, capabilities, state machines, ACP framing and threat model before implementation.
- G1 — ACP core and registry: bounded parser, cancellation, timeouts, typed events, manifest validation and fixtures.
- G2 — runtime: DO + isolated Container, lease/generation fencing, durable event journal, real PTY and checkpoint integrity.
- G3 — harnesses: Grok, Codex and OpenCode handshake, prompt, tool events, permission and cancel tests against pinned images.
- G4 — Gatekeepers: resource-scoped capability contracts, action/observation authorization, observer methods, generated types and security tests.
- G5 — UI: create/select, event replay, approvals, terminal, safe file browser and reload/reconnect.
- G6 — hardening: failure injection, concurrent operations, cross-workspace denial, backup restore and secret/egress audit.
- G7 — release experiments: two immutable versions, sticky cohort assignment, metrics, rollback and kill switch.

A gate is not complete because a Worker returns HTTP 200. Acceptance requires real sandbox E2E, authorization-abuse tests and evidence that recovery restores the intended session.

## 11. Definition of done for first usable release

1. All three harnesses run in real isolated Cloudflare sandboxes using pinned versions.
2. initialize, session creation, prompt, normalized events, cancellation and supported permissions work.
3. Workspace/session authorization is tested across users, workspaces and stale generations.
4. Event replay after browser reload contains no duplicate sequence numbers and does not cancel a running process.
5. Terminal is a real PTY bound to the same session; file inspection cannot escape its granted root.
6. A checkpoint can be restored into a fresh sandbox and verified by checksum; unsupported process state is explicitly reported.
7. Secrets are never returned to clients or written to logs; egress is allowlisted and tested against bypass attempts.
8. Two immutable runtime releases can receive separate cohorts, and rollback prevents new assignment without silently migrating active sessions.
9. Lint, typecheck, unit, contract, integration, browser and security smoke suites pass.
10. Staging evidence and production evidence are tracked separately.

## 12. Source references

- Cloudflare OS: https://github.com/brasalabs6/cloudflare-os
- Existing Gatekeeper contract: https://github.com/brasalabs6/cloudflare-os/blob/main/packages/workshop-shared/src/gatekeeper.ts
- Gatekeeper authoring guide: https://github.com/brasalabs6/cloudflare-os/blob/main/.agents/skills/write-gatekeeper/SKILL.md
- GrokBot ACP work: https://github.com/brasalabs6/grokbot/pull/1
- Hub ACP manager: https://github.com/brasalabs6/hub/blob/main/src/runtime/acp/acp-client.manager.ts
- Codex ACP: https://github.com/agentclientprotocol/codex-acp
- OpenCode ACP: https://docs.opencode.ai/docs/pt-br/acp/
- Cloudflare Sandbox docs: https://developers.cloudflare.com/changelog/post/2026-09-30-sandbox-sdk-1-0/


## 13. Normative data/flow contract (2026-10-13)

**[ACP_CONTRACTS_V1.md](./ACP_CONTRACTS_V1.md) is the normative source of truth** for serialized envelopes, logical schema fields, ID ownership, transaction ordering, event types, ACP bridge semantics, release routing and rollback. This overview describes responsibilities, but must not be used as an executable interface. Where this overview is less specific, the canonical contract prevails. New work must produce schema validators, migrations and contract fixtures against that document. cloudflare-os PRs #2 and #3 were closed, not merged. The Grokbot code is extraction-only and must not become a parallel production service.
