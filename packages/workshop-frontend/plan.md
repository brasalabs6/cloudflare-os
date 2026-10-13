# workshop-frontend — implementation plan (roadmap gated)

**Status:** Fase 1 ACTIVE. **Normative sequence:** [ROADMAP](../../ROADMAP.md); [minimal Grok MVP](../../docs/architecture/PHASE1_GROK_MVP.md). The older all-at-once multi-agent implementation plan was superseded and survives in Git history only.

## Current owner and non-overlap

Reusar o ChatInterface atual e RpcContext da SPA. A Fase 1 não autoriza criar dashboard separado ou feature folder agent-sessions; a experiência é chat Native/Grok usando componentes existentes.

## Phase 1 — ordered steps

- [ ] **F1-01** Caracterizar o fluxo atual de ChatInterface, model-selection, streaming, erro, cancel e reconexão; screenshots/testes existentes.
  - Acceptance: source/target diff, contract coverage, regression tests and Cloudflare staging evidence when integration requires it.

- [ ] **F1-02** Adicionar seletor Grok por chat sem confundir model config de pi-agent-core com escolha de engine e preservando chats antigos.
  - Acceptance: source/target diff, contract coverage, regression tests and Cloudflare staging evidence when integration requires it.

- [ ] **F1-03** Usar RPC já autenticado para prompt/cancel; renderizar loading, deltas, resposta e erro do Grok nos atuais tipos de mensagem.
  - Acceptance: source/target diff, contract coverage, regression tests and Cloudflare staging evidence when integration requires it.

- [ ] **F1-04** Ao voltar para o chat, recuperar histórico via Overseer existente e status de runtime sem segunda store ou endpoint do Container.
  - Acceptance: source/target diff, contract coverage, regression tests and Cloudflare staging evidence when integration requires it.

- [ ] **F1-05** Garantir acessibilidade/estados disabled, denied tool permissions e recursos não disponíveis (sem arquivos, PTY e MCP).
  - Acceptance: source/target diff, contract coverage, regression tests and Cloudflare staging evidence when integration requires it.

- [ ] **F1-06** Executar testes de browser/Kumo e E2E de prompt real do Grok + reconnect; checar ausência de regressão do chat nativo.
  - Acceptance: source/target diff, contract coverage, regression tests and Cloudflare staging evidence when integration requires it.

## Later phases (not authorized for implementation now)

- **Phase 2:** stabilize Grok runtime/PTY/file flows as warranted by evidence; no changes here unless existing owner applies.
- **Phase 3:** existing Scheduler and AgentSpawner may be reused for autonomous tasks/loops after Phase 1 completion.
- **Phase 4:** multi-harness adapters only once Grok runs reliably and a second implementation proves the abstraction.
- **Phase 5:** integrate [brasalabs6/mcp-registry](https://github.com/brasalabs6/mcp-registry), reusing existing MCP Gatekeepers and Workshop permissions; do not implement alternative registry/gateway.
- **Phase 6:** A/B/release rollout only after preceding gates.

**DoD:** no regressions of original module; every new step has a code commit, security/contract tests and required Worker staging proof. Documentation alone is not implementation.
