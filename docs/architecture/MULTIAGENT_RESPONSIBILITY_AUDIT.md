# Multiagent MCP — code-based responsibility and gap audit

**Date:** 2026-10-13. **Status:** PDR-specific gap overlay, not implementation proof. **Primary existing-package audit:** [EXISTING_MODULE_BOUNDARIES_AUDIT.md](./EXISTING_MODULE_BOUNDARIES_AUDIT.md) (full 32-package inventory and B01–B20 decisions). This file adds the uploaded PDR's F01–F16 mapping and must not be treated as a second competing inventory.
**Repository baseline:** `main` at `9ad57f68ca1eb6f2e2c2ee313c4ff95d0d503a25`. Review scope: existing Workshop backend/shared/frontend, Gatekeepers, scheduling, MCP import, agent platform v2 proposed packages, ACP, event/observability paths and the uploaded PDR F01–F16 / AC01–AC18. A path with only `SPECS.md`/`plan.md` is **SPECIFIED, NOT IMPLEMENTED**. The table below distinguishes evidence levels.

## 1. Foundational conflict discovered in the first PR draft

The initial PR #4 proposed eight fresh owners. That **overlaps the already-specified Unified Agent Platform v2** in the current repository: `agent-control-plane` owns definitions, execution Tasks, triggers, budgets and subagent lineage; `agent-loop` owns continuation strategy; `agent-tool-registry` already specifies manifest/discovery; `agent-tool-gateway` already specifies MCP server/HTTP export; `agent-protocol` owns canonical ACC events. The duplicate packages/specs `agent-directory`, `agent-goals-tasks`, `agent-automation`, `agent-audit` and `mcp-domain-gateway` are **withdrawn** from this PR. The separate `features/multiagent` UI spec is also withdrawn: extend the existing `features/agent-sessions` view.

This is not a claim those proposed v2 packages are deployed. They currently contain specifications/plans, and their runtime implementation remains a prerequisite for some integrations.

## 2. Authority and implementation inventory

