# ADR 0004 — Multiagent domain service with MCP server facade

**Status:** Proposed for review; not implemented. **Date:** 2026-10-13.

## Context

The supplied multiagent MVP assumed an independent Next.js/PostgreSQL control plane and no built-in executor. Cloudflare OS already owns Workshop identities/workspaces and has a capability-oriented API, existing MCP *client* Gatekeepers, a Scheduler and a separate, specified ACP runtime. Building a second app and actor database would duplicate authority.

## Decision

Add independent domain packages for directory, tasks/goals, mailbox, memory/learning, continuity, audit and automation. Create a separately authenticated **MCP server** gateway exposing the same services that internal Cap'n Web RPC clients use. The gateway owns transport and catalog, never business state/permission grants. Keep ACP as process-level harness protocol and the agent-runtime Session DO authoritative for execution. Use existing Gatekeepers for protected remote resources, without turning the MCP server facade into a global unrestricted Gatekeeper.

External clients get durable coordination only; an offline client is never assumed to be awakened by assignment. Managed execution is an explicit, later integration dependent on the ACP runtime and approved Coding Agents capability. The MVP supports coordination without that executor.

## Consequences

- One set of domain policies for MCP, UI and Code Mode callers; more contract/conformance testing.
- No changes to legacy MCP client connector endpoint trust policy.
- No alternate account/login/workspace membership source or PostgreSQL sidecar.
- Workspace-scoped, narrow capabilities; no credential/authorization inheritance from tool names.
- Define versioned domain schemas, scope catalog and client-version matrix before implementation.
- Contract precedence: root `SPECS.md`, new package specs, executable TypeScript/JSON schemas. See `../architecture/MULTIAGENT_MCP_PLATFORM.md`.
