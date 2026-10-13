# ADR 0005 — Owner-local transactions, canonical ACC projection, bounded mailbox

**Status:** Proposed for review; implementation pending. **Date:** 2026-10-13. **Supersedes:** original PR #4 draft which introduced a parallel domain audit/event authority.

## Context

Unified v2 already defines ACC AgentEventV1, Control Plane Task/Execution, Overseer chat history, runtime event journals, Scheduler recurrence and Gatekeeper action approvals. A new common DomainEventV1 / Audit DO would compete with those state sources. WorkItem assignment to an offline agent must still durably notify without cross-Durable-Object transactions.

## Decision

Keep canonical state in its existing owner: Control Plane WorkItem/Goal and related outbox; Mailbox messages and receipts (new, minimal authority); workspace structured Memory/Learning if a Context reuse review justifies it. Each owner atomically commits state, idempotency and an **internal outbox**, and consumers dedupe `(source,eventId)` in their local transaction. Publish validated/redacted source events to **existing ACC projection**. No global exactly-once claim or audit master Worker. The existing Workshop notification service remains the delivery mechanism for supported device templates. Keep Task/WorkItem vs ACP Run vs Gatekeeper approval vs Overseer chat history as different data authorities.

## Consequences

WorkItem assignment may be committed while mailbox delivery is pending; client shows both. A continuity summary is a Control Plane projection over source event cursors and is never an executable task/run database. Outbox retry/backoff/dead letters, retention, replay and crash injection are required. Cross-workspace ACL and revocation apply again at the consumer/projection boundary. See [delta contracts](../architecture/MULTIAGENT_MCP_CONTRACTS_V1.md).
