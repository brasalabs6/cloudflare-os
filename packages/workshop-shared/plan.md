# Workshop Shared RPC and Capability Contracts — plan.md

**Situação:** PLANEJADO; o package já existe e o plano NÃO significa substituir sua implementação atual. **User input:** [U-006](../../docs/architecture/USER_INPUT_LEDGER.md). **Contrato:** [Unified v2](../../docs/architecture/AGENT_PLATFORM_UNIFIED_V2.md).

## Base atual, fonte e regras de destilação

Do not add a second browser transport. Extend existing Cap'n Web AuthenticatedApi/Overseer interfaces additively with versioned ACC payloads, preserving workpiece/chat IDs and existing backend-generated stubs; any exported member needs JSDoc, no as unknown as RPC casts.

**Fontes reais:** Existing src/api.ts AgentSpawnerConfig/newAgentSpawnerGatekeeper, AiChatStreamEvent, AiToolCall; src/gatekeeper.ts vendor/account/session/approval/observer semantics.

## Etapas de implementação e validação

- [ ] **01. Document current AuthenticatedApi/Overseer/AgentSpawnerConfig methods, versions, Chat stream event shapes and type tests.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **02. Define additive AgentPlatformClient resource-oriented RPC signatures and typed errors reflecting ACC schemas and current Cap'n Web constraints.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **03. Model agent/task/engine/tool resource grants with opaque references and discriminated unions; do not expose raw Run-time tickets or provider credentials.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **04. Create shared serializer/validators with roundtrip fixtures matching agent-protocol package and avoid schema shadow copies.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **05. Implement new event projection types with source cursor and visibility, retaining current AiChatStreamEvent compatibility during migration.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **06. Review API changes with kernel maintainers, align UI hooks and Gatekeeper types, and update generated types only after Cap'n Web compatibility tests.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **07. Run no-cast lint/type checks, serialization tests, existing Chat UI tests, and staged old/new caller compatibility.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

## Arquivos propostos e relações

```text
packages/workshop-shared/
  src/agent-platform/{types,agents,tasks,events,tools,capabilities}.ts
  src/__tests__/{serialization,back-compat,capnweb-typing}.test.ts
  src/api.ts (small JSDoc-reviewed additive API extension only)
```

## Gates de aprovação, migração, aceite

- [ ] Comparar código atual na main com os contratos e criar testes de caracterização antes de mexer em fluxos ativos.
- [ ] Preservar compatibilidade com Workshop Cap'n Web, AgentSpawnerConfig, Scheduler approved hooks e mcp-shared trust; toda nova capability precisa de escopo e eventual revisão de API Gatekeeper.
- [ ] Revisar schema/versão, origem dos dados, IDs, evento/projection cursor, storage migrations e auditoria de observações/ações.
- [ ] Definir falhas/UNKNOWN outcomes, idempotência, replay, timeout, revogação, quotas, aprovação e isolamento de workspace.
- [ ] Validar pnpm configs:check / build / test / lint quando código for alterado; staging E2E para rotas, containers ou integração de serviços.
- [ ] Registrar evidência source→target→tests na [matriz](../../docs/architecture/ACP_MIGRATION_MATRIX.md) e no [user ledger](../../docs/architecture/USER_INPUT_LEDGER.md), distinguindo o que só foi planejado.

**DoD:** todas etapas relevantes com testes e evidência; nenhuma API pública/MCP nova sem autorização e revisão de contrato.
