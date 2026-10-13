# Existing MCP Shared Library — reuse and export parity — plan.md

**Situação:** PLANEJADO; o package já existe e o plano NÃO significa substituir sua implementação atual. **User input:** [U-006](../../docs/architecture/USER_INPUT_LEDGER.md). **Contrato:** [Unified v2](../../docs/architecture/AGENT_PLATFORM_UNIFIED_V2.md).

## Base atual, fonte e regras de destilação

Existing MCP import remains the only OAuth/endpoint validation/readOnlyHint classifier; a new Agent Tool Registry may project its scoped catalog but cannot copy classification, widen a BYO tool or treat unvetted annotations as authority. Exported MCP server is owned by agent-tool-gateway, not by mcp-shared client.

**Fontes reais:** mcp-shared SPECS/README, tools.ts, client.ts, catalog.ts and existing BYO/portal Gatekeepers; no assumption that MCP client implements a server.

## Etapas de implementação e validação

- [ ] **01. Inventory mcp-shared tool classification, OAuth session/endpoint pinning, catalog bounds, source trust and owner-only sharing rules.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **02. Define safe immutable imported ToolManifest projection without exporting credentials, RpcStub or broader scopes than connected facet.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **03. Add thin adapter to Tool Registry that refers to existing classification results and current policy fingerprint, not user-supplied annotations.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **04. Keep BYO versus vetted portal auto-approval distinction; refresh catalog revisions and revoke cached grant on policy change.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **05. Verify effectful imported MCP calls still stage submitAction and execute only applyAction; export of native capabilities uses gateway own auth.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **06. Add tests for annotations mutation, catalog truncation, endpoint repoint, cross-server scope and observer rejection.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **07. Document inbound MCP server non-goals and run existing MCP connector regression suite plus new native/ACP tool integration.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

## Arquivos propostos e relações

```text
packages/mcp-shared/
  src/tools.ts (single existing trust/classification authority)
  src/catalog.ts + src/client.ts (retain)
  src/agent-tool-registry-adapter.ts (thin new export)
  src/__tests__/{catalog-export-parity,approval-classification,revoked-grant}.test.ts
```

## Gates de aprovação, migração, aceite

- [ ] Comparar código atual na main com os contratos e criar testes de caracterização antes de mexer em fluxos ativos.
- [ ] Preservar compatibilidade com Workshop Cap'n Web, AgentSpawnerConfig, Scheduler approved hooks e mcp-shared trust; toda nova capability precisa de escopo e eventual revisão de API Gatekeeper.
- [ ] Revisar schema/versão, origem dos dados, IDs, evento/projection cursor, storage migrations e auditoria de observações/ações.
- [ ] Definir falhas/UNKNOWN outcomes, idempotência, replay, timeout, revogação, quotas, aprovação e isolamento de workspace.
- [ ] Validar pnpm configs:check / build / test / lint quando código for alterado; staging E2E para rotas, containers ou integração de serviços.
- [ ] Registrar evidência source→target→tests na [matriz](../../docs/architecture/ACP_MIGRATION_MATRIX.md) e no [user ledger](../../docs/architecture/USER_INPUT_LEDGER.md), distinguindo o que só foi planejado.

**DoD:** todas etapas relevantes com testes e evidência; nenhuma API pública/MCP nova sem autorização e revisão de contrato.
