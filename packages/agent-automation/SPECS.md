# Multiagent Automation Controller — SPECS

**Kind:** proposed durable orchestration/policy module; implementation pending.
**Traceability:** optional managed-execution extension E01/E02/E07 and core F15/F16, P02/P05/P07.
**Dependency:** new ACP runtime is separately specified but not implemented in `../agent-runtime/SPECS.md`.

## Mission

Bridge durable domain work to **explicitly available** executors under approved scheduling and policy. Coordination MVP runs without this bridge: external MCP clients poll task/message tools and may stay offline indefinitely. A registered/assigned task MUST NOT pretend to start its external harness.

## Wake intents and bounded loops

`WakeIntent {wakeId,workspaceId,agentInstanceId,sourceType,sourceEventId,requestedAt,idempotencyKey,state,budgetReservationId?,agentRunId?}`. States: `QUEUED, ADMITTED, DISPATCHING, RUNNING, WAITING_APPROVAL, IDLE, PAUSED, BUDGET_EXHAUSTED, FAILED, STOPPED, OUTCOME_UNKNOWN`. Persist every state transition with optimistic version/transaction and audit event. A unique `(instanceId,sourceEventId,wakeKind)` prevents duplicate wake admission. A stopped, revoked or budget-exhausted instance is never scheduled again without a new authorized policy change.

The controller evaluates workspace policy, agent/parent scopes, trigger provenance, quota, concurrent run count, deadline, max iterations, token/time/cost ceilings, fanout and kill switch before dispatch. Scheduling uses **approved persistent hooks** from existing `gatekeeper-scheduler`, not a parallel unsigned cron registry. For completion callbacks or domain outbox events, dedupe and reconcile to avoid loops. Containers never have to remain running between bounded turns.

## Executor separation

For `executionMode=managed`, use an authenticated narrow Coding Agents capability and existing private `agent-runtime` service to create/start a pinned ACP session/run. Record `agentSessionId` and `agentRunId` only after the runtime acknowledges acceptance. The runtime's SessionRuntime DO is authoritative for run/operation state, generation, event journal and uncertain outcome; this controller must not recreate it. `OUTCOME_UNKNOWN` requires reconciliation before retrying physical execution. For `executionMode=external`, only mark work available in mailbox/tasks; never attempt network push by assumption.

ACP permission approval is distinct from Task review and Workshop Gatekeeper action approval. Mutations to remote systems remain in their existing Gatekeeper action/observation pipeline. Agent-created subagents have `parentAgentInstanceId`, `parentTaskId`, bounded `spawnDepth` and fanout; child effective permissions and budget must be an **intersection/suballocation** of parent, not inherited elevation.

## Admission and stop conditions

Stop when task/goal is complete, agent is disabled, lease conflict requires reconciliation, max iterations/budget/deadline reached, blocked with no next work, missing executor, pending human approval, or explicit pause/stop/kill switch. Each stop reason is persisted. Retry only idempotent admission/delivery operations automatically; no blind replay of non-idempotent ACP tool calls.

## API surface / tests

Read-only `automation.status`/`automation.policy` can be projected to authorized MCP readers in a later, separately versioned catalog. Human controls (policy edits, schedule enablement, pause/stop/force reconciliation and unrestricted spawn) remain behind Workshop authorization; no freeform `agent.spawn` tool in coordination v1.

Tests: idempotent wake, trigger redelivery, callback after revoke, scoped dispatch, parent budget/depth/fanout, no executor scenario, pending approval stop, ACP process crash, unknown run outcome, kill switch fencing, quota races, Scheduler bind-before-enable, restoration/replay and no long-lived secrets in container.