| Capability / source evidence | Reality verified | Canonical owner | What the multiagent feature adds — and must NOT duplicate |
|---|---|---|---|
| User sessions, workspace ACL, sharing: `workshop-backend/src/{user,overseer,access,sharing}.ts`; `workshop-shared/src/api.ts` | IMPLEMENTED kernel | Workshop | No second identity database, workspace DO or auth token issuer |
| Native Code Mode/turn: `workshop-backend/src/agent.ts`, `runAgentLoopContinue`; `overseer.ts` | IMPLEMENTED native engine | Overseer/`agent-harness-native` adapter (adapter only specified) | Never convert native pi agent-core into pretend ACP |
| Persistent callable agents: `workshop-backend/src/agent-spawner-binding.d.ts`, `overseer.ts` `pendingAgentCalls`; `plans/spawner-with-persistence.md` | IMPLEMENTED durable chat callback queue | Overseer | Mailbox messages are not callable-agent invocations, and must not cause implicit duplicate spawns |
| Agent definitions, task execution, triggers, lineage, budgets: `agent-control-plane/SPECS.md` and `plan.md`; Unified v2 `4 | SPECIFIED, not runnable | `agent-control-plane` | Extend **within this owner** for Goal, WorkItem DAG, human review and continuity projection; do not create `agent-directory` or second `Task` table |
| Engine-neutral events: `agent-protocol/SPECS.md`, Unified v2 `3 | SPECIFIED, not runnable | `agent-protocol` ACC | Map new event kinds into ACC; no second canonical `DomainEventV1` stream |
| Agent loop strategies: `agent-loop/SPECS.md`, native pi loop in `agent.ts` | SPECIFIED outer strategies; native inner engine IMPLEMENTED | `agent-loop` strategy + native engine | WorkItem claim is not its own wake scheduler/runner |
| CLI sandbox sessions: `agent-runtime/SPECS.md`, ACP contracts/ADRs, harness adapters | SPECIFIED, not runnable | SessionRuntime DO/ACP harnesses | WorkItem completion/review never overwrites ACP run state |
| Approved scheduling: `gatekeeper-scheduler/src/{scheduler,schedule-driver}.ts` | IMPLEMENTED durable alarm/hooks | Scheduler Gatekeeper | No second cron, timer DO, scheduling/recurrence schema |
| External capability grants/actions/observation: `workshop-shared/src/gatekeeper.ts`; `overseer.ts`; `gatekeeper-kit` | IMPLEMENTED | Workshop approval + Gatekeeper session | WorkItem human review is not provider action approval or ACP tool permit |
| MCP import: `mcp-shared/src/*`, `gatekeeper-mcp`, `gatekeeper-mcp-portal` | IMPLEMENTED MCP client connectors | Existing shared MCP client trust | Do not fork BYO/vetted classification/OAuth/cache; import != export |
| Agent-facing tool metadata: `agent-tool-registry/SPECS.md` | SPECIFIED, not runnable | `agent-tool-registry` | Publish new tool manifests here; no domain-specific parallel registry |
| Public MCP server/HTTP export: `agent-tool-gateway/SPECS.md` | SPECIFIED, not runnable | `agent-tool-gateway` | Add tool projections to this server; no `mcp-domain-gateway` deployment |
| Context documents/skills/search: `gatekeeper-context/src/{library-gatekeeper,context-api,context-collection,agent-skill}.ts` | IMPLEMENTED (private account + domain-public collections) | Context Gatekeeper | No duplicate document/skill library; new memory only for **workspace-scoped structured facts and learning reviews** missing from current Context model |
| Chat compaction/summary: `workshop-backend/src/{agent-compaction,overseer}.ts` | IMPLEMENTED | Overseer chat | Continuity projection cannot mutate or replace chat checkpoints |
| Trusted external chat ingress: `workshop-backend/src/external-message-gateway.ts`; `workshop-shared/src/external-message-gateway.ts` | IMPLEMENTED service-bound inbound chat routing | Workshop | New Mailbox is separate **agent↔agent channels/offline receipts**, not another ingress or chat history |
| User notifications: `workshop-backend/src/notification-service.ts`; `docs/notifications.md` | IMPLEMENTED fixed templates for chat task completed/permission | Workshop notification service | Do not duplicate push/device credentials or assume a freeform message template exists |
| Workspace approval/action audit: `overseer.ts`, `workshop-shared/src/gatekeeper.ts` | IMPLEMENTED | Workshop | Review decisions remain separate; no competing external-action audit |
| Operational logs, spans/metrics: `observability/SPECS.md`, `src/*`; `agent-tracing.ts` | IMPLEMENTED telemetry library | Observability | Diagnostic events are not canonical domain events; no duplicate audit Worker |
| Existing agent session UI: `workshop-frontend/src/features/agent-sessions/SPECS.md` | SPECIFIED UI extension, not full implementation | Existing Workshop feature | Extend one Agents view, not second agent management application |

Evidence references are source paths and normative package specs inspected at baseline; they are **not** a line-by-line audit of all 1,800+ files. Any implementation PR must confirm the exact owner paths and behavior again against its then-current base SHA.

## 3. Feature ownership (uploaded PDR F01–F16)

