# Multiagent coordination — security review after responsibility alignment

**Status:** review checklist; no new runtime deployed. See [owner audit](./MULTIAGENT_RESPONSIBILITY_AUDIT.md) and [Unified v2](./AGENT_PLATFORM_UNIFIED_V2.md).

## Authority and trust boundaries

- **Workshop** authenticates user, workspace membership/sharing and Gatekeeper capability bindings. No agent/tool args can declare themselves owners, admins, another agent or trusted event producers.
- **Agent Control Plane** is the sole owner of AgentDefinition, execution Task, Execution, delegation, budgets and newly proposed Goal/WorkItem business claims/review/continuity. `WorkItemClaim` is not `Execution.fencingToken`; stale claims and physical run outcome must each be reconciled.
- **Agent Tool Gateway** exports one selected, authorized tool catalog through HTTP/MCP; `agent-tool-registry` owns metadata. Gatekeeper-authorized resource operations use their real session, `authorizeObservation` and `submitAction`/`applyAction`. MCP client connectors retain their existing BYO/portal trust policy.
- **Overseer** holds chat/user action history, current native turns, pending callable-agent callbacks, compaction and action approvals. Do not import mailbox message bodies into trusted system prompts or reconstruct a new native-loop authority.
- **Scheduler Gatekeeper** delivers approved hooks under its own schedule IDs/occurrence run IDs; Control Plane dedupes admission. A tool cannot install an unrestricted schedule by writing a task.
- **ACP runtime** owns real process/run, permission request identity and generation. Task review does not mean ACP side effects were approved; Runtime `OUTCOME_UNKNOWN` cannot be silently relabeled WorkItem DONE.
- **Context Library** owns account-private/domain-public docs, skills and protected search; new workspace facts have stricter workspace scope, explicit revision/provenance and human review. An agent never gains unrestricted Context management API.
- **Mailbox** owns only channel messages/receipts, with sender/recipient scoped to Workshop-verified workspace. ExternalMessageGateway is a trusted service-binding for chat ingress, not a general MCP-agent identity mechanism.
- **ACC** is single normalized event projection; source journals stay authoritative. Observability telemetry is not replay, billing or audit truth. Domain outbox events are private, deduped delivery facts only.

## Main negative acceptance tests

| Scenario | Required defense / evidence |
|---|---|
| A token for workspace A requests goal, task, mailbox, learning, resource or cursor in B | owner-side workspace and observer checks deny before content disclosure |
| MCP client sets `principalId`/`agentId`/`scopes` | derive from verified identity, reject forgery and stale/revoked tickets |
| Concurrent WorkItem claims/reassignments | same owner transaction, CAS revision, lease epoch+secret digest+expiration |
| Claim allows arbitrary execution | explicit Control Plane admission/grant intersection; never infer ACP permission from WorkItem claim |
| Agent reviews its own deliverable or a high-risk change | distinct reviewer; human-required risk policy |
| DAG with cycle/foreign-workspace edge | atomic local graph validation; no partial write |
| Task assignment persisted but Mailbox crashes | producer outbox remains, at-least-once retry with consumer event dedupe and eventual delivery status |
| Replay after uncertain external effect | OUTCOME_UNKNOWN reconciliation; never blind duplicate execution |
| Mail body or memory claims "ignore policy" | label/escape untrusted data; no system-role elevation or auto-review |
| Context private data copied to workspace memory | explicit source authorization, no widening sharing scope; check observer exclusions |
| Agent calls native tool after revoke | fresh capability and policy checks at apply time, not cached catalog |
| Agent builds uncontrolled loops/subagents | budgets/step/depth/fanout/stop, checked at current Control Plane admission |
| Unauthorized terminal/file read | separately granted Computer capability with generation ticket, path/size boundaries |
| Leaked API key in diagnostic/event/notification | sanitize/truncate payloads, fixed notification templates and log review |
| Unknown MCP client protocol/transport | explicit version checks + pinned conformance fixtures; no silently weaker fallback |

## Approval namespace isolation

1. **WorkItemReview:** business acceptance of evidence/DoD in Control Plane; never applies a third-party action.
2. **Workshop/Gatekeeper ApprovalQueue:** approves real external resource action via `submitAction`/`applyAction`; observation authorizer protects reads and sharing.
3. **ACP runtime permission request:** approves specific sandbox process tool call bound to session/run/generation/tool call.

An arbitrary MCP `approval.request` must not create an independent fourth privileged approval queue. It may project an existing resource-specific request only if authenticated and explicitly supported.

## Mandatory gates

Before public Gateway: auth OAuth/audience/expiry/revoke/redirect tests, permission matrix per tool and cursor, isolation, rate/size limits, catalog versioning and honest result/status semantics. Before Mailbox or Memory storage: per-workspace ownership tests, revision/idempotency/dedupe, backups/restore and at-least-once failure injection. Before managed runner: real native and CLI harness E2E, supervised stop/recovery, secrets/egress and budget enforcement. Never call this docs-only PR implemented.
