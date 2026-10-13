# Goals & Tasks — SPECS

**Kind:** proposed domain package and workspace-keyed Tasks Durable Object; implementation pending.
**Traceability:** F05–F07, task portion of F15, P03/P04/P06/P10.

## Mission / authority

Own project grouping, goals, business tasks, DAG edges, exclusive task leases, task attempts, evidence and task-specific review. No agent runtime, user auth or message storage belongs here. Every domain operation is invoked through a verified ActorContext. This package owns a **single transactional authority per workspace for task + DAG + claim**, so two concurrent claims cannot both succeed.

## Public domain/MCP capabilities

Reads: `goal.list`, `task.list`, `task.next`, `task.get`.
Mutations: `goal.create`, `goal.update`, `task.create`, `task.update`, `task.dependencies.set`, `task.assign`, `task.claim`, `task.renew_lease`, `task.progress`, `task.submit_result`, `task.review`, `task.fail`, `task.release`.

`task.next` lists **actionable** work as calculated by the server: unfulfilled prerequisites, active blockers, terminal state, unexpired foreign leases, policy/priority, assignment and review constraints. A task is not executable merely because the agent inferred it from a chat prompt. `task.update` cannot forge a status transition or overwrite evidence/history.

## Schema and lifecycle

`Goal`, `Task`, `TaskDependency`, `TaskClaim`, `TaskRun` follow the canonical domain contracts. Statuses are `BACKLOG`, `READY`, `IN_PROGRESS`, `WAITING_APPROVAL`, `REVIEW`, `DONE`, `FAILED`, `CANCELED`. `BLOCKED` is derived, never a contradictory persisted state. Task `version` increments on every mutating transition; `expectedVersion` protects caller edits.

DAG insertion and bulk replacement MUST verify membership of all endpoints in one workspace and reject self-edge/cycle **within the same transaction**. Parent/subtask links require the same workspace. Editing dependencies on claimed tasks must first invoke an explicitly authorized replan/release operation.

## Claim fencing and review

A `claim` transaction requires actionable + expected version + caller eligible/assigned. It stores digest of a newly minted one-time `leaseToken` and an increasing `leaseEpoch`, with expiry. `renew_lease` and work submission require `(taskId,actor,epoch,secret,notExpired)`. Assignment/release/reclaim fences any former epoch. Expiry does not implicitly undo external side effects; agent run outcomes must be correlated and reconciled independently.

`submit_result` with bounded evidence transitions to `REVIEW`. `task.review` requires a distinct, authorized reviewer and DoD satisfaction; high-risk tasks require the human review path. Review is NOT equivalent to a Gatekeeper side-effect approval, or an ACP tool permission approval. A successful ACP `Run` is not proof `Task DONE`.

## Delivery and atomicity

`task.assign` commits `Task` change, `DomainEvent`, `OutboxRecord` and idempotency record locally before returning. Mailbox notification is **eventual**. Source event cursor and delivery status are observable. Duplicate delivery is suppressed downstream by `eventId`. No cross-DO SQL transaction is presumed. A failure after an ambiguous tool invocation must use `OUTCOME_UNKNOWN`/reconciliation, not automatic retry.

## Security / acceptance

Every read requires appropriate `task:read` observation authorization; `task:execute` is restricted to eligible task and active lease; delegation cannot grant child scopes. Validate owner/tenant before leaking task existence. Test:
1. two claims racing yield exactly one current epoch;
2. stale epoch/token/expired lease cannot renew or submit;
3. DAG cycle/self/cross-workspace edge rejection under concurrency;
4. `expectedVersion` and idempotency body mismatch;
5. self-review and high-risk review denial;
6. task assignment commits when Mailbox is unavailable, and later delivers once;
7. task progress/result does not bypass Gatekeeper/ACP approvals;
8. cursor pagination, scope/data leakage and quotas.

Use `../../docs/architecture/MULTIAGENT_MCP_CONTRACTS_V1.md` as proposed canonical contract.
