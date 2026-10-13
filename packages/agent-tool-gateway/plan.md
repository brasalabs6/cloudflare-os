# Agent Tool Gateway (MCP/HTTP Export) — plan.md

> **State:** NOT STARTED (except for source analysis stated below). These are executable work packages, not an assertion of completed code. Implementation must proceed only after prerequisite API reviews, migrations and security approval.

## 0. Inputs, sources and dependencies

**User requirement:** [USER_INPUT_LEDGER U-006/U-007](../../docs/architecture/USER_INPUT_LEDGER.md). **Normative:** [Unified v2](../../docs/architecture/AGENT_PLATFORM_UNIFIED_V2.md), [ACC package](../agent-protocol/SPECS.md), [ACP v1](../../docs/architecture/ACP_CONTRACTS_V1.md). **Feature evidence:** [migration matrix](../../docs/architecture/ACP_MIGRATION_MATRIX.md).

**Destillation sources:** Existing Workshop router, Cap'n Web auth, Gatekeeper/mcp-shared; mcp-shared is an MCP CLIENT implementation, not evidence a server already exists.

**Dependencies:** preserve existing Workshop kernel authority, current Gatekeeper observer/action approval semantics, current Scheduler hooks and MCP import trust. No inherited auth data is accepted from an untrusted serialized request. Pin source path+commit before porting.

## 1. Ordered implementation steps

- [ ] **P01 — Map current router routes and Workshop session validation; choose explicitly authenticated /agent-api/v1 and /agent-mcp ingress without conflicting with /api, /gatekeeper or asset routes.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P02 — Write threat model separating HTTP/MCP server export from existing outbound MCP clients; define ticket minting/revocation and audience scopes.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P03 — Create Worker and generated config, service bindings to Workshop capability resolver/Tool Registry and deploy manifest; no arbitrary DO discovery.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P04 — Implement authenticated REST endpoints for agent/task list/get/create/status/commands/event replay with versioned response/errors and bounded pagination.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P05 — Implement MCP server initialize, tools/list and tools/call for granted capabilities only, honoring transport lifetimes and protocol-version negotiation.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P06 — Unify HTTP/MCP execution via ToolInvocation and existing Gatekeeper authorizeObservation/submitAction/applyAction semantics.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P07 — Implement asynchronous pending-approval result/status and event subscription path; prohibit false immediate success for queued changes.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P08 — Enforce caps, tenant isolation, cancellation semantics, audit, request deadlines, no secret exposure and revalidated grants on every invocation.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P09 — Run adversarial integration tests (cross-workspace, no-authorization, tool schema injection, stale ticket, SSRF and replay).**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P10 — Stage one example independent Gatekeeper module exported in three forms: native executeCode, HTTP user and MCP agent; validate existing MCP client interop.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P11 — Ship behind explicit admin enablement and opt-in per-resource grants with revocation/rollback procedure.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

## 2. Proposed filesystem implementation map

```text
packages/agent-tool-gateway/
  src/{worker,routes,auth,scopes,rate-limit,audit}.ts
  src/http/{agents,tasks,tools}.ts
  src/mcp/{server,tools-list,tools-call,session}.ts
  src/__tests__/{http,mcp,auth,revocation,ssrf,approval}.test.ts
  cloudflare.config.ts (then generated wrangler.jsonc)
  SPECS.md
  plan.md
```

## 3. Contract, migration and release gates

- [ ] **Contracts:** strict TS types, JSON Schema, positive/negative fixtures, versioned errors and valid capability negotiation.
- [ ] **Persistence:** list authoritative storage records, unique indexes, state transitions, idempotency, DO transaction ordering and migration rollback. If no DB, explicitly document stateless ownership.
- [ ] **Security:** workspace/principal/grants, least privilege, approval-vs-observation, foreign protocol input validation, secrets redaction and audit. No bypass of existing Gatekeepers.
- [ ] **Failure:** crash-before/after-dispatch, duplicate deliveries, stale revisions/generations, timeout UNKNOWN outcome, pause/stop/revoke and cleanup.
- [ ] **Operability:** bounded concurrency, memory/CPU/IO/time/token/cost quotas, metrics (no prompts/secrets), operator diagnostics and alerts.
- [ ] **Release:** local build/lint/config checks, worker integration/E2E, immutable release test, A/B sticky routing where applicable, canary rollback; no silent breaking schema.
- [ ] **Extraction closure:** for every related Grokbot F-001…F-017/Hub/native behavior, record origin repo/commit/path → target file/tests/staging evidence or explicit defer reason.

## 4. Minimum acceptance

Unauthorized HTTP/MCP, tool scope/excess claims, pending approval, revocation mid-call, content prompt injection and descriptions, replay, API version errors, private network egress not leaked.

**Done only when** every checked item has code and test links, plus an actual release/deploy reference if this package produces a Worker. No long-running autonomous loop or public MCP API is "done" based solely on mocks.



## Mandatory boundary revision (audit 2026-10-13)

See [Existing module authority audit](../../docs/architecture/EXISTING_MODULE_BOUNDARIES_AUDIT.md) and root SPECS §23. **No-overlap rule:** It is an *optional authenticated REST/MCP server export* for already-authorized Workshop capabilities; never a second MCP client/trust engine, Gatekeeper action queue or unscoped direct Task/Runtime API. In particular the existing ExternalMessageGateway trusts callerEmail and MUST NOT be used as public identity admission.

**Required preparatory implementation gates:** Inventory router prefixes /api and /gatekeeper, ExternalMessageGateway trusted-only RPC, and Workshop AuthenticatedApi; design audience-bound revocable ticket and current grant resolver; test tools/list and tools/call against real Gatekeeper action/observation, denial/revocation and anonymous impersonation.

This is a reviewed design constraint. Neither this folder nor its plan constitutes a running module. Every completed plan step must link a source SHA, target commit, real contract/security tests and E2E proof where a Worker/Container is involved.
