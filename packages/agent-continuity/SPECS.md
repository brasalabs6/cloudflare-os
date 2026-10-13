# Agent Continuity Ledger — SPECS

**Kind:** proposed versioned domain projection + Durable Object; implementation pending.
**Traceability:** F11, reconnect/hand-off, loss-of-context recovery.

## Mission

Keep a structured, attributed hand-off record for workspace and agent work: `goal, constraints, decisions, done, now, next, blockers, questions, workingSet, sourceEventCursor`. Unlike an ACP runtime checkpoint, the ledger contains **portable logical context**, not filesystem/process memory. Unlike Tasks/ACP logs, it is a **projection**, not authoritative task/run truth.

## API

`continuity.get({workspaceId,subjectType,subjectAgentId?})` returns snapshot + `version`, provenance, source cursor and `stale` when owner events are newer than the included cursor. `continuity.patch({workspaceId,subject...,expectedVersion,patch,idempotencyKey})` accepts only allowed fields, bounded references and claims. A privileged human correction is attributed and revisioned. `CONTINUITY.md` export can be added as a read-only P1 presentation; imported Markdown never overwrites server state without diff and approval.

## Persistence and correctness

`ContinuityLedger {ledgerId,workspaceId,subjectType,subjectAgentId?,version,goal,constraints,decisions,done,now,next,blockers,questions,workingSet,sourceEventCursor,updatedBy,updatedAt}` plus immutable `ContinuityRevision`. All agent and workspace subjects are validated against Workshop/Directory. Version conflicts fail closed with `VERSION_CONFLICT` and current safe metadata.

An automation reconciler may synthesize text from durable events only as a *new attributed revision*. `done` cannot finish a task, `next` cannot claim a lease, and a local snapshot cannot turn an ACP `OUTCOME_UNKNOWN` into success. Replay after reconnection reads fresh authoritative tasks/messages as well as the ledger, and surfaces stale flags instead of fabricating a consistent summary.

## Security and tests

`continuity:read`/`continuity:write` scoped to actor and workspace; protected reads must authorize observation. Tests cover reconnect without local transcript, stale source cursor, concurrent patches, malicious content, agent-to-workspace escalation, cross-workspace leakage, provenance preservation and no task/run state side effects.
