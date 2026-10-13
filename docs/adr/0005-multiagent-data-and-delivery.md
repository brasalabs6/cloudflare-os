# ADR 0005 — Independent domain authorities with durable outbox

**Status:** Proposed for review; not implemented. **Date:** 2026-10-13.

## Context

Tasks need transactional claims/leases and cycle-safe dependencies. Messaging needs durable per-channel ordering/recipient receipts; memory and continuity have different revision lifecycles. If independent modules use distinct Durable Objects, a cross-module mutation cannot assume a shared ACID transaction. A single monolithic coordination DO would simplify atomicity but couple throughput, deploys and schemas.

## Decision

Use owning SQLite-backed Durable Objects per workspace and bounded domain: keep tasks + goals + DAG + lease ledger in one task authority; keep message channels, messages and receipts in one mailbox authority per consistent shard; memory/learning and continuity are separate logical owners. An owner transaction commits canonical state, idempotency record, audit event and outbox record together. Deliver to other modules at least once with `eventId` dedupe, retry/backoff, reconciliation, dead-letter visibility and no externally advertised exactly-once guarantee. Replays never silently redo potentially ambiguous side effects. Eventual cross-domain projections may lag their authoritative source.

An implementation MAY co-deploy logical modules where this reduces operational overhead; shared Worker deployment is not permission for direct cross-module storage writes. The ACP SessionRuntime DO remains separate and sole run-state authority.

## Consequences

- Task assignment and mailbox notification can temporarily disagree; expose pending delivery status.
- Cross-workspace listing is separately authorized fan-out or a non-authoritative projection.
- Reconciliation, dedupe retention, event schema migration and crash injection tests are required gates.
- Checkpoint, memory and continuity are distinct: filesystem restore is not ACP process restore, and a continuity note is never task/run truth.
- See `../architecture/MULTIAGENT_MCP_CONTRACTS_V1.md` for state and event invariants.
