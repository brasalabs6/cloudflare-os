# Feature traceability — Grokbot / Hub / Workshop / autonomous agent platform

> **Architecture-correction note, 2026-10-13:** The [existing module ownership audit](./EXISTING_MODULE_BOUNDARIES_AUDIT.md), root SPECS.md §23, and actual Workshop/Gatekeeper code take precedence over speculative target ownership in this earlier v2 design. The 15 new package directories are documentation-only; module adoption is subject to no-overlap gates.

**As of:** 2026-10-13 · **Status:** verification map / implementation backlog, **not an implementation completion claim**. Source commits and target tests must be filled per item before marking MIGRATED. [Unified v2](./AGENT_PLATFORM_UNIFIED_V2.md) · [ACP contracts](./ACP_CONTRACTS_V1.md) · [User inputs](./USER_INPUT_LEDGER.md).

## Evidence baseline

- **Grokbot**: [PR #1](https://github.com/brasalabs6/grokbot/pull/1), pinned head `9171b11c7269f6f305e99fd697a4dd885aad5459`, draft and not merged. Source feature spec `docs/FEATURE_SPEC_V1.md` F-001…F-017. Distinguish staging E2E from new-platform proof.
- **Hub**: `src/runtime/acp/acp-client.manager.ts` reference plus Codex App Server behavior; not a validated Codex ACP release.
- **Current Workshop**: `packages/workshop-backend/src/agent.ts` runs `runAgentLoopContinue` from `@earendil-works/pi-agent-core`; `overseer.ts` persists chat/state; `workshop-shared/src/api.ts` defines `AgentSpawnerConfig`. These are existing implementations, not new Cloudflare Sandbox ACP code.
- **Existing extension system**: `gatekeeper-scheduler` with approved hooks; `mcp-shared`, `gatekeeper-mcp` and `gatekeeper-mcp-portal` with existing OAuth/permission policy. Reuse, do not clone.

## Feature-by-feature evidence registry

| ID | Feature | Provenance | Target owner(s) | Current target status | Contract/E2E proof required |
|---|---|---|---|---|---|
| F-001 | Login, workspace e ACL | Grokbot FEATURE_SPEC_V1 / Workshop | workshop-backend + gatekeeper-coding-agents | LEGACY_DEFINED, WORKSHOP_EXISTING | Autorização de agente/task por workspace, revogação e teste de cross-tenant |
| F-002 | Dashboard de sessões | Grokbot dashboard | workshop-frontend/src/features/agent-sessions | PORT_REQUIRED | Lista real de AgentDefinition, task/session, health e release com paginação |
| F-003 | Wizard e perfis | Grokbot create session | workshop-frontend + harness-registry + control-plane | PORT_REQUIRED | Perfis/manifests validados, release sticky, policy review e criação idempotente |
| F-004 | Página da sessão | Grokbot session-detail | workshop-frontend | PORT_REQUIRED | Status/uso/harness/commands e links de task/parent/child com ACL |
| F-005 | Chat ACP | Grokbot acp-chat / ACP smoke | acp-core + agent-runtime + frontend | STAGING_REFERENCE | Novo prompt persistido, streaming e ACP permission E2E no target |
| F-006 | Replay streaming | Grokbot agent events | agent-runtime + agent-protocol + frontend | STAGING_REFERENCE | Cursor monotônico/expiry, dedup, restart e origem do engine |
| F-007 | Tool call timeline | Grokbot ACP updates | acp-core + agent-protocol + frontend | PORT_REQUIRED | tool started/updated/completed, args/redaction, unknown outcome |
| F-008 | Aprovações | Grokbot ACP permission, Workshop action queue | gatekeeper-coding-agents + runtime + frontend | DUAL_AUTH_DESIGN | Gatekeeper submit/apply vs ACP request_permission, deny/revocation |
| F-009 | Modelos/egress | Grokbot ai-gateway.ts | agent-egress + harness-registry + frontend | STAGING_REFERENCE | Allowlist, credenciais no Worker, quotas, provedor por engine |
| F-010 | Terminal/PTy | Grokbot xterm/tmux, cloudflare-os PR2 | gatekeeper-computers + agent-runtime + frontend | STAGING_REFERENCE | PTY real, reconnect, generation, ticket single-use, ACL |
| F-011 | Arquivos/edit/upload | Grokbot file-browser and runtime | gatekeeper-computers + runtime + frontend | PORT_REQUIRED | Root scoping, safe symlinks, bounded reads, write action approval |
| F-012 | Git status/diff | Grokbot spec + Workshop worktrees | gatekeeper-computers + runtime + frontend | LEGACY_DEFINED | Git read/status/diff validated, safe clone, staged changes |
| F-013 | Lifecycle | Grokbot session/lifecycle/reconcile | agent-runtime + control-plane | STAGING_REFERENCE | create/run/stop/suspend/resume/delete, conflict and unknown dispatch |
| F-014 | Logs/diagnostics | Grokbot diagnostics | agent-runtime + frontend | PORT_REQUIRED | Structured redacted logs, typed errors, operator dashboard |
| F-015 | Notifications | Grokbot spec + Workshop notification service | control-plane + workshop-frontend | PARTIAL_EXISTING | Task finish/fail/needs approval notifications via existing device service |
| F-016 | App preview | Grokbot P1 specification | gatekeeper-computers + frontend | DEFERRED_P1 | Authenticated port proxy with strict host/path and session ticket |
| F-017 | Usage/telemetry | Grokbot P1 + Workshop billing/trace | agent-egress + control-plane + frontend | PARTIAL_EXISTING | Token/cost attribution per task/agent/release and quotas |
| N-001 | Motor nativo Code Mode | workshop-backend/src/agent.ts runAgentLoopContinue | agent-harness-native + agent-protocol + workshop-backend | EXISTING_NATIVE | Chat, executeCode, approval, callbacks and commit barriers unchanged |
| N-002 | AgentSpawner callable | workshop-shared AgentSpawnerConfig | control-plane + native harness + Gatekeeper Coding Agents | EXISTING_NATIVE | Spawned chat grants/callbacks preserved; optional independent task link |
| N-003 | Chat compaction/provenance | Workshop agent-compaction | native harness + ACC event projection | EXISTING_NATIVE | Private model data stays backend; deterministic event replay |
| N-004 | Schedule/hook approved triggers | gatekeeper-scheduler ScheduleSession and ScheduleDriver | gatekeeper-scheduler + control-plane | EXISTING_NATIVE | No second scheduler; runId-stable task admission and hook approval |
| N-005 | MCP BYO/Portal import | mcp-shared, gatekeeper-mcp and portal | agent-tool-registry + existing MCP modules | EXISTING_NATIVE | OAuth, endpoint pin, BYO vs vetted trust, observer deny unchanged |
| A-001 | Agentes configuráveis | User U-006 | agent-control-plane + UI + shared | NEW | AgentDefinition with instructions/policies/model/grants/version and lifecycle |
| A-002 | Tarefas independentes | User U-006 | agent-control-plane + loop + UI | NEW | Task idempotent from user/API/schedule/hook/child, no browser required |
| A-003 | Trabalho 24/7 e loops | User U-006 | agent-loop + control-plane + scheduler | NEW | Bounded wakeups, checkpoints, quotas, pause/revoke, no infinite spin |
| A-004 | Driver multi-engine/protocolo | User U-006 | agent-protocol + acp-core + harness adapters | NEW | EngineDriver SPI, ACC, ACP+native events and versioned extension |
| A-005 | Subagentes gerenciáveis | User U-006 | control-plane + protocol + frontend | NEW | ParentTask graph, grant intersection, budget, native/platform distinction |
| A-006 | Custom cores/strategies | User U-006 | agent-loop + agent-harness-native + registry | NEW | Native pi-engine parity and configurable additional engine drivers |
| A-007 | Tool pluggability | User U-006 | agent-tool-registry + Gatekeepers | NEW | Module descriptor, capability grant, schema and action/observation parity |
| A-008 | MCP/REST export endpoints | User U-006 | agent-tool-gateway + router | NEW | Authenticated external API and MCP server, no unscoped runtime endpoints |
| A-009 | One UI timeline and commands | User U-006 | agent-protocol + frontend | NEW | Canonical events text/tool/commands/subagents/file/usage/ext |
| A-010 | A/B deploy and rollback | Prior user instruction | harness-registry + runtime + router | SPECIFIED_NOT_IMPLEMENTED | Pinned release per session, stop new assignments on rollback |
| A-011 | User input evidence ledger | User U-007 | docs/architecture/USER_INPUT_LEDGER.md + AGENTS.md | DOC_IMPLEMENTED | Verbatim input + source status + implementation evidence, append only |

## Completion rule for every row

Each row must eventually include: immutable source commit SHA + source paths; target commit + target paths; public schema version; unit/contract/integration tests; actual Cloudflare staging run URL; production run URL if shipped; migration/defer rationale; owner and review status. A checkmark or spec document alone NEVER means ported. Preserve original Grokbot code/test artifacts before archiving the old repo. **Grokbot is not archived at this date.**

### Acceptance ordering

1. Native Workshop characterization + ACC schema/projection; no regressions.
2. AgentDefinition/Task records and one bounded native background Task.
3. Grok ACP sandbox vertical slice and Stage E2E, with two approval namespaces and trusted egress.
4. Schedules via existing Gatekeeper persistent hook + worker Task admission, source runId dedup.
5. Subagents/child graph + quota/stop/cancel + replay/UI.
6. Codex/OpenCode independent pinned protocol fixtures plus optional native drivers.
7. Tool manifests + existing MCP import + new authenticated HTTP/MCP export and full threat tests.
8. A/B release pinning, rollout/recovery/rollback, usage and production gates.

