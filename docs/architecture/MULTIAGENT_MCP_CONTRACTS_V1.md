# Multiagent domain — Canonical contracts v1 (proposal)

**Status:** proposed normative contract for future implementation; no corresponding runtime code has been shipped. **Date:** 2026-10-13.
**Precedence:** root `SPECS.md` and package specs. Keep [ACP execution contracts](./ACP_CONTRACTS_V1.md) authoritative for `Session`, `Run`, `Operation`, `AgentEvent` and ACP approvals.

## 1. IDs and authority

| ID | Issuer/owner | Meaning |
|---|---|---|
| `workspaceId`, `principalId` | Workshop | Human/workspace authorization context |
| `agentId` | Directory | Stable logical agent identity |
| `agentInstanceId` | Directory | Workspace-specific instance; `external` or `managed` |
| `goalId`, `taskId`, `taskRunId` | Goals/Tasks | Business objective, task and task attempt |
| `channelId`, `messageId` | Mailbox | Message stream and message identity |
| `memoryId`, `learningId` | Memory | Versioned knowledge and review proposal |
| `ledgerId` | Continuity | Scoped summary projection |
| `domainEventId` | Owning domain module | Deduplicatable business event |
| `agentSessionId`, `agentRunId`, `sandboxGeneration` | ACP runtime | Managed execution only; never identify a domain principal |

All IDs are opaque, server generated, and scoped/validated by owning modules. A request `workspaceId` selects *where* an operation is performed, never *who* performs it. Timestamps are RFC3339 UTC; versions/sequence/lease epochs are increasing integers.

## 2. Authenticated context and normalized operations

```typescript
type ActorContext = {
  principalId: string;  // trusted ingress identity, never agent-supplied
  actorKind: "human" | "agent" | "platform";
  workspaceId: string;
  agentId: string | null;
  credentialId: string | null;
  grantedScopes: string[];
  correlationId: string;
};
type DomainErrorCode =
  | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID_INPUT"
  | "VERSION_CONFLICT" | "LEASE_CONFLICT" | "LEASE_EXPIRED"
  | "DEPENDENCY_BLOCKED" | "DEPENDENCY_CYCLE" | "APPROVAL_REQUIRED"
  | "IDEMPOTENCY_MISMATCH" | "OUTCOME_UNKNOWN"
  | "RATE_LIMITED" | "QUOTA_EXCEEDED" | "WORKSPACE_DISABLED";
type DomainFailure = {
  ok: false; error: {code: DomainErrorCode; message: string; retryable: boolean};
  requestId: string;
};
```

A secure first-party RPC adapter constructs `ActorContext` from existing Workshop capabilities. The MCP adapter constructs it only after bearer-token/OAuth resource validation, audience, expiry, workspace membership and the exact tool/resource grant. Never accept caller-provided scopes, principalId or agentId as authority. Return redacted NOT_FOUND when necessary to prevent cross-workspace enumeration.

## 3. Stable domain state

### Agent

`AgentDefinition`: `agentId, ownerPrincipalId, displayName, status, defaultHarnessId?, policyProfileId?, version`. `AgentWorkspaceGrant`: `workspaceId, agentId, scopes, state, version`. `AgentInstance`: `agentInstanceId, workspaceId, agentId, executionMode, parentAgentInstanceId?, parentTaskId?, spawnDepth, agentSessionId?, status`. External registration/credentials never imply active process. Heartbeat presence derives from a server-measured TTL; `online` does not imply idle.

### Goals and tasks

`Goal`: `goalId, workspaceId, projectId?, title, desiredOutcome, definitionOfDone, status, version`.
`Task`: `taskId, workspaceId, goalId?, parentTaskId?, title, description, acceptanceCriteria[], priority, assigneeAgentId?, status, version, evidenceRefs[], createdAt, updatedAt`.
`TaskDependency`: `workspaceId, taskId, prerequisiteTaskId`. Dependencies are a directed acyclic graph; cross-workspace edges and self-cycles fail before mutation.
`TaskClaim`: `taskId, agentId, leaseEpoch, leaseTokenDigest, expiresAt` (store only the token digest). `TaskRun`: `taskRunId, taskId, leaseEpoch, agentRunId?, outcome, evidenceRefs[]`.

