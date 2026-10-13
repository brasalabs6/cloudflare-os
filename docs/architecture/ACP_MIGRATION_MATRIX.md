# ACP platform migration matrix

**Purpose:** track each GrokBot/Hub capability against the Cloudflare OS destination without treating existing code or staging results as proof of production readiness.

Status values:
- COVERED: equivalent platform capability exists and should be reused.
- PORT: implementation exists elsewhere and must be adapted to Cloudflare OS boundaries.
- NEW: implementation is missing in the target.
- VERIFY: code exists or staging evidence exists, but target acceptance is not yet proven.
- DEFER: explicitly outside the first usable release.

| Capability | Source/reference | Status | Target / acceptance |
|---|---|---|---|
| Identity, workspace and membership | Cloudflare OS Workshop | COVERED | Reuse authenticated Workshop context; no parallel identity model |
| Agent spawn / existing Code Mode | Cloudflare OS agent-spawner binding | COVERED | Extend only where CLI-session semantics are missing |
| Gatekeeper capability and approval APIs | workshop-shared + gatekeeper-kit | COVERED | Follow canonical Gatekeeper contracts |
| Grok Build in isolated Cloudflare Container | GrokBot PR #1 | PORT + VERIFY | Agent Runtime; real sandbox E2E on target branch |
| Session/run/operation state separation | GrokBot agent runtime | PORT | DO-authoritative state with idempotency and generation fencing |
| ACP JSON-RPC supervisor | GrokBot + Hub ACP manager | PORT | acp-core, bounded frames, timeouts, cancellation and normalized events |
| Codex via codex-acp | ACP adapter project; Hub currently has App Server path | NEW + VERIFY | Pin adapter, define auth, pass ACP contract tests |
| OpenCode via opencode acp | Official OpenCode ACP | NEW + VERIFY | Pin version and validate negotiated features |
| Harness registry and model/mode metadata | Hub harness registry/catalog | PORT | Versioned manifests; live negotiated capabilities override static claims |
| Real PTY terminal and reconnect | GrokBot / PR #2 UX | PORT + VERIFY | Computer capability, single-use tickets and generation binding |
| File browser / bounded file reads | GrokBot + Workshop file features | PORT + VERIFY | Root-scoped, traversal/symlink-safe and observation-authorized |
| Event journal and browser replay | GrokBot session runtime | PORT | Monotonic per-session sequence, schema version and bounded retention |
| Checkpoint / restore | GrokBot staging work | VERIFY | Fresh-sandbox restore and checksum validation; do not assume process memory persists |
| Independent R2 backup | GrokBot release gate | VERIFY | Demonstrate restore into new sandbox and verify checksum |
| Trusted inference egress | GrokBot sandbox runtime | PORT + VERIFY | Worker-side credentials, explicit destinations, deny-by-default |
| Permission requests from ACP tools | GrokBot + Hub | PORT + VERIFY | Bind approval to session/run/generation/tool-call and expire safely |
| Artifacts and generated files | Workshop Gadgets / bundled blueprints | COVERED / GAP REVIEW | Reuse existing features; document only concrete missing artifact types |
| Multi-agent scheduling | Workshop spawner, scheduler and context Gatekeepers | COVERED / GAP REVIEW | Do not duplicate orchestration until a concrete CLI-specific gap is shown |
| Sticky A/B release assignment | New platform requirement | NEW | Persist release assignment at session creation and test rollback |
| Cost, quotas and kill switch | Existing observability + new runtime | NEW / VERIFY | Per-release metrics, limits and operator control |
| UI for multiple CLI sessions | Workshop frontend | NEW | Agent Sessions feature with replay, approvals, terminal and status |
| Historical GrokBot data migration | GrokBot database | DEFER | Read-only inventory and dry-run plan before any import |

## Rules for closing migration rows

Every row must end as one of: MIGRATED, ALREADY_COVERED, DEFERRED_WITH_REASON, OBSOLETE_WITH_REASON or BLOCKED_WITH_EVIDENCE. Add a pull request, test result or code reference before claiming completion. Staging and production results must be labeled separately. Do not migrate GrokBot Postgres tables by default; first determine whether the existing Workshop data model covers the use case.


## Functional traceability — Grokbot F-001 to F-017

Source: `brasalabs6/grokbot`, PR #1 (`feat/grokbot-p00-acp-cloudflare-spike`); **source implementation is staging evidence, not new-platform acceptance**. Every row is initially OPEN and must be closed with target file, commit, test and staging evidence.

