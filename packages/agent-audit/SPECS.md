# Multiagent Audit, Events and Outbox — SPECS

**Kind:** proposed shared event contract + authorized audit projection; implementation pending.
**Traceability:** F12, F15–F16; AC14–AC16.

## Authority

Each owning domain module persists its own local append-only event/outbox entries transactionally with the action. `agent-audit` provides the schema, redaction/correlation conventions, authorized `event.list` projection, delivery instrumentation and reconciliation diagnostics. It is **not** a central transactional database, and must never supersede ACP `AgentEvent` or Gatekeeper action history.

`DomainEventV1 {schemaVersion,eventId,workspaceId,entityType,entityId,entityVersion,eventType,actorPrincipalId,correlationId,causationId,occurredAt,redactedPayload}`. Event payload includes no bearer tokens, lease tokens, full prompts, secrets, unbounded message body or confidential provider replies. Version all types and reject unknown majors.

## Delivery lifecycle

A producer commits `OutboxRecord(eventId,targetModule,attemptCount,nextAttemptAt,deliveredAt?)` in the same local SQLite transaction as its canonical mutation. Dispatcher wakes via DO alarm/authorized queue and sends signed/service-bound event to the consumer, which atomically records `ConsumedEvent(sourceModule,eventId)` with its effect. ACK occurs **after** consumer commit. Crash or network timeout triggers bounded retry with exponential backoff; duplicates are harmless; exhausted delivery moves to an observable repair/dead-letter state. Never infer exactly-once end-to-end execution or retry ambiguous external actions.

`event.list` accepts workspace filters, source/entity/actor/event-type and opaque cursor; it returns only redacted, authorized events and a `hasMore` flag. For cross-workspace admin consoles, use separately authorized aggregation; generated cursors cannot cross tenant boundaries. Link managed run telemetry by correlation IDs, not by treating ACP events as the same schema.

## Governance and tests

Audit rows should preserve decision reason, policy version and caller source. A denial can be counted without revealing the target's data to unauthorized principal. Define retention/export/restore under workspace policy, with tested checksums and schema migrations. Tests must inject producer crash before commit, producer crash after commit, consumer crash after commit/before ACK, reordered messages, duplicates and exhausted retries. Verify no secret leakage via logs, events, error messages, metrics or export.