Persisted task states: `BACKLOG | READY | IN_PROGRESS | WAITING_APPROVAL | REVIEW | DONE | FAILED | CANCELED`. `BLOCKED` is *derived* from missing prerequisite completions and explicit blocker references, never a conflicting manually persisted state. Dependency recomputation can render a READY task not actionable.

Permitted transitions (minimum): `BACKLOG -> READY` when requirements allow; `READY -> IN_PROGRESS` only through an exclusive claim; `IN_PROGRESS -> REVIEW` via valid lease and evidence; `REVIEW -> DONE` on authorized independent review or declared auto-review policy; `REVIEW -> READY` on requested changes; `IN_PROGRESS -> FAILED`; cancel from nonterminal states under authorized policy. Terminal states do not silently reopen. Expired claims are fenced before any write.

Claims: one task owner transactionally; increment `leaseEpoch` on every new claim/ownership change. `task.claim` compares `expectedVersion`, issues secret token once, stores its digest and expiry, commits owner/status/version; `renew_lease`/`progress`/`submit_result` verify epoch, token, owner and expiry. Old epoch is invalid even if old bearer token was replayed. Replay of a successful idempotent claim must not expose an already invalid lease token; reauthenticate/reclaim as policy permits.

### Mailbox

`Channel`: `channelId, workspaceId, kind: "direct"|"workspace", createdAt, nextSequence`. `Message`: `messageId, channelId, channelSequence, senderPrincipalId, body, kind, taskId?, createdAt`. `RecipientReceipt`: `messageId, recipientPrincipalId, deliveredAt?, ackedAt?`. Sending + initial recipient receipts commits atomically within the Mailbox owner. Ordering is total within each channel, not global. `ack` means received/read, never executed. An unconnected agent reads its own backlog through `message.pull` after reconnect.

### Memory / Learning / Continuity

`Memory`: `memoryId, workspaceId, scope, category, body, provenanceRefs[], status, revision, createdBy, updatedAt` and immutable `MemoryRevision`s. No automatic promotion of untrusted source content to instructions. `LearningProposal`: `learningId, workspaceId, statement, sourceRefs[], confidence, status: "PROPOSED"|"APPROVED"|"REJECTED", reviewedBy?, revision`; approver must meet policy and cannot merely self-assert a fact.

`ContinuityLedger`: `ledgerId, workspaceId, subjectType: "workspace"|"agent", subjectAgentId?, version, goal, constraints, decisions, done, now, next, blockers, questions, workingSet, sourceEventCursor, updatedBy, updatedAt`. Every patch requires `expectedVersion`; stale indicator if events outpace `sourceEventCursor`. It is an attributed projection: changing "done" cannot mutate a Task or ACP state.

## 4. Local transaction, idempotency and event envelope

All mutations with observable effect MUST implement an owning-DO transaction that couples canonical state, idempotency result, redacted audit event and outbox entries. `(principalId, operation, idempotencyKey)` is unique per workspace; same key + same canonical request digest returns prior reference/result when still valid; changed digest returns `IDEMPOTENCY_MISMATCH`. No distributed SQL transaction is claimed.

```typescript
type DomainEventV1 = {
  schemaVersion: 1;
  eventId: string;
  workspaceId: string;
  entityType: string;
  entityId: string;
  entityVersion: number;
  eventType: string;
  actorPrincipalId: string;
  correlationId: string;
  causationId: string | null;
  occurredAt: string;
  redactedPayload: Record<string, unknown>;
};
type OutboxRecord = {
  eventId: string; targetModule: string; attemptCount: number;
  nextAttemptAt: string; deliveredAt: string | null;
};
```

Consumer inbox has unique `(sourceModule,eventId)`. Retry with bounded exponential backoff, publish/replay cursors and a visible dead-letter/repair state. For `task.assign`, transaction commits task + outbox; a Mailbox consumer later atomically inserts notification/receipts and dedupe key. Status MUST distinguish task-committed from message-delivered. Retention/compaction MUST preserve dedupe safety over the retry horizon.

## 5. Agent-facing MCP tool names (candidate v1)

Exact public names, each backed by a domain service and reviewed scope + input/output schema:

