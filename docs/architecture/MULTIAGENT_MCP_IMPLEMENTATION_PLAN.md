# Multiagent MCP — corrected integration and test plan

**Status:** proposed, NOT implemented. **Baseline:** main `9ad57f6`, 2026-10-13.
**Inputs:** attached `multiagent-mcp-mvp-docs.zip`, PDR F01–F16 / AC01–AC18. **Precedence:** root `SPECS.md`, [Unified v2](./AGENT_PLATFORM_UNIFIED_V2.md), existing package `SPECS.md`, [ACC](../../packages/agent-protocol/SPECS.md), [ACP](./ACP_CONTRACTS_V1.md). See [code-based inventory](./MULTIAGENT_RESPONSIBILITY_AUDIT.md) and [corrected contracts](./MULTIAGENT_MCP_CONTRACTS_V1.md).

## 1. Change from earlier design

The original PR #4 proposed a new `agent-directory`, `agent-goals-tasks`, `agent-automation`, `agent-audit`, `mcp-domain-gateway` and parallel Agent UI feature. **All six are now withdrawn**: the checked-in Unified v2 architecture already assigns those authorities to `agent-control-plane`, `agent-loop`, `agent-protocol`, `agent-tool-registry`, `agent-tool-gateway` and the existing Agent Sessions frontend. The remaining domains are bounded **Mailbox** and possibly **workspace structured Memory/Learning** with a Context reuse gate.

## 2. Requirement-by-requirement acceptance and owner

| PDR | Existing owner/implementation | Required extension / verification |
|---|---|---|
| F01 auth / F02 workspace | IMPLEMENTED Workshop User/Overseer/sharing | external MCP grants must resolve through authenticated Workshop, no new auth DB; AC01, AC03 |
| F03 agent registry | SPECIFIED `agent-control-plane` AgentDefinition | workspace-linked external identity/presence/credential rotation; AC02, AC03 |
| F04 remote MCP | SPECIFIED `agent-tool-gateway` + Registry, IMPLEMENTED MCP import separate | server export/oauth/conformance; AC18 |
| F05 goals/projects | EXTEND Control Plane | Goal/Project Workboard records; AC04 |
| F06 tasks/DAG/leases | EXTEND Control Plane | **WorkItem**, not execution `Task`; DAG and fenced business claim; AC05, AC06 |
| F07 delegation | EXTEND Control Plane + Mailbox | WorkItem assignment outbox -> offline notice; AC04/AC07 |
| F08 channels/DM/ack | NEW `agent-mailbox` | no alias to chat/ExternalMessageGateway; AC08 |
| F09 workspace facts | NEW candidate `agent-memory` (reuse Context discovery/search) | scoped structured assertion/revision, no new docs/skills; AC09 |
| F10 learning | EXTEND candidate `agent-memory` | human reviewed promotion, never agent self-approve; AC10 |
| F11 continuity | EXTEND Control Plane ACC projection | versioned handoff with source cursor, Overseer compaction unchanged; AC11 |
| F12 activity | EXTEND ACC projection; IMPLEMENTED observability/action audit | authorized event.list, redaction; AC16 |
| F13 approval | IMPLEMENTED Gatekeeper action / ACP permission specs; ADD WorkItem review | separate namespaces; AC13 |
| F14 UI | EXTEND EXISTING `features/agent-sessions` | workboard, inbox, learning, continuity, ACL; AC12/AC17 |
| F15 recovery | owner-local DO/outbox, existing Scheduler/Overseer, ACP runtime specs | fault injection/idempotency/fencing, restore; AC14 |
| F16 operation | existing Observability + package-local runbooks/tests | metrics/health/backup drills; AC15/AC16 |

This is a *mapping to owners*, not proof a feature is implemented. Source v2 packages are spec-only until code, schemas, tests and production deployment are verified.

## 3. Sequenced implementation PRs (not new parallel services)