| Feature | Source proof / code to distill | Target package(s) | Initial work |
|---|---|---|---|
| F-001 Identity/access | `lib/auth/access-policy.ts`, access-policy tests | Workshop + Coding Agents Gatekeeper | REUSE + cross-workspace contract tests |
| F-002 Dashboard | `components/agent-sessions/dashboard.tsx` | Workshop UI | PORT state/status, search, operator actions |
| F-003 Create wizard | `lib/agent/contracts.ts`, `app/api/agent-sessions/route.ts` | UI + Registry + Directory | PORT validation, release selection |
| F-004 Session page | `session-detail.tsx` | Workshop UI | PORT session layout, status, tabs |
| F-005 ACP chat | `acp-chat.tsx`, `lib/agent/run-permit.ts` | Runtime + ACP Core + UI | PORT idempotent prompt and run reconciliation |
| F-006 Streaming/replay | `lib/agent/acp-events.ts`, events routes | Runtime DO + UI | PORT ordering; NEW retention-floor semantics |
| F-007 Tool timeline | `acp-chat.tsx`, runtime ACP updates | ACP Core + UI | PORT normalized tool lifecycle |
| F-008 Approvals | permission UI, ACP ticket/runtime code | Coding Agents + Runtime | PORT; resolve distinct Workshop/ACP approval contracts |
| F-009 Models/inference | `config/grok-models.toml`, `ai-gateway.ts` | Registry + Egress | PORT allowlisted model/proxy behavior |
| F-010 PTY/tmux | `agent-terminal.tsx`, `services/sandbox-runtime/src/index.ts` | Computers Gatekeeper + Runtime + UI | PORT generation tickets, reconnect and PTY |
| F-011 Files | `file-browser.tsx`, files route, workspace tool | Computers Gatekeeper + Runtime + UI | PORT safe reads; ADD writes/uploads only with grants |
| F-012 Git | workspace helpers, Grokbot F-012 contract | Runtime + Computers + UI | NEW/VERIFY status, diff and git clone controls |
| F-013 Lifecycle | `lib/agent/lifecycle.ts`, reconciler routes | Runtime DO + UI | PORT state transitions, stop/suspend/resume/delete |
| F-014 Logs | runtime status, health and diagnostics | Runtime observability + UI | NEW structured log/timeline projection |
| F-015 Notifications | Grokbot F-015 acceptance | UI | NEW operation result and async feedback |
| F-016 Preview | Grokbot feature deferred P1 | Computers ingress | DEFER pending authenticated port-proxy design |
| F-017 Usage | inference proxy usage and Grokbot P1 spec | Egress + metrics | VERIFY token/cost estimate, no billing claim |

## Extraction inventory with immutable provenance

- Grokbot reference: [PR #1](https://github.com/brasalabs6/grokbot/pull/1), head `9171b11c7269f6f305e99fd697a4dd885aad5459` at review; pin exact source blob hashes for every ported module before deleting/replacing source. Keep a permanent link to CI staging evidence and regression fixtures.
- Cloudflare OS legacy PR #2: closed without merge; preserve only typed errors, terminal parsing/test behavior and Container API lessons after reviewing compatibility.
- Cloudflare OS legacy PR #3: closed without merge; repository sweep snapshot, not a runtime architecture.
- Hub reference: `src/runtime/acp/acp-client.manager.ts` and `src/runtime/acp/acp-stdio.transport.ts`; port protocol behavior only, not NestJS/Redis/Postgres or generic App Server coupling.
- Archive Grokbot only after immutable provenance, test fixtures and implementation/source evidence are explicitly preserved. Archive does not mean delete the repository or its PR history.

## Required row evidence fields

```typescript
type MigrationEvidence = {
 featureId: `F-${string}`; sourceRepo: string; sourceCommit: string;
 sourcePaths: string[]; targetPaths: string[]; targetCommit: string|null;
 contracts: string[]; tests: string[]; stagingRunUrl: string|null;
 productionRunUrl: string|null;
 disposition: "MIGRATED"|"ALREADY_COVERED"|"DEFERRED_WITH_REASON"|"OBSOLETE_WITH_REASON"|"BLOCKED_WITH_EVIDENCE";
 rationale: string;
};
```

A status of MIGRATED requires a real target-runtime E2E where applicable, not merely a GitHub commit or matching types. The normative payload and state contracts are specified in [ACP_CONTRACTS_V1.md](./ACP_CONTRACTS_V1.md).


## Agent platform v2 expansion

See [AGENT_FEATURE_TRACEABILITY.md](./AGENT_FEATURE_TRACEABILITY.md) for F-001…F-017 plus Native Workshop N-001…N-005 and autonomous/extension features A-001…A-011. ACP-only status rows above remain valid for the CLI slice but are not a complete user-agent platform implementation. The new normative platform semantics are in [AGENT_PLATFORM_UNIFIED_V2.md](./AGENT_PLATFORM_UNIFIED_V2.md). All target features remain OPEN until code, schema, tests and staging evidence exist.
