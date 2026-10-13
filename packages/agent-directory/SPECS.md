# Agent Directory — SPECS

**Kind:** proposed workspace-scoped domain library + stateful DO authority; deployment layout TBD.
**Status:** specification only; package code and deployment do not yet exist.
**Traceability:** F02–F04, P01–P03, AC identity/revocation/isolation cases.

## Mission and source of authority

Represent logical agents and their authorized workspace instances without duplicating Workshop users, workspaces, membership or credential handling. Workshop issues authenticated principal/workspace context; Directory stores `AgentDefinition`, `AgentWorkspaceGrant`, `AgentInstance` and presence metadata. Every record is scoped to a Workshop-verified workspace. A logical agent can participate in several workspaces *only* through independent verified grants.

Identity boundaries: `agentId` is not `principalId`, `agentInstanceId` is not `agentSessionId` and a heartbeat is not proof a CLI process exists. Managed ACP sessions are resolved via the existing Runtime Directory, not copied into this module as a second runtime-state authority.

## Agent-facing API and MCP projection

`agent.whoami` (authenticated context, effective workspace-scoped scopes/capabilities), `agent.list` (authorized metadata, bounded page), `agent.heartbeat` (authenticated agent only, server timestamp + TTL), `workspace.list` and `workspace.get` (delegated Workshop lookup with per-workspace authorization). Internal privileged create/update/revoke identity/grants are exposed to authenticated Workshop administration, **not** arbitrary MCP agents. An incoming `agentId` argument cannot impersonate another agent.

Suggested operations:
- `registerAgent`: human-authorized principal creates a stable definition and default policy.
- `attachAgent`: intersect and persist a workspace grant/policy; do not silently inherit admin membership.
- `registerInstance`: link external or managed execution mode with workspace, optional parent instance/depth, and permission intersection.
- `disableAgent`: invalidate future admission, credential/connection authorization and wake intents; reconciliation handles in-flight runs and leases explicitly.
- `heartbeat`: only current agent credential, bounded status, TTL; maintain lastSeen, not a perpetual online claim.

## Records and invariants

`AgentDefinition {agentId,ownerPrincipalId,displayName,status,version,defaultHarnessId?,policyProfileId?}`; `AgentWorkspaceGrant {agentId,workspaceId,scopes,state,version}`; `AgentInstance {agentInstanceId,agentId,workspaceId,executionMode,parentAgentInstanceId?,parentTaskId?,spawnDepth,agentSessionId?,status}`; `Presence {workspaceId,agentInstanceId,lastSeenAt,reportedState?,expiresAt}`.

- Revocation wins over presence and all cached capability catalogs.
- Parent agent/instance/grant must be in same workspace for subagents; effective child scopes are subset/intersection of parent/user/workspace grants.
- Only platform trusted issuers issue/authenticate credentials. Directory stores token IDs/digests/revocation state if needed, never reusable bearer secrets. OAuth token issuer/audience and storage design require security review, not an invented application-global static token.
- `online` = unexpired heartbeat; `busy` is a best-effort state report for external agents and authoritative ACP state only for managed sessions.

## Isolation, events and tests

Reads through a Gatekeeper call `authorizeObservation` before returning protected data; MCP ingress validates scopes/audience/workspace each call; mutations persist audit/outbox. Tests: cross-workspace confusion, caller-supplied actor forgery, revoke with outstanding heartbeat, sibling instance access, replayed credential, agent multi-membership, heartbeat TTL expiry, managed/external semantics, pagination/redaction and clone/subagent scope escalation.

**Contract reference:** `../../docs/architecture/MULTIAGENT_MCP_CONTRACTS_V1.md`. Do not alter existing Workshop user/storage APIs before a separately reviewed kernel ABI change.
