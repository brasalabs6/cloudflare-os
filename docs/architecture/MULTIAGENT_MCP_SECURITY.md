# Multiagent MCP — Security and threat model

**Status:** design-review checklist; no implementation has been approved or deployed. **Date:** 2026-10-13.
**Companion:** [contracts](./MULTIAGENT_MCP_CONTRACTS_V1.md), [architecture](./MULTIAGENT_MCP_PLATFORM.md), [ACP threat boundary](./ACP_AGENT_PLATFORM.md).

## 1. Trust boundaries

1. **MCP client → gateway:** untrusted remote network request. Validate TLS, protocol version, OAuth audience/issuer/expiry, caller, workspace membership and tool scope on **every** call. Browser session cookies and tool arguments are not bearer grants. Transport/version compatibility is verified with pinned client conformance suites rather than assumed.
2. **Gateway → domain module:** private service-bound capability with verified actor context and exact permitted operation. Revalidate resource membership and version/lease at the owner. Service bindings are not general superuser tunnels.
3. **Workshop → Gatekeeper:** use canonical capability grants. Observations return protected data only after `authorizeObservation`. External side effects use `submitAction` then approved `applyAction`; do not execute an action because an MCP annotation says it is idempotent or because a task changed state.
4. **Automation → ACP runtime:** narrow Coding Agents capability + immutable harness release, budgets and explicit admission. Runtime DO owns run outcome; untrusted ACP output cannot authorize a domain mutation. Computer/terminal access requires its **separate** grant and generation-bound ticket.
5. **Cross-domain outbox:** event producer trust is derived from service identity, validated workspace/source/entity, monotonic version and `eventId`. Accepting a message is not accepting arbitrary instructions or a delegated credential.
6. **Agent memory/messages → prompting:** all retrieved knowledge is untrusted data; tool/system policy is never replaced by a message or memory authored by an agent.

## 2. Concrete threats and required mitigations

| Threat | Control | Acceptance evidence |
|---|---|---|
| Token for workspace A reads task from B | owner-side workspace+resource check, safe 403/404 | T01/T02, AC01 |
| Agent claims to be another `agentId` | identity derived from credential/grant, no freeform impersonation | T03/T05, AC02/AC03 |
| Stolen/replayed token; revoked agent retains access | expiry, audience binding, rotation/revoke, per-request admission, no cached privilege | T05, AC03 |
| MCP resource/tool returns data beyond scope | tool discovery bounded; reauthorize calls, resources and pagination cursors | T02/T04/T25, AC18 |
| Two concurrent task claimers | one transactional owner + leaseEpoch fencing | T07/T08, AC05 |
| An old worker submits after reassignment | epoch/secret digest/expiry/actor compare on every write | T08/T12, AC05/AC07 |
| Message or outbox delivered twice | unique idempotency/dedupe, inbox unique event IDs, no retry of unknown external effects | T20/T26/T27, AC14 |
| Reviewer approves own result; high-risk task bypass | distinct reviewer, risk policy, human approval for sensitive work | T11b/T16/T19, AC07/AC13 |
| ACP tool permission treated as Task approval | distinct identities, namespaces and policies; no shortcut | ACP security E2E |
| Subagent privilege escalation | effective scope intersection, depth/fanout/budget limits | T28, P03 |
| SSRF via MCP remote URL / resource URI | no caller-controlled upstream on server; shared endpoint SSRF checks for any client egress, no unsafe redirects | endpoint abuse suite |
| Secrets in events, backup, errors or tool output | sanitized structured audit, log sampling review, encrypted/trusted secret stores, bounded exports | T21b/T22, AC15/AC16 |
| Prompt injection in memory/message | render/label untrusted data; never grant tools/scopes from text | T29, P08 |
| Operator assumes 'online' or 'delivered' implies work | explicit heartbeat/receipt/run authority | T23/T30, AC17 |
| Long-running runaway loops | policy admission, concurrency/iteration/cost caps, human stop and runtime kill | automation failure injection |

## 3. Authorization matrix

| Role | Typical allowed operations | Explicitly denied by default |
|---|---|---|
| Human owner/admin | workspace policy/agent registration, domain CRUD and review within verified role | bypass of provider/ACP permission boundary |
| Human operator | create/assign/inspect tasks and messages, delegated low-risk reviews | grant/credential issuance without admin rights |
| Human viewer | authorized read of redacted projections | all writes, unredacted secrets |
| Executor agent | whoami, task reads/claims on assigned work, progress/result, own inbox, scoped continuity | workspace administration, third-party credential access, own review |
| Supervisor agent | executor rights plus scoped goal/task planning and delegation | escalating child scopes, arbitrary agent execution |
| Reviewer agent | explicitly delegated `task:review` for low-risk tasks it did not perform | sensitive review, own tasks |
| Internal worker | only one service-bound operation profile | human login impersonation or unrestricted public endpoints |

This is a *template*; effective scopes are the intersection of Workshop membership, user grants, credential grants, per-resource policy and any parent delegation. Protected reads need observation authorization when Gatekeeper-mediated; role-based UI hiding is not sufficient.

## 4. Acceptance gates

Before any public MCP server deployment: threat-model review, OAuth/client-version conformance, cross-workspace negative suite for **all** entities, denial/expiry/revoke race tests, audit redaction/export/restore drill, quotas/size-bomb tests, and independent approval-flow tests. Before managed runtime enablement: ACP staging E2E for each harness, egress/secret review, generation fencing, checkpoint restore proof and rollback drill. Staging evidence and production evidence are tracked separately.
