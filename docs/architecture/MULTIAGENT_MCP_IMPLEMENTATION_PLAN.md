# Multiagent MCP — Implementation plan, traceability and release gates

**Status:** planning and proposed acceptance contract; docs-only PR, no runtime implementation. **Date:** 2026-10-13.
**Requirements source:** uploaded `multiagent-mcp-mvp-docs.zip` (`pdr.md` / `specs.md`, 2026-10-13). See [domain contracts](./MULTIAGENT_MCP_CONTRACTS_V1.md), [architecture](./MULTIAGENT_MCP_PLATFORM.md) and [security](./MULTIAGENT_MCP_SECURITY.md).

## 1. Intent and scope adjustment

The original MVP selected Next.js, PostgreSQL and a separate long-lived Node worker; its coordination boundary expressly excludes waking disconnected external agents. **Adaptation:** preserve PDR behavior and IDs but implement inside existing Cloudflare OS Workshop (React/Vite, RPC, capability grants), domain DO owners and one new MCP server gateway. Managed ACP execution remains a **parallel, independently staged** feature based on existing [ACP architecture](./ACP_AGENT_PLATFORM.md); do not mark an ACP requirement as delivered by this docs PR or use MCP transport to imply remote execution.

Core work may be deployed independently after contracts mature. The platform MUST NOT create a second Workshop kernel, authentication database, Gatekeeper approval queue or authoritative ACP run store.

## 2. PDR feature-to-owner matrix

| Requirement | Ownership/reuse | Proposed package/doc |
|---|---|---|
| F01 human auth | **Reuse** Workshop auth/sessions | `workshop-backend` / `workshop-shared` |
| F02 workspace membership | **Reuse** Workshop Overseer/user DO | `workshop-backend` |
| F03 agent registration, grants, presence | **New** stable directory; Workshop is grant root | `agent-directory` |
| F04 remote MCP tools/resources | **New** server facade (not existing client Gatekeepers) | `mcp-domain-gateway` |
| F05 goals/projects | **New**, colocated task authority | `agent-goals-tasks` |
| F06 tasks, DAG, claim and lease | **New**, single Tasks DO transaction authority | `agent-goals-tasks` |
| F07 delegation | **New** task assign + outbox + mailbox consume | `agent-goals-tasks` / `agent-mailbox` |
| F08 channels, DMs, offline inbox | **New** transactional mailbox | `agent-mailbox` |
| F09 memory/provenance/revisions | **New**, integrate existing Context only via contracts | `agent-memory` / `gatekeeper-context` |
| F10 learning proposals/review | **New**, human review and audit | `agent-memory` |
| F11 continuity/recovery of logical context | **New** projection, not ACP checkpoint | `agent-continuity` |
| F12 activity/audit | **New** redacted domain event projection; reuse observability | `agent-audit` |
| F13 approvals | **Reuse** canonical Workshop/Gatekeeper/ACP approval scopes; add domain review model | `workshop-shared`, `gatekeeper-kit`, domain modules |
| F14 web UI | **New** feature in existing Workshop | `workshop-frontend/src/features/multiagent` |
| F15 recovery/claims/outbox/idempotency | **New** per-module contract + existing runtime recovery (when available) | `agent-goals-tasks` / `agent-audit` / ACP specs |
| F16 operating/backup/diagnostics | **Reuse** Workers tooling + **new** module runbooks/tests | `observability`, `integration-tests`, owning modules |

Later extensions E01/E02/E07 (universal runner, remote trigger, recursive autonomous spawning) are NOT part of the initial external MCP coordination acceptance; implement **only** after runtime/security/automation gates. Later E03/E04/E10/E11/E12 remain optional with independent review.

## 3. Acceptance (source AC01–AC18)

| AC | Gate / target evidence |
|---|---|
| AC01 | A/B workspaces isolated across UI, MCP, RPC and owner storage; T01/T02 |
| AC02 | 3 independently identified MCP agents; `whoami` / TTL presence; T03 |
| AC03 | auth, OAuth consent, expiry/revoke immediate denial; T04/T05 |
| AC04 | offline B sees assigned task and mailbox on reconnect, no execution claim; T06/T30 |
| AC05 | simultaneous claim yields one lease; stale/expired epoch denied; T07/T08 |
| AC06 | dependency blockage and cycle error; T09/T10 |
| AC07 | reassignment and independent review, no self-review; T11/T11b/T12 |
| AC08 | direct DM + channels with per-channel order/receipts, idempotency; T13/T13b/T14/T26 |
| AC09 | memory revision, search, archive + audit; T15 |
| AC10 | proposed learning requires authorized decision; T16 |
| AC11 | continuity reconstruction from new client + canonical task/inbox reads; T17 |
| AC12 | responsive keyboard-only flows and mobile operation; T18 |
| AC13 | sensitive approval bound to target hash/version and acting principal; T19 |
| AC14 | crash at commit/ack, retry without duplicate mutation, same key changed body fails; T20/T27 |
| AC15 | authorized structured export + isolated integrity-verified restore, deny unauthorized export; T21/T21b |
| AC16 | log redaction and critical action actor/correlation metadata; T22 |
| AC17 | registered not online; persisted message not necessarily acted upon; T23/T30 |
| AC18 | pinned 2026-07-28 protocol conformance and explicitly supported/tested 2025 client; T24/T25 |

