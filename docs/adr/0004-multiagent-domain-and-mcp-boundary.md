# ADR 0004 — Extend Unified Agent Platform v2, do not create parallel domain owners

**Status:** Proposed for review; no implementation. **Date:** 2026-10-13. **Supersedes:** the first draft of this ADR in PR #4.

## Context

A prior proposal treated coordination as a separate set of eight agent-domain modules. Repository source review showed an existing, newer [Unified v2 spec](../architecture/AGENT_PLATFORM_UNIFIED_V2.md): `agent-control-plane` already owns AgentDefinition, execution Task, Trigger, lineage and budgets; `agent-loop` owns continuation; `agent-protocol` owns ACC event language; `agent-tool-registry` and `agent-tool-gateway` own discovery and authenticated MCP/HTTP export. Workshop has the native pi-agent-core/Overseer engine, Scheduler, Gatekeeper approval/auth and MCP-import connectors.

## Decision

Treat the PDR as **new capabilities within the already proposed owner topology**. Add Goal/WorkItem DAG/claim/review and logical continuity under `agent-control-plane`. Keep its existing `Task` for execution, introducing a separate `WorkItem` rather than silently changing execution semantics. Use `agent-tool-gateway` (not `mcp-domain-gateway`) as the one MCP server. Keep existing Agent Sessions UI as one agent-management surface. New Mailbox is permitted only for offline agent↔agent channels/receipts not served by Overseer chats; structured workspace Memory/Learning is conditional on a verified Context Gatekeeper ACL/storage gap.

## Alternatives rejected

- Duplicating Agent Directory, Task/Goal manager, Agent Automation, Audit stream or MCP exporter in new Workers.
- Treating existing native pi-agent-core as ACP, or ACP run results as approved WorkItem reviews.
- Storing WorkItem state directly in Overseer chat history, or using the existing ExternalMessageGateway as arbitrary client auth.
- Replacing Context docs/skills with an independently searchable document platform.

## Consequences

Fewer new authorities/deployments, but ACC/Control Plane/Tool Gateway must be implemented and have explicit ABI versioning before coordination is usable. PDR `task.*` MCP surface is a WorkItem alias only. Existing Gatekeeper/Scheduler/runtime audits and permission models remain authoritative. See [review audit](../architecture/MULTIAGENT_RESPONSIBILITY_AUDIT.md) and [delta contracts](../architecture/MULTIAGENT_MCP_CONTRACTS_V1.md).
