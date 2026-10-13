# Generic MCP Gatekeeper — agent tool reuse — plan.md

**Situação:** PLANEJADO; o package já existe e o plano NÃO significa substituir sua implementação atual. **User input:** [U-006](../../docs/architecture/USER_INPUT_LEDGER.md). **Contrato:** [Unified v2](../../docs/architecture/AGENT_PLATFORM_UNIFIED_V2.md).

## Base atual, fonte e regras de destilação

Generic MCP Gatekeeper already imports untrusted user-selected endpoints. Agent platform consumes resource-granted tools via Gatekeeper session; adding tool registry must not alter OAuth account ownership, BYO readOnlyHint classification, staged action, scope and observer refusal.

**Fontes reais:** Existing Generic MCP Gatekeeper SPECS and mcp-shared; bound user-supplied endpoint, owner-only observers, no annotation-based auto-apply.

## Etapas de implementação e validação

- [ ] **01. Prove currently supported user OAuth endpoint pinning and BYO tool-scope/annotation behavior with tests.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **02. Create bounded tool discovery adapter exposing only granted tool descriptors and current catalog policy fingerprints.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **03. Integrate with Agent Tool Registry without granting client direct endpoint tokens, copying MCP fetch or invoking tools outside gatekeeper.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **04. Keep every read observation-authorized, every write staged and user-approved (no BYO auto-approval).**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **05. Test native engine/tool and container ACP import parity, high-latency MCP response, tool rename/revision and revocation.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **06. Document gateway MCP export is a different module, stage connector use from an independent task and subagent.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

## Arquivos propostos e relações

```text
packages/gatekeeper-mcp/
  src/mcp.ts and inherited mcp-shared classes (reuse)
  src/agent-platform-catalog.ts (optional metadata bridge)
  src/__tests__/{agent-access,scope,classification-revocation}.test.ts
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

Reference: [Existing module authority audit](../../docs/architecture/EXISTING_MODULE_BOUNDARIES_AUDIT.md), root SPECS §23. **Owner:** Generic BYO MCP already owns connected endpoint credentials, exact endpoint identity, owner-only resource sharing, mcp-shared tool classification and staged actions. Tool catalog projections must not bypass these gates.

**Gate before implementation:** Test tool import by Native Engine and ACP via granted Gatekeeper, not direct MCP client. Revocation and unvetted annotation tests mandatory.

Any new agent-platform feature must preserve existing approved observations/actions, tenant scopes, Cap'n Web contract and consumer regressions. A documented proposed integration is not deployed functionality.
