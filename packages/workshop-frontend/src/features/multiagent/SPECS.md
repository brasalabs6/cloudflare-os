# Workshop Multiagent UI — SPECS

**Kind:** proposed feature inside existing `workshop-frontend`; implementation pending.
**Traceability:** F01/F02/F03, F05–F14, AC12/AC17.

## Scope and source

Implement the multiagent management surface inside existing React/Vite Workshop, not a separate Next.js application. All privileged interactions use authenticated Workshop RPC and **the same** domain services used by MCP. Reuse existing app shell, identity/permissions, responsive component library, approval and agent-session patterns. This feature has **no** business state authority.

## Information architecture

Navigation: Multiagent dashboard; Agents/Instances; Goals/Projects and Task DAG/Kanban; Messages (workspace channels, DMs, inbox); Memory & Learning; Continuity; Approvals; Activity/Audit; Automation/Schedules (only when executor is available); Settings.

Tasks detail shows DoD, dependencies, derived blockers, assignee, claim owner/expiry, evidence, review decision, outbox delivery status, correlation to ACP session/run if present. UI can create/edit/assign and human-review via typed, versioned APIs; optimistic conflict uses current version and safe retry/reload, never overwrites silently. Use keyboard accessible alternatives for drag/drop.

Agent presence must distinguish `registered`, `online heartbeat`, `idle`, `managed run active` and `offline`. Mailbox views differentiate sent/persisted, delivered to recipient mailbox and acknowledged/read; neither is proof an agent acted. ACP `OUTCOME_UNKNOWN` is an explicit state, not a success toast. Continuity shows snapshot revision/provenance, source event cursor and stale indicator; learning queue shows pending/unreviewed vs approved.

## Authorization and update model

Hide unauthorized controls as UX but enforce authorization on every server operation. All read views are scoped to chosen verified workspace; switching workspace invalidates caches, subscriptions and cursors. Use bounded polling/subscriptions (per existing backend mechanisms), idempotent mutation keys, reconnect cursor and snapshot recovery; browser disconnect never cancels a task/run. Tool outputs/memory/messages are untrusted text and must be safely rendered. Reuse existing authenticated approval pages for sensitive actions rather than a parallel privileged approval UI.

## Acceptance and accessibility

Covers AC01, AC04, AC07–AC13, AC16–AC17 via browser E2E with real domain adapter; responsive at mobile widths, keyboard only, accessible focus, visible pending/retry/conflict states, empty/loading/error states. Test cross-workspace navigation, stale lease, offline recipient, duplicate event replay, learning review, status honesty and ACP link to existing `features/agent-sessions/SPECS.md`.
