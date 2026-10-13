# Agent Loop Engines — plan.md

> **State:** NOT STARTED (except for source analysis stated below). These are executable work packages, not an assertion of completed code. Implementation must proceed only after prerequisite API reviews, migrations and security approval.

## 0. Inputs, sources and dependencies

**User requirement:** [USER_INPUT_LEDGER U-006/U-007](../../docs/architecture/USER_INPUT_LEDGER.md). **Normative:** [Unified v2](../../docs/architecture/AGENT_PLATFORM_UNIFIED_V2.md), [ACC package](../agent-protocol/SPECS.md), [ACP v1](../../docs/architecture/ACP_CONTRACTS_V1.md). **Feature evidence:** [migration matrix](../../docs/architecture/ACP_MIGRATION_MATRIX.md).

**Destillation sources:** Existing Workshop runAgentLoopContinue in packages/workshop-backend/src/agent.ts, Overseer alarms; existing Gatekeeper Scheduler time recurrence and Grokbot lifecycle.

**Dependencies:** preserve existing Workshop kernel authority, current Gatekeeper observer/action approval semantics, current Scheduler hooks and MCP import trust. No inherited auth data is accepted from an untrusted serialized request. Pin source path+commit before porting.

## 1. Ordered implementation steps

- [ ] **P01 — Trace pi-agent-core inner loop, current Overseer turn contract, Scheduler recurrence and Task DO wakeup separately; document where each type of loop lives.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P02 — Design LoopPolicy schema, LoopStrategy SPI, typed decisions and bounded execution envelopes with deterministic inputs.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P03 — Implement single-turn strategy first so CLI and native agents share termination semantics without altering their inner algorithms.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P04 — Add until-done and plan-execute strategy with explicit completion predicate and iteration limits, never a process-level infinite while loop.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P05 — Add reactive and periodic continuation by returning durable SLEEP until wakeup; reuse Scheduler for user time/calendar triggers, not for internal execution steps.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P06 — Implement atomic budget debiting and child reservation decisions; enforce quotas at decision and dispatch boundaries.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P07 — Handle failure/backoff and UNKNOWN outcome as distinct states; add operator review and manual resume paths.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P08 — Write fake clock/property tests, real Task DO recovery tests and regression against native Workshop chat loop compaction and callbacks.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

- [ ] **P09 — Publish plugin strategy registration, capabilities and staging proof of a multi-hour independently resuming task with no browser connected.**
  - Deliverable: source/code change or schema plus focused test fixture and exact path/commit trace.
  - Gate: reviewer checks backward compatibility, security boundary and that evidence is stored in the migration ledger.

## 2. Proposed filesystem implementation map

```text
packages/agent-loop/
  src/{types,policy,registry,runner,budget,decision}.ts
  src/strategies/{single-turn,until-done,periodic,reactive,plan-execute}.ts
  src/__tests__/{iterations,retry,budget,restart,termination}.test.ts
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

Loop strategies with fake clock, budget exhaustion, spinning prevention, crash-between-steps, wake idempotency, unknown outcome, child limits, owner revocation and existing agent-core step semantics.

**Done only when** every checked item has code and test links, plus an actual release/deploy reference if this package produces a Worker. No long-running autonomous loop or public MCP API is "done" based solely on mocks.

