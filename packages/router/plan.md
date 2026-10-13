# router — implementation plan (roadmap gated)

**Status:** Fase 1 SEM ALTERAÇÕES. **Normative sequence:** [ROADMAP](../../ROADMAP.md); [minimal Grok MVP](../../docs/architecture/PHASE1_GROK_MVP.md). The older all-at-once multi-agent implementation plan was superseded and survives in Git history only.

## Current owner and non-overlap

Router público existente /api, /gatekeeper e assets deve permanecer intocado: o Grok Runtime é acessado apenas por binding PRIVADO do Workshop, não por rota pública.

## Phase 1 — no work, no deploy

- [ ] Confirm this package remains unchanged when Phase 1 code lands; run its existing regression suite and include any violations in the phase review.

## Later phases (not authorized for implementation now)

- **Phase 2:** stabilize Grok runtime/PTY/file flows as warranted by evidence; no changes here unless existing owner applies.
- **Phase 3:** existing Scheduler and AgentSpawner may be reused for autonomous tasks/loops after Phase 1 completion.
- **Phase 4:** multi-harness adapters only once Grok runs reliably and a second implementation proves the abstraction.
- **Phase 5:** integrate [brasalabs6/mcp-registry](https://github.com/brasalabs6/mcp-registry), reusing existing MCP Gatekeepers and Workshop permissions; do not implement alternative registry/gateway.
- **Phase 6:** A/B/release rollout only after preceding gates.

**DoD:** no regressions of original module; every new step has a code commit, security/contract tests and required Worker staging proof. Documentation alone is not implementation.