| Domain | Tools | Required scopes (representative) |
|---|---|---|
| Identity | `agent.whoami`, `agent.heartbeat`, `agent.list`, `workspace.list`, `workspace.get` | authenticated, `agent:heartbeat`, `agent:read`, `workspace:read` |
| Goals | `goal.list`, `goal.create`, `goal.update` | `goal:read` / `goal:write` |
| Tasks | `task.list`, `task.next`, `task.get`, `task.create`, `task.update`, `task.dependencies.set`, `task.assign`, `task.claim`, `task.renew_lease`, `task.progress`, `task.submit_result`, `task.review`, `task.fail`, `task.release` | `task:read` / `task:write` / `task:delegate` / `task:execute` / `task:review` |
| Messages | `message.send`, `message.pull`, `message.ack`, `message.list` | `message:send` / `message:read` |
| Memory | `memory.search`, `memory.get`, `memory.create`, `memory.revise`, `learning.propose`, `learning.list` | `memory:read` / `memory:write` / `learning:propose` / `learning:read` |
| Continuity | `continuity.get`, `continuity.patch` | `continuity:read` / `continuity:write` |
| Governance | `approval.request`, `event.list` | `approval:request` / `event:read` |

*Human-only in MVP*: credential issuance, workspace grants, approval decisions, arbitrary shell execution, unrestricted agent spawn and administrative policy changes. A resource/tool listing carries **no authority**. MCP tasks extension, when supported, is protocol request bookkeeping and MUST NOT be confused with business `Task`.

Remote resources proposed: `multiagent://workspaces/{workspaceId}/overview`, `.../continuity`, `.../policies`, `.../agents/{agentId}/continuity`; authorization occurs on each read.

### Representative request/response shapes

```json
{"tool":"task.claim","arguments":{"workspaceId":"ws_opaque","taskId":"task_opaque","expectedVersion":3,"idempotencyKey":"claim-01"}}
```

```json
{"ok":true,"taskId":"task_opaque","taskVersion":4,"status":"IN_PROGRESS","leaseEpoch":2,"leaseToken":"one-time-secret","expiresAt":"2026-10-13T18:00:00Z"}
```

```json
{"tool":"message.send","arguments":{"workspaceId":"ws_opaque","toPrincipal":{"type":"agent","id":"agent_opaque"},"kind":"task_handoff","taskId":"task_opaque","body":"Ready for review","idempotencyKey":"handoff-01"}}
```

```json
{"ok":false,"error":{"code":"LEASE_CONFLICT","message":"Task already claimed","retryable":false},"requestId":"req_opaque"}
```

All schemas are **illustrative proposals**, not yet generated validators. Before implementation, publish exact JSON Schema + TypeScript types + negative contract fixtures; keep wire naming consistent (camelCase in this target; implement explicit adapters if importing legacy snake_case clients).

## 6. Reviews, approvals and execution mapping

Task reviewer MUST be distinct from the submitting agent and satisfy `task:review`, risk policy and DoD checks. Task review is not permission to bypass Workshop's Gatekeeper applyAction or ACP `session/request_permission`. Platform-side `approval.request` records a request, never decides it; the human Workshop approval mechanism remains authoritative.

For managed execution: `TaskRun.agentRunId` is a foreign correlation to ACP; no task status transition follows from ACP status alone. A `SUCCEEDED` ACP run does not automatically mean `Task DONE`. `OUTCOME_UNKNOWN` remains indeterminate and forbids blind retry of side effects.

## 7. Mandatory acceptance cases

- Cross-workspace reads, resources, web UI lists and writes all fail closed.
- Two concurrent `task.claim` calls produce one valid lease epoch; stale lease/owner cannot mutate.
- Cycle insertion/cross-workspace dependency rejected transactionally.
- Message send + receipts atomic; reconnect returns offline inbox without duplicates; ack idempotent.
- `task.assign` followed by Mailbox failure leaves task committed and outbox pending; retries deliver one notification.
- Memory provenance/revision conflicts and self-approved learning are rejected.
- Continuity replay after disconnect marks stale source cursor and never overrides task state.
- Unknown/changed idempotency key body conflict is detectable.
- MCP/auth client conformance across documented protocol versions and Cap'n Web parity.