| PDR | Decision | Responsible module | New work |
|---|---|---|---|
| F01 auth | REUSE | Workshop auth | MCP agent credential bridge only |
| F02 workspaces | REUSE | Workshop | Map verified workspace grants, do not duplicate membership |
| F03 agents/presence | EXTEND SPECIFIED | agent-control-plane | External client identity/heartbeat linked to AgentDefinition |
| F04 MCP server | EXTEND SPECIFIED | agent-tool-gateway + tool-registry | Authorized export, schemas, conformance/OAuth |
| F05 goals/projects | EXTEND SPECIFIED | agent-control-plane workboard subdomain | Goal + optional Project; one task relation |
| F06 work item DAG/lease | EXTEND SPECIFIED | agent-control-plane workboard subdomain | **WorkItem** distinct from execution `Task`; DAG/review/claim |
| F07 delegation | EXTEND SPECIFIED | agent-control-plane + NEW Mailbox | Subagent grants/Task lineage distinct from WorkItem assignment; durable notification |
| F08 DMs/channels/offline inbox | NEW ONLY WHERE GAP | agent-mailbox | Ordered workspace channel/receipts; existing chat ingress untouched |
| F09 structured memory | NEW ONLY WHERE GAP | agent-memory (workspace facts) + Context adapter | Fact revisions/provenance; reuse Context for documents/skills |
| F10 learning review | EXTEND F09 | agent-memory | Human reviewed promotion only |
| F11 continuity | EXTEND SPECIFIED | agent-control-plane projection via ACC | Ledger projected from source references; Overseer compaction untouched |
| F12 activity | REUSE + EXTEND | agent-protocol ACC + CP outbox + Observability | Read-only authorized projection; no new audit authority |
| F13 approvals | REUSE + WORKITEM REVIEW | Workshop/Gatekeepers/ACP + CP WorkItem review | **Three separate decision namespaces** |
| F14 UI | EXTEND EXISTING | workshop-frontend existing agent-sessions | Views integrated with existing shell |
| F15 recovery | REUSE + EXTEND | CP Tasks/WorkItem, Mailbox DO, ACP Runtime, Scheduler | Idempotency/outbox/fencing per owning state machine |
| F16 operations | REUSE + EXTEND | Observability, runtime, integration tests, R2 | Per-module metrics/backup plans; no duplicate infra |

## 4. Overlap resolution — contracts that must not be merged

**Execution Task vs deliverable WorkItem:** existing v2 `Task` is an engine execution/task-control record with `Execution`, loops, budgets, `OUTCOME_UNKNOWN`. PDR `task.*` is a project deliverable with DAG/claim/review/DoD. Keep separate types and lifecycles; map a claimed WorkItem to zero or more Control Plane Tasks via validated `workItemId` foreign correlation. Public MCP names `task.*` may be retained as a **presentation alias** for WorkItem under Tool Registry; don't expose the internal execution task under the same public name.

**Overseer chat vs Mailbox:** an Overseer chat persists user/assistant/tool turns and queued callable-agent method calls; Mailbox holds directed durable messages for agent/human recipients (ordered by channel, offline read receipts). Interoperation is an explicit bridge/projection, not writing arbitrary mailbox data to `chats` or calling `spawnCallable` on each message.

**Context vs memory:** Context owns collections, documents, skills and account-private/domain-public scopes with read-observation authorization. Proposed workspace memory owns only structured memory assertions/learning review linked to sources and workspace grants. No generic document files, skill management, second search across Context collections or new ambient unrestricted writer. Existing Context APIs are used through a scoped adapter for sources and authorized publication.

**Event/approval/notification split:** ACC is the canonical presentation event schema; each owner keeps its durable state/journal and private outbox. Workshop action approval and ACP tool permission remain authoritative; WorkItem review never implies either. Notification delivery uses existing device service only after a template/API extension and consent, not a second push provider.

**Time vs continuation:** ScheduleDriver owns recurrence and hook approval. Control Plane/agent-loop owns task-specific continuation/sleep. Never register a fresh recurring schedule for every loop iteration.

## 5. Remaining verification and no-go gates

- Existing agent-control-plane/agent-tool-gateway/ACC files are specs and plans only; check build/deploy artifacts before treating as operational.
- Prove whether workspace memory can reuse Context storage safely without changing account-private/public semantics; if so, collapse `agent-memory` into a Context extension after security review. Separate persistence is permitted only for a justified workspace ACL gap.
- Investigate whether Mailbox can reuse a safe subset of existing chat callbacks; do not overload them unless exact receipt/offline/ordering semantics are demonstrated.
- Establish human/agent OAuth issuer, key rotation and revocation without trusting user-supplied actor headers.
- Review PDR's 2026 MCP version/interop against pinned protocol fixtures before advertising transport versions.
- Generate schemas, migrations, tests, staging evidence and negative tenant/permission/retry tests before any runtime claim.

**Review outcome:** target architecture is an **extension of Unified Agent Platform v2**, with two bounded new domain capabilities at most, not a second multiagent OS.
