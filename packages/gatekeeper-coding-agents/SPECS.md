# Gatekeeper Coding Agents — SPECS

**Kind:** independent Cloudflare Gatekeeper Worker following the repository's Gatekeeper authoring guide.  
**Status:** proposed API for review; implementation pending.

## Responsibility

Expose capability-scoped creation and operation of coding-agent sessions to Workshop Gadgets. It mediates access to the agent-runtime service binding and integrates with canonical approval, action and observation APIs. It does not spawn processes itself and does not automatically grant terminal/filesystem access.

## Resource model

- Vendor: describes the service, supported harnesses and connection behavior.
- User account: stores only account-level settings/authorized defaults; no raw provider keys unless a reviewed account-connection flow requires them.
- Session facet: capability to one AgentSession, with an explicit allowed-operation set and workspace grant.
- Agent catalog: bounded, non-sensitive discovery metadata only. It carries no authority.
- Optional admin UI: account/runtime policy inspection, never an alternate approval bypass.

The account must not silently auto-provision unrestricted sessions. Workspace and user identity must come from Workshop-authenticated context, not caller-supplied IDs alone.

## Proposed agent-facing API

~~~typescript
export interface CodingAgents {
  list(options?: { cursor?: string; limit?: number }): Promise<{ entries: AgentSummary[]; nextCursor?: string }>;
  get(sessionId: string): Promise<CodingAgent | null>;
  create(input: {
    workspaceId: string;
    harness: "grok-build" | "codex" | "opencode";
    profileId: string;
    title: string;
    requestId: string;
  }): Promise<CodingAgent>;
}

export interface CodingAgent {
  status(): Promise<AgentStatus>;
  prompt(text: string, requestId: string): Promise<{ runId: string; state: string }>;
  cancel(runId: string, requestId: string): Promise<OperationStatus>;
  events(afterSequence: number, limit: number): Promise<{ entries: AgentEventPublic[]; nextSequence: number }>;
  checkpoint(requestId: string): Promise<OperationStatus>;
  stop(requestId: string): Promise<OperationStatus>;
}
~~~

This contract is a proposal and must be reviewed against Cap'n Web RPC types before code is written. Bounded summaries/events must redact secrets and prompts by default. Repeating requestId with a different request hash is rejected. A session handle is not a ComputerHandle.

## Security responsibilities

- Every returned read that exposes protected state calls authorizeObservation.
- Every side effect goes through submitAction and applyAction/approval semantics required by the canonical Gatekeeper API.
- Session access is scoped to the granted workspace and principal; IDs are never treated as authorization.
- Cross-session and cross-workspace requests fail closed.
- Observer verification methods are mandatory and implemented according to the resource's sharing semantics.
- No public bypass endpoint may be added to agent-runtime.

## Implementation checklist

Follow .agents/skills/write-gatekeeper/SKILL.md and SKELETON.md. Create src/types.d.ts and generated src/types.txt; design the capability API first and pause for review before implementation. Register the Worker, service binding, generated config, tests, observability and deployment secrets. Add tests for authorization, approval, replay, bounded payloads, observer checks and denied cross-workspace access.


## Authority and executable contract prerequisites

See [ACP_CONTRACTS_V1](../../docs/architecture/ACP_CONTRACTS_V1.md) sections 1, 3, 4 and 7. Treat the public TypeScript API above as a PROPOSAL until Cap'n Web-compatible `src/types.d.ts` and the generated `src/types.txt` are reviewed per the existing Gatekeeper authoring guide. In particular, a `submitAction` record must not physically spawn or mutate a runtime until approved `applyAction`; the queued response cannot claim the process ran. ACP `session/request_permission` is a separate approval namespace and cannot silently be simulated as an applied external action. All reads exposed to Gadgets use `authorizeObservation` and the existing observer semantics; human Workshop control uses its independently authenticated path.
