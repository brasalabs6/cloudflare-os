# Multiagent coordination delta contracts v1 — ACC/ACP-compatible proposal

**Status:** design-only; executable schemas not yet generated. **Date:** 2026-10-13.
**Parent:** [Unified Agent Platform v2](./AGENT_PLATFORM_UNIFIED_V2.md); canonical event/control SPI [agent-protocol](../../packages/agent-protocol/SPECS.md); sandbox run [ACP_CONTRACTS_V1](./ACP_CONTRACTS_V1.md).
**Do not redeclare:** `AgentDefinition`, execution `Task`, `Execution`, `AgentEventV1`, `AgentCommandV1`, `EngineDriver`, `Session` or `Run`. Those already have owners in v2/ACP.

## 1. Contract model

- Workshop `workspaceId` and principal/grants come from authenticated Workshop identity and policy, never bearer-like IDs in tool input.
- v2 `agentId`, `taskId` (execution), `executionId` and `agentRunId` remain owned by Control Plane/Runtime.
- **New** `goalId`, `workItemId`, `workClaimEpoch`, `workItemReviewId` are Control Plane *workboard* identities. Public PDR MCP `task.*` tool family maps to WorkItem, not the v2 execution Task. `Task.workItemId?` is a proposed **versioned foreign correlation**, not a shared primary key.
- `channelId`/`messageId` are Mailbox-scoped; `memoryId`/`learningId` refer only to workspace facts/review, not Context collection/document IDs.
- Continuity source uses ACC event cursor/vector and **projection revision**, never replaces ACP checkpoint or Overseer chat compaction.

## 2. Proposed Workboard additions inside agent-control-plane

```typescript
type Goal = {
  schemaVersion:1; goalId:string; workspaceId:string; projectId:string|null;
  title:string; desiredOutcome:string; definitionOfDone:string[];
  state:"ACTIVE"|"COMPLETED"|"CANCELLED"; revision:number;
};
type WorkItem = {
  schemaVersion:1; workItemId:string; workspaceId:string;
  goalId:string|null; parentWorkItemId:string|null;
  title:string; description:string; acceptanceCriteria:string[];
  priority:number; assigneeAgentId:string|null; revision:number;
  state:"BACKLOG"|"READY"|"CLAIMED"|"REVIEW"|"DONE"|"FAILED"|"CANCELLED";
  evidenceRefs:string[]; lastExecutionTaskId:string|null;
};
type WorkItemDependency = {
  schemaVersion:1;workspaceId:string;workItemId:string;prerequisiteWorkItemId:string
};
type WorkItemClaim = {
  workItemId:string; agentId:string; leaseEpoch:number;
  leaseTokenDigest:string; leaseExpiresAt:string
};
type WorkItemReview = {
  reviewId:string;workItemId:string;submittedByAgentId:string;
  reviewerPrincipalId:string|null;decision:"PENDING"|"ACCEPTED"|"CHANGES_REQUESTED"|"REJECTED";
  evidenceRefs:string[];reviewedAt:string|null
};
```

`READY` is only actionable if DAG prerequisites and explicit blocker policy allow it. `BLOCKED` may be derived, not a competing stored state. Edges must remain acyclic inside one workspace, validated in same Tasks/Workboard owner transaction. A claim is exclusive with monotonic `leaseEpoch`, secret digest (one-time token returned to claimer), actor+expiry validation on every mutation. A stale lease cannot submit result or release another owner's work. A reviewer must be distinct from the submitting agent; high-risk approval stays human-only.

An accepted WorkItem creates/links a v2 Control Plane `Task` only by explicit authorized dispatch; physical `Execution` success is not WorkItem `DONE` without required review. ACP `OUTCOME_UNKNOWN` remains indeterminate.

**Naming compatibility:** the existing v2 `Task` state values (QUEUED/CLAIMED/RUNNING/...) and its `Execution` lease/fence are unchanged. The WorkItem's separate claim is a business assignment lease; its lifetime never controls a CLI process or changes runtime generation.

## 3. Mailbox — the only missing offline-message authority

```typescript
type Channel = {
  schemaVersion:1;channelId:string;workspaceId:string;
  kind:"direct"|"workspace";sequence:number;createdAt:string
};
type ChannelMember = {channelId:string;principalId:string;role:"member"|"moderator"};
type MailMessage = {
  schemaVersion:1;messageId:string;channelId:string;
  channelSequence:number;senderPrincipalId:string;
  kind:"text"|"task_notice"|"handoff";body:string;workItemId:string|null;createdAt:string
};
type MailReceipt = {
  messageId:string;recipientPrincipalId:string;
  deliveredAt:string|null;ackedAt:string|null
};
```

`message.send` atomically appends message/receipt rows and checks membership; `message.pull` returns recipient-only unread/cursor page; `message.ack` marks only own receipts; `message.list` returns authorized channel history. Per-channel sequence is ordered; no global order claimed. All bodies are untrusted data. Never reuse `ExternalMessageGateway` keys to authenticate agents and never treat a mailbox notice as a callable agent RPC. Existing chat remains separate.

