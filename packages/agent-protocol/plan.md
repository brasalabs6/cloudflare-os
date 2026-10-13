# Agent Control Contract (ACC) — plan.md

> **State:** NOT STARTED (except for source analysis stated below). These are executable work packages, not an assertion of completed code. Implementation must proceed only after prerequisite API reviews, migrations and security approval.

## 0. Inputs, sources and dependencies

**User requirement:** [USER_INPUT_LEDGER U-006/U-007](../../docs/architecture/USER_INPUT_LEDGER.md). **Normative:** [Unified v2](../../docs/architecture/AGENT_PLATFORM_UNIFIED_V2.md), [ACC package](../agent-protocol/SPECS.md), [ACP v1](../../docs/architecture/ACP_CONTRACTS_V1.md). **Feature evidence:** [migration matrix](../../docs/architecture/ACP_MIGRATION_MATRIX.md).

**Destillation sources:** Cloudflare OS packages/workshop-backend/src/agent.ts and packages/workshop-shared/src/api.ts; Grokbot services/sandbox-runtime/tools/acp-smoke.mjs; Hub src/runtime/acp/acp-client.manager.ts.

**Dependencies:** preserve existing Workshop kernel authority, current Gatekeeper observer/action approval semantics, current Scheduler hooks and MCP import trust. No inherited auth data is accepted from an untrusted serialized request. Pin source path+commit before porting.

## 1. Ordered implementation steps

- [ ] **P01 — Inventory the existing pi-agent-core events, AiChatStreamEvent and AgentSpawnerConfig; record current tests and commit hashes; enumerate ACP/session/update and native protocol messages without assuming they are equivalent.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P02 — Write authoritative ACC TS discriminated unions and schema files for AgentDefinition/Task/Execution/AgentEvent/AgentCommand; specify major-version handling, nullability, upper bounds and machine-readable errors.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P03 — Define EngineDriver SPI with explicit lifecycle, capability/permission negotiation and opaque engine-local IDs; require discriminated UNSUPPORTED_CAPABILITY paths.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P04 — Build separate native/ACP/provider event translators and source-provenance mapping without coupling the library to Workshop Backend, DOM, Node streams or container APIs.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P05 — Implement deterministic projection sequencing, source event deduplication, replay cursor semantics and gap detection; define projection outbox for cross-DO bridging.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P06 — Add capability enforcement tests, event fixtures and compatibility snapshots; reject unsafe reasoning/raw credentials in client projection.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P07 — Test a temporary adapter against the existing Workshop engine without changing its authoritative stored chat model; compare current UX and durable behavior.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P08 — Publish package exports, schema stability policy, generated types and downstream migration review; declare API frozen only after consumer contract tests.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

## 2. Proposed filesystem implementation map

```text
packages/agent-protocol/
  src/index.ts
  src/contracts/{agent,task,execution,event,command,capabilities}.ts
  src/schema/{agent,task,execution,event,command}.schema.json
  src/engines/{driver,registry,compatibility}.ts
  src/projection/{native,acp,provider-extension,replay}.ts
  src/__tests__/{schema,roundtrip,ordering,capabilities,extensions}.test.ts
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

Event normalization equivalence between Workshop/pi, Grok ACP, Codex ACP/native and OpenCode ACP fixtures; property tests for event ordering/dedup, incompatible schemas, unknown extension, protected reasoning data and serialization Cap'n Web versus JSON.

**Done only when** every checked item has code and test links, plus an actual release/deploy reference if this package produces a Worker. No long-running autonomous loop or public MCP API is "done" based solely on mocks.



## Source audit correction / mandatory no-overlap gate — 2026-10-13

**Governing evidence:** [32 existing module audit](../../docs/architecture/EXISTING_MODULE_BOUNDARIES_AUDIT.md), root SPECS.md §23, and current executable source. **Boundary:** ACC is a schema/event+EngineDriver semantic adapter only. Browser Cap'n Web and Gatekeeper public interfaces are exclusively defined in workshop-shared. Native pi-agent-core and ACP transports retain their original authoritative message/state records.

**Implementation ordering:** Before implementation: map AiChatStreamEvent, pi AgentEvent and existing Cap'n Web response/error shapes; prove generated ACC events are read projections; create sourceEventId + projectionCursor dedup fixtures; do not persist a second chat history.

**Blockers:** no executable implementation until existing behavior is characterized; module files in this directory are currently planning documents only. For every feature, record source/target authority, typed schema, security negative test, crash/idempotency case and relevant integration evidence. If a proposed API duplicates current authority, revise the proposal first instead of implementing a duplicate.
