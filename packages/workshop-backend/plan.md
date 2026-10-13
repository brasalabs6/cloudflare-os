# workshop-backend — implementation plan (roadmap gated)

**Status:** Fase 1 ACTIVE. **Normative sequence:** [ROADMAP](../../ROADMAP.md); [minimal Grok MVP](../../docs/architecture/PHASE1_GROK_MVP.md). The older all-at-once multi-agent implementation plan was superseded and survives in Git history only.

## Current owner and non-overlap

Overseer continua autoridade de identidade, workspace, chat, autorização, histórico, callbacks e notificações. Nova integração deve abrir/enviar ao Grok via service binding privado; só chats opt-in Grok desviam de pi-agent-core; chats nativos permanecem idênticos.

## Phase 1 — ordered steps

- [ ] **F1-01** Caracterizar mensagens, histórico, turnos, streaming, reconnect e cancelamento de ChatInterface/Overseer.
  - Acceptance: source/target diff, contract coverage, regression tests and Cloudflare staging evidence when integration requires it.

- [ ] **F1-02** Definir vínculo opcional engine='grok' por chat, com default native para registros existentes e sem migrar AgentSpawner.
  - Acceptance: source/target diff, contract coverage, regression tests and Cloudflare staging evidence when integration requires it.

- [ ] **F1-03** Adicionar service binding privado do Workshop para o único agent-runtime e registrar configuração nos geradores/release manifests.
  - Acceptance: source/target diff, contract coverage, regression tests and Cloudflare staging evidence when integration requires it.

- [ ] **F1-04** Persistir input chat exatamente uma vez; só no chat Grok admitir run e encaminhar prompt com idempotencyKey e scope derivado de Overseer.
  - Acceptance: source/target diff, contract coverage, regression tests and Cloudflare staging evidence when integration requires it.

- [ ] **F1-05** Consumir eventos do DO via sequência com deduplicação e persistir mensagens do assistente no histórico do chat existente; emitir eventos no subscriber atual.
  - Acceptance: source/target diff, contract coverage, regression tests and Cloudflare staging evidence when integration requires it.

- [ ] **F1-06** Distinguir aceitação vs conclusão, estado UNKNOWN e perda do processo; reconciliar sem repetir prompts inseguros.
  - Acceptance: source/target diff, contract coverage, regression tests and Cloudflare staging evidence when integration requires it.

- [ ] **F1-07** Revogação de acesso encerra permissão de novas chamadas e revoga sessão vinculada, sem cross-workspace bypass.
  - Acceptance: source/target diff, contract coverage, regression tests and Cloudflare staging evidence when integration requires it.

- [ ] **F1-08** Testes Chat/AgentSpawner nativo, observadores, múltiplos chats, transição Grok, cancel, reconnect, erro de rede e real Cloudflare E2E.
  - Acceptance: source/target diff, contract coverage, regression tests and Cloudflare staging evidence when integration requires it.

## Later phases (not authorized for implementation now)

- **Phase 2:** stabilize Grok runtime/PTY/file flows as warranted by evidence; no changes here unless existing owner applies.
- **Phase 3:** existing Scheduler and AgentSpawner may be reused for autonomous tasks/loops after Phase 1 completion.
- **Phase 4:** multi-harness adapters only once Grok runs reliably and a second implementation proves the abstraction.
- **Phase 5:** integrate [brasalabs6/mcp-registry](https://github.com/brasalabs6/mcp-registry), reusing existing MCP Gatekeepers and Workshop permissions; do not implement alternative registry/gateway.
- **Phase 6:** A/B/release rollout only after preceding gates.

**DoD:** no regressions of original module; every new step has a code commit, security/contract tests and required Worker staging proof. Documentation alone is not implementation.
