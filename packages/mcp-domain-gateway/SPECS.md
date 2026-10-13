# Multiagent MCP Server Gateway — SPECS

**Kind:** proposed independently deployable Worker **server**, implementation pending.
**Traceability:** F04; AC02, AC03, AC18.
**Not:** `gatekeeper-mcp` or `gatekeeper-mcp-portal`, which are existing MCP **client** connectors; no user-supplied remote endpoint is configured here.

## Mission

Expose one authenticated, versioned remote MCP tool/resource facade over the **same** workspace/domain RPC services used by Workshop and Code Mode. Gateway is stateless with respect to business entities: it discovers modules, validates protocol/schemas, authenticates and resolves workspace-scoped capabilities, routes requests, then renders protocol-native results/errors. It MUST NOT own task/memory/session state or act as another workspace identity authority.

## Endpoint/protocol contract

Primary target: `POST /mcp` using the MCP Streamable HTTP profile for the explicitly supported 2026-07-28 protocol version, over HTTPS and without ambient cookies as remote bearer authorization. Only advertise versions/transports that have conformance fixtures. If client 2025 interoperability is required, negotiate/reject explicitly and provide a tested compatibility adapter; never silently accept a weaker security model. The exact MCP SDK/metadata/header semantics MUST be verified against the pinned protocol version before implementing framing. Do not handcraft independent JSON-RPC parsing per module.

Publish protected-resource metadata/OAuth issuer discovery per selected protocol revision, secure issuer/audience binding and resource consent, exact allowed redirect URI, revocation and expiry. Trust user and agent identities **only** after auth validation and verified Workshop workspace grant. Rate limit both principal and workspace; block cross-workspace resource URI access. Server lists tools that are actually permitted *and* reauthorizes on `tools/call`; catalog visibility is not authorization. Avoid exposing internal service binding handles.

## Registry

`DomainToolDescriptor {publicName,moduleId,inputSchema,outputSchema,minScopes,operationClass,handlerRef,schemaVersion,idempotencyRequired}` and resource descriptors are versioned, bounded, deduplicated and explicit. Tool entries include candidate public names from `../agent-directory/SPECS.md`, `../agent-goals-tasks/SPECS.md`, `../agent-mailbox/SPECS.md`, `../agent-memory/SPECS.md`, `../agent-continuity/SPECS.md` and `../agent-audit/SPECS.md`. MCP resources are `multiagent://workspaces/{workspaceId}/overview`, `.../continuity`, `.../policies`, `.../agents/{agentId}/continuity`. A URI never grants visibility; resolve authoritatively.

Input validators reject unknown/oversized arguments; all list/read tools have bounded pages/cursors. Mutations carry `idempotencyKey` and CAS `expectedVersion` when appropriate. Return native MCP structured content and tool `isError` for valid tool errors; protocol/auth failures use their respective transport/protocol mechanisms. Do not return successful pseudo-results when the operation was not committed.

## Auth/projection boundary

- Build `ActorContext` from a verified caller token + Workshop principal/workspace membership + delegated scopes + policy, never from freeform tool arguments.
- `workspaceId` is a requested resource selector; agent identity is derived from credential binding, not an `agentId` tool parameter.
- Use a short-lived, scoped capability to call private domain Worker/service bindings. No public unauthenticated RPC or static superuser token.
- Read observations exposed through Gatekeepers still call their observation authorizers. Actions that belong to a Gatekeeper respect `submitAction`/`applyAction`. The gateway cannot approve them on the caller's behalf.
- Catalog aliases/new versions require compatibility tests and explicit deprecation; changing annotations/descriptions does not grant scope.

## Acceptance

Two distinct external MCP clients + one 2025-compatibility client (if supported) complete discovery/auth/read/write. Missing/expired/revoked token, wrong audience, guessed workspace, invalid resource, forged actor fields, tool-name spoofing, catalog change, replayed idempotency keys, oversized JSON, forged OAuth state and cross-tenant cursor all fail closed. Browser/client disconnect has no effect on committed tasks or remote harness sessions. No sensitive headers or body contents in logs.
