# Workshop Frontend — unified agent navigation and views — plan.md

**Situação:** PLANEJADO; o package já existe e o plano NÃO significa substituir sua implementação atual. **User input:** [U-006](../../docs/architecture/USER_INPUT_LEDGER.md). **Contrato:** [Unified v2](../../docs/architecture/AGENT_PLATFORM_UNIFIED_V2.md).

## Base atual, fonte e regras de destilação

Integrate new feature-owned agent management into existing SPA navigation and Cap'n Web connection provider, using current Kumo UI patterns and avoiding a second authentication, query cache or approval interface. Native Code Mode must keep its current conversation UX; new Agent task drill-down is additive.

**Fontes reais:** Existing Workshop frontend SPECS, Kumo/@gadgets/ui, Grokbot dashboard/chat/file/terminal UI and F-001..F-017.

## Etapas de implementação e validação

- [ ] **01. Inventory current SPA routes/providers/chat and Grokbot dashboards; map F-001..F-017 to new screens and existing controls.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **02. Design additive navigation Agents -> Agent Detail -> Tasks -> Task Detail -> child graph, triggers and usage, preserving native chat entry points.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **03. Wire shared ACC event models into current Cap'n Web provider and handle offline replay without making the frontend durable authority.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **04. Implement linking AgentDefinition to native chats, CLI sessions and external Task runs, with correct source badges and unsupported capability states.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **05. Use Kumo/@gadgets/ui for accessible controls, bounded tool/approval display, mobile/focus and notification integration.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **06. Run browser/integration regression of old Workshop chat, approvals, Workpieces and new agent/task flows across engines.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

## Arquivos propostos e relações

```text
packages/workshop-frontend/
  src/features/agent-sessions/ (new unified screens described in nested SPECS.md)
  src/router/ (route integration; inspect existing layout)
  src/__tests__/agent-navigation.browser.test.tsx
```

## Gates de aprovação, migração, aceite

- [ ] Comparar código atual na main com os contratos e criar testes de caracterização antes de mexer em fluxos ativos.
- [ ] Preservar compatibilidade com Workshop Cap'n Web, AgentSpawnerConfig, Scheduler approved hooks e mcp-shared trust; toda nova capability precisa de escopo e eventual revisão de API Gatekeeper.
- [ ] Revisar schema/versão, origem dos dados, IDs, evento/projection cursor, storage migrations e auditoria de observações/ações.
- [ ] Definir falhas/UNKNOWN outcomes, idempotência, replay, timeout, revogação, quotas, aprovação e isolamento de workspace.
- [ ] Validar pnpm configs:check / build / test / lint quando código for alterado; staging E2E para rotas, containers ou integração de serviços.
- [ ] Registrar evidência source→target→tests na [matriz](../../docs/architecture/ACP_MIGRATION_MATRIX.md) e no [user ledger](../../docs/architecture/USER_INPUT_LEDGER.md), distinguindo o que só foi planejado.

**DoD:** todas etapas relevantes com testes e evidência; nenhuma API pública/MCP nova sem autorização e revisão de contrato.


## No-overlap integration correction (2026-10-13)

Reference: [Existing module authority audit](../../docs/architecture/EXISTING_MODULE_BOUNDARIES_AUDIT.md), root SPECS §23. **Owner:** The SPA already owns login/RpcContext, chat, action approvals, notifications, resource routing and Kumo UI. Unified Agent views are additive feature slices not new identity/approval client.

**Gate before implementation:** Build AgentDefinition/task screens against current AuthenticatedApi, reuse existing tool/Gatekeeper approvals and accessible shared components; preserve old ChatInterface, Workpieces, Connections and notification UX.

Any new agent-platform feature must preserve existing approved observations/actions, tenant scopes, Cap'n Web contract and consumer regressions. A documented proposed integration is not deployed functionality.
