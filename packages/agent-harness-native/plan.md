# Workshop Native Engine Adapter — plan.md

> **State:** NOT STARTED (except for source analysis stated below). These are executable work packages, not an assertion of completed code. Implementation must proceed only after prerequisite API reviews, migrations and security approval.

## 0. Inputs, sources and dependencies

**User requirement:** [USER_INPUT_LEDGER U-006/U-007](../../docs/architecture/USER_INPUT_LEDGER.md). **Normative:** [Unified v2](../../docs/architecture/AGENT_PLATFORM_UNIFIED_V2.md), [ACC package](../agent-protocol/SPECS.md), [ACP v1](../../docs/architecture/ACP_CONTRACTS_V1.md). **Feature evidence:** [migration matrix](../../docs/architecture/ACP_MIGRATION_MATRIX.md).

**Destillation sources:** packages/workshop-backend/src/agent.ts, overseer.ts, agent-compaction.ts, packages/workshop-shared/src/api.ts AgentSpawnerConfig; @earendil-works/pi-agent-core.

**Dependencies:** preserve existing Workshop kernel authority, current Gatekeeper observer/action approval semantics, current Scheduler hooks and MCP import trust. No inherited auth data is accepted from an untrusted serialized request. Pin source path+commit before porting.

## 1. Ordered implementation steps

- [ ] **P01 — Map all native agent events, runAgentHooks, AgentSpawnerConfig/spawnCallable semantics, tool approval and step persistence barriers with source references.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P02 — Define native EngineDescriptor capabilities and explicit differences versus ACP (executeCode binding, provisional gadget edits, worktree, compression).**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P03 — Create adapter scaffolding outside kernel and thin typed Overseer integration seam; avoid circular dependencies and review all new kernel API diffs.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P04 — Implement startTurn / cancel / observe / reconcile via existing agent turn methods, never mutate ChatHistory or bypass Overseer.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P05 — Normalize native message/tool/approval/usage/compaction events with stable source cursors and privacy flags into ACC schemas.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P06 — Expose existing callable spawner as a source for independent Tasks and bound child tasks while preserving env snapshots and task-specific stubs.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P07 — Verify observation/action hook semantics, user model configuration and credential retrieval remain in Workshop authority.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P08 — Run characterization tests against current chat UI, step barriers, compaction, restart, sharing, file edits and callbacks before/after the adapter.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P09 — Stage one chat-triggered and one scheduler-triggered native engine task alongside CLI tasks; compare event projections without regressions.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

## 2. Proposed filesystem implementation map

```text
packages/agent-harness-native/
  src/{index,driver,capabilities,event-mapper,callable-spawner-bridge,approval-map}.ts
  src/__tests__/{chat-parity,approval,spawner,compaction,replay,callbacks}.test.ts
  packages/workshop-backend/src/agent-platform/{bridge,projection}.ts (integration seam only)
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

Existing chat/AgentSpawner tool parity, callbacks queued behind turn, compaction restoration, apply/reject actions, shared observer permissions, model-private replay, no duplicate tool call on resume.

**Done only when** every checked item has code and test links, plus an actual release/deploy reference if this package produces a Worker. No long-running autonomous loop or public MCP API is "done" based solely on mocks.

