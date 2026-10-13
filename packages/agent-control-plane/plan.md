# Agent Control Plane — plan.md

> **State:** NOT STARTED (except for source analysis stated below). These are executable work packages, not an assertion of completed code. Implementation must proceed only after prerequisite API reviews, migrations and security approval.

## 0. Inputs, sources and dependencies

**User requirement:** [USER_INPUT_LEDGER U-006/U-007](../../docs/architecture/USER_INPUT_LEDGER.md). **Normative:** [Unified v2](../../docs/architecture/AGENT_PLATFORM_UNIFIED_V2.md), [ACC package](../agent-protocol/SPECS.md), [ACP v1](../../docs/architecture/ACP_CONTRACTS_V1.md). **Feature evidence:** [migration matrix](../../docs/architecture/ACP_MIGRATION_MATRIX.md).

**Destillation sources:** Cloudflare OS Overseer/AgentSpawnerConfig, existing ScheduleDriver, Grokbot session/run lifecycle and Hub task orchestration references. Reuse existing policy without copying Next.js auth/Postgres.

**Dependencies:** preserve existing Workshop kernel authority, current Gatekeeper observer/action approval semantics, current Scheduler hooks and MCP import trust. No inherited auth data is accepted from an untrusted serialized request. Pin source path+commit before porting.

## 1. Ordered implementation steps

- [ ] **P01 — Inventory Overseer activeAgent/callable agent state, existing client types, scheduler occurrence semantics and Cloudflare DO storage/migration conventions; decide non-invasive bridge boundaries.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P02 — Define AgentDefinition/Task/Execution/Delegation/Trigger records, indexes, unique keys and state transitions in ACC schemas; review owner/revision/admission authority.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P03 — Design independent AgentRegistry and Task DO placement plus authenticated service bindings; create package/config with generated Wrangler and release-manifest verification.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P04 — Implement idempotent create/update/pause/archive AgentDefinition with optimistic revision and Workspace-owned policy snapshots.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P05 — Implement task admission for human chat, API, approved schedule occurrence, external hook and parent-agent; persist QUEUED and outbox transactionally before returning.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P06 — Implement task claim/lease/fencing and outbox dispatcher with bounded work per wake; never blindly retry external side effects after an unknown dispatch outcome.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P07 — Implement child-task graph, grant intersection, reserved budget, max depth, max child count and controlled cascade-cancel; reconcile observed native subagents separately.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P08 — Integrate loop driver and runtime/native adapter through ACC v1 without migrating existing Overseer chat state or creating a second session-run authority.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P09 — Implement pause/resume/stop/revoke/expiry/wakeup/compaction and quota accounting, with terminal cleanup and restart recovery.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P10 — Build integration tests across Gatekeeper, Overseer, Scheduler and Runtime; stage one unattended task and one subagent task, test crash/restart and real budget exhaustion.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P11 — Add audit/metrics/diagnostics, typed unknown outcomes and privacy-safe dashboards; gate production release behind staging evidence and rollback tests.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

## 2. Proposed filesystem implementation map

```text
packages/agent-control-plane/
  src/worker.ts
  src/agent-registry-do.ts
  src/task-do.ts
  src/storage/{migrations,definitions,tasks,executions,delegations,outbox}.ts
  src/services/{admission,scope,dispatch,consistency,budgets}.ts
  src/rpc/{agents,tasks,children,events}.ts
  src/__tests__/{idempotency,delegation,crash,grants,budget,revoke}.test.ts
  cloudflare.config.ts (when implementing Worker; Wrangler generated)
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

Task idempotency across schedule redeliveries, concurrent writes/expected revision, crash after outbox before dispatch, stale lease fences, depth/budget caps, pause/resume after restart, per-workspace denial and source-specific retention.

**Done only when** every checked item has code and test links, plus an actual release/deploy reference if this package produces a Worker. No long-running autonomous loop or public MCP API is "done" based solely on mocks.



## Source audit correction / mandatory no-overlap gate — 2026-10-13

**Governing evidence:** [32 existing module audit](../../docs/architecture/EXISTING_MODULE_BOUNDARIES_AUDIT.md), root SPECS.md §23, and current executable source. **Boundary:** Only AgentDefinition + independent Task/Execution/Delegation lineage, task budget and continuation metadata are new authoritative state. Workshop Overseer owns native chat/history/callbacks; Scheduler owns calendar occurrence; Runtime DO owns actual CLI session/run. Task can only reference each, never mirror/overwrite its status as if authoritative.

**Implementation ordering:** Before implementation: propose Task admission API reviewed against AgentSpawnerConfig; define durable task→Overseer accepted-versus-completed receipt; use scheduler scheduleId:runId; test task crash/outbox reconciliation and revocation before creating DO migrations.

**Blockers:** no executable implementation until existing behavior is characterized; module files in this directory are currently planning documents only. For every feature, record source/target authority, typed schema, security negative test, crash/idempotency case and relevant integration evidence. If a proposed API duplicates current authority, revise the proposal first instead of implementing a duplicate.
