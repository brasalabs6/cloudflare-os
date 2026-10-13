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