These are **acceptance targets**, not passing test evidence. Preserve original source tests T01–T30 in an implementation test plan. The PDR targets (5 workspaces / 25 agents / 1,000 tasks / 20,000 messages; mobile WCAG 2.2 AA goal) are performance/accessibility validation targets, not observed production measurements.

## 4. Sequenced deliverables / PR boundaries

| Gate | Delivery | Prerequisite/acceptance |
|---|---|---|
| G0 — Docs/contract approval | ADRs 0004/0005; proposed schemas, API/catalog, risks, traceability | Reviewer agrees ownership and naming; **this PR only** |
| G1 — Auth + directory | identity mapping, auth audience/revoke, `agent.whoami`, strict workspace scope | AC01–AC03 auth suites |
| G2 — Task core | Goals/Tasks DO, CAS/idempotency, DAG cycle checks, leases/review | AC05–AC07; fault injection |
| G3 — Mailbox/outbox | Mailbox DO, DM/channel/ack, durable producer/consumer | AC04/AC08/AC14; crash-after-commit test |
| G4 — Memory/learning/continuity | revision/provenance, review, source cursors | AC09–AC11 |
| G5 — MCP server interoperability | single gateway, schemas/tool/resource discovery, OAuth, 2026 and compatible 2025 client | AC02/AC03/AC18 with at least two distinct MCP hosts |
| G6 — Workshop UI + ops | dashboard, task DAG, inbox, review, continuity, audit, metrics/backup | AC12/AC15–AC17 and mobile/browser E2E |
| G7 — Managed autonomy (separate release) | ACP runtime + Gatekeepers + Scheduler adapter + automation DO/loop policies | Real Grok/Codex/OpenCode ACP E2E, stop/reconcile, budgets/kill switch, restore/rollback |

G1–G5 MAY be developed in smaller independently reviewed PRs; avoid broad changes to `workshop-backend` and `workshop-shared`. Implement per-package `SPECS.md` before its code. Every G gate requires code, schema/migrations, tests and staging evidence to claim completion. No feature is DONE just because it is documented or an HTTP route returns 200.

## 5. Deployment, observability and migration rules

- Follow repository's existing pnpm/Wrangler/release manifests and service-binding discovery. Proposed `packages/*/SPECS.md` directories do not imply deployability. Separate Worker requires explicit `wrangler.jsonc`, bindings, environment/secrets, rollout and tests.
- Reuse Workshop identity/grants and existing Scheduler's bind-before-enable approved hooks. No Postgres table migration or separate Next.js app is proposed.
- Produce a deployment-specific data-retention table, quotas, DO SQLite migrations, R2 export/checksums, restore drill, alarm/job recovery and observability dashboards before public access.
- Existing ACP specs/ADRs 0001–0003 must remain authoritative on harnesses, egress and permission boundaries. Coordinate any ACP-specific changes via `ACP_MIGRATION_MATRIX.md` rather than quietly copying GrokBot source into domain services.
- Record tests by commit + environment (unit, DO concurrency, integration, browser, staging real runtime, production smoke). Do not mark green from a mock alone.

## 6. Open review decisions (not hidden assumptions)

1. Directory issuance/credential lifecycle: reuse or extend Workshop account identity; exact OAuth issuer/audience/client registration strategy.
2. DO topology: workspace-keyed Tasks authority; Mailbox partition strategy for channel ordering and per-recipient inbox; memory/continuity package co-deploy vs separate Worker.
3. Outbox retry, dead-letter, consumer dedupe and event retention windows under actual Cloudflare limits.
4. Exact JSON Schema, tool argument casing, MCP version/header fixtures and portable skills/resources catalog.
5. Risk classification for Task review vs Gatekeeper action vs ACP tool approval; delegated reviewer policies.
6. Budget units/kill-switch responsibility and stale/ambiguous ACP run outcome reconciliation for managed autonomy.
7. Backup/export encryption, checksums, retention and SLO targets based on staging measurements.

Owners should resolve these before turning provisional contracts into deployable code, not claim they have been answered by this document.