1. **G0 Architecture review (this PR):** evidence inventory, task type split, scope/authority matrix, initial workboard/mailbox/memory contract; no source code changes. Do not approve implementation of a new data store before authorization review.
2. **G1 ACC and Control Plane contracts:** implement/validate existing `agent-protocol`/`agent-control-plane` work: source-to-event mapping, AgentDefinition/Task/Execution schema, migration and service bindings; preserve native Overseer and ACP semantics. Tests for schema versioning, cross-workspace grants, execution unknown outcomes, restart.
3. **G2 Workboard inside Control Plane:** `Goal`/`WorkItem`/DAG/claim/review, optional Project, source-to-execution correlation. No second AgentDefinition or generic execution Task. Tests T07–T12, AC05–AC07, cycle + lease-race + self-review.
4. **G3 Mailbox only:** independent recipient/channel DO if existing chat cannot meet ordering/offline receipts. Control Plane outbox integration with consumer dedupe; notification templates via existing Workshop service only. T13/T14/T20/T26/T27, AC04/AC08/AC14.
5. **G4 Structured memory decision:** prove Context Gatekeeper ACL and management API cannot safely supply workspace facts; prefer a Context extension if compatible; otherwise bounded `agent-memory` structured ledger, human learning review, source refs. T15/T16, AC09/AC10.
6. **G5 Continuity projection:** implement in Control Plane from ACC source cursor, not separate DO/task authority. T17, AC11.
7. **G6 Registry and MCP Gateway:** implement `agent-tool-registry` manifests and `agent-tool-gateway` auth/versioned tools/resources; all PDR public tools route to same owner RPC as UI/native code. T03–T05/T24/T25, AC02/AC03/AC18.
8. **G7 One Workshop UI:** extend current Agent Sessions and approved action UI. Keyboard/mobile end-to-end, errors/reconnect/offline statuses; T18/T23/T30, AC12/AC17.
9. **G8 Optional managed autonomy:** fulfill existing ACP runtime, native adapter, agent-loop and Scheduler plans; real Grok/Codex/OpenCode E2E, budgets, stop, subagents, immutable releases and rollback. This is a separate release from PDR's external MCP coordination MVP.

Check source AC01–AC18 and T01–T30 for every gate. The attached PDR's performance/a11y numbers remain **targets**, not measured results.

## 4. Package change matrix

| Existing package | Proposed additions (NOT yet code) | Forbidden changes |
|---|---|---|
| `agent-control-plane` | `src/workboard/*` Goal/WorkItem, review, lease, correlation; `src/continuity/*` projection; outbox consumers | parallel Agent Registry, second execution Task/Loop scheduler |
| `agent-protocol` | ACC event type/source mapping for workboard/mailbox/facts; tool schema aliases | a second global DomainEvent protocol |
| `agent-tool-registry` | PDR tool manifests/schema/scope classification, map `task.*` to WorkItem | duplicate domain MCP registry |
| `agent-tool-gateway` | HTTP/MCP projection for workboard/mailbox/memory + OAuth conformance | new standalone domain gateway |
| `gatekeeper-context` | audited Context evidence link and reuse decision (no implicit write) | agent-writable Context docs/skills bypassing management |
| `agent-loop`, `gatekeeper-scheduler` | integrate approved task admission only | second cron/restart loop |
| `workshop-backend` | narrow binding to Control Plane + notifications integration only if needed | replacing existing pi loop/Overseer chat/actions |
| `workshop-frontend/src/features/agent-sessions` | add Workboard/mailbox/learning views | second agents dashboard/router identity |
| `agent-mailbox` (new) | only offline channels/receipts | external-message gateway/chat clone |
| `agent-memory` (conditional new) | only workspace facts/learning revision | ContextDocument/skills/search replacement |

## 5. Definition of done

For each implementation gate require (a) source commit pinned and code paths, (b) schema + migrations + ABI, (c) unit, DO concurrency and security negative tests, (d) staging RPC/MCP-native parity, (e) live deployment/restore/revoke evidence when relevant, (f) audit/telemetry redaction, (g) rollback and old-session compatibility. Mark `ALREADY_COVERED` only with code/test evidence, not a speculative spec.

## 6. Review decisions still open

Identity/credential issuer vs Workspace auth; split WorkItem vs Execution Task and allowed states; Mailbox sharding/per-channel ordering; Context vs workspace memory storage choice; metadata/provenance security; ACC projection replay/retention; MCP protocol version and host OAuth; task review policy separate from external actions; deployment and binding generation. These are explicit review gates, not silently assumed implementation choices.