## 4. Structured workspace memory and reviewed learning

```typescript
type WorkspaceFact = {
  schemaVersion:1;memoryId:string;workspaceId:string;subjectAgentId:string|null;
  statement:string;tags:string[];sourceRefs:string[];revision:number;
  status:"ACTIVE"|"ARCHIVED";createdByPrincipalId:string;updatedAt:string
};
type LearningProposal = {
  schemaVersion:1;learningId:string;workspaceId:string;statement:string;
  sourceRefs:string[];confidence:number;revision:number;
  status:"PROPOSED"|"APPROVED"|"REJECTED";reviewedByPrincipalId:string|null
};
```

This is **not** a ContextDocument, skills store, generic content editor or new second full-text library. Reuse Context Gatekeeper for user-private/domain-public documents and verified evidence reads. New workspace facts require their own verified workspace ACL and revision policy; human-reviewed promotion to Context, if offered, uses its reviewed **management** interface, not a forged agent write permission. Before implementing `agent-memory` persistence, compare a safe Context extension against a scoped new DO and record the security tradeoff.

## 5. Continuity is a Control Plane read model

```typescript
type ContinuityProjection = {
  schemaVersion:1;workspaceId:string;subjectAgentId:string|null;revision:number;
  goal:string;constraints:string[];decisions:string[];done:string[];
  now:string[];next:string[];blockers:string[];questions:string[];
  workingSetRefs:string[];sourceAccCursor:string;updatedByPrincipalId:string;
  stale:boolean;updatedAt:string
};
```

`continuity.get` reads the projection and marks stale if source ACC events outrun the cursor. `continuity.patch` records an attributed revision with compare-and-set. This is a summary, **not** an alternate `Task`/WorkItem/run database or a replacement for Overseer chat compaction.

## 6. One catalog, one event model, scoped PDR aliases

All tool descriptions, schemas, names, scopes and stable IDs belong in **agent-tool-registry**. Public remote MCP/HTTP transport belongs in **agent-tool-gateway**; first-party RPC uses verified Workshop bindings to the same service. Candidate PDR aliases:

| MCP family | Actual owner/domain RPC | Notes |
|---|---|---|
| `agent.whoami/heartbeat/list`, `workspace.list/get` | Workshop (grants) + Control Plane | no second agent-directory; no agent-supplied principal |
| `goal.*`, `task.*` | Control Plane **Workboard** (`Goal`/`WorkItem`) | never alias to execution `Task`; error on ambiguous IDs |
| `message.*` | Mailbox | independent channels/inbox; authorized recipient |
| `memory.*`, `learning.propose/list` | workspace structured facts/learning | Context docs via separate authorized resource; human reviews only |
| `continuity.get/patch` | Control Plane ACC projection | snapshot, version/provenance and stale marker |
| `event.list` | ACC projection + existing audit sources | read-only, no second event store authority |
| `approval.request` | Existing Workshop approval mechanism **only if exact resource/action is registered** | no generic arbitrary approval bypass |

Server-side policy classification, current grant and input schema are validated on every call; tools/list is no authority. Mutations require stable idempotency + expectedRevision where applicable. Resource URIs are selectors, not access grants. Require JSON Schema 2020-12 + TS fixtures, strict parser bounds, schemaVersion and negative examples before implementing.

**Canonical event rule:** v2 `AgentEventV1` is the only cross-engine presentation model. Domain owners may atomically persist private outbox events, but MUST project through validated ACC source mapping and dedupe; no separate public `DomainEventV1` schema or independently writable audit timeline.

## 7. Separate approvals and failure/replay

- WorkItem review is business acceptance, not provider action permission.
- Workshop Gatekeeper `submitAction`/`applyAction` controls external side effects and `authorizeObservation` controls protected reads.
- ACP `session/request_permission` controls a specific runtime tool call and generation.
- Agent/tool gateway is never allowed to decide any of the above on behalf of a caller.
- Transactions are owner-local. Control Plane WorkItem assignment + outbox and Mailbox notification are eventually consistent with `eventId` consumer dedupe; no cross-DO ACID guarantee.
- Unknown physical outcome, stale generation, revoked agent or expired lease are distinct terminal/reconciliation cases. Do not replay ambiguous side effects.

## 8. Required regression tests

Exact v2 ACC/Task and Workshop/Overseer compatibility; WorkItem-vs-Task ID confusion; two racing WorkItem claims; cycle + cross-workspace edge; mailbox send/receipt/ack/replay; Context observer/scope isolation; memory revocation/revision/learning self-approval; ACC replay dedupe + source order; Gatekeeper action-vs-business review; browser/native/MCP parity; approved Scheduler occurrence and autonomous budget controls.
