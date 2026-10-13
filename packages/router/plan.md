# Cloudflare OS Router — scoped agent HTTP/MCP ingress — plan.md

**Situação:** PLANEJADO; o package já existe e o plano NÃO significa substituir sua implementação atual. **User input:** [U-006](../../docs/architecture/USER_INPUT_LEDGER.md). **Contrato:** [Unified v2](../../docs/architecture/AGENT_PLATFORM_UNIFIED_V2.md).

## Base atual, fonte e regras de destilação

Do not break existing /api/*, /gatekeeper/* or asset routing; add opt-in exact /agent-api/v1/* and /agent-mcp/* to an independently deployed agent-tool-gateway binding, preserving request streaming and Workshop-origin CORS. Router handles forwarding only; gateway authenticates ticket and enforces grants.

**Fontes reais:** Existing packages/router routing source and AGENTS.md config/release conventions; frontend uses /api and /gatekeeper paths.

## Etapas de implementação e validação

- [ ] **01. Inspect existing router origin routing and dev/prod service bindings, prefix precedence, WebSocket forwarding and release-manifest generation.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **02. Define explicit reserved path prefixes and method/size constraints; add tests for collisions with /api and existing gatekeeper routes.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **03. Add feature-flagged AGENT_TOOL_GATEWAY Worker binding to cloudflare.config.ts, regenerate wrangler.jsonc and update release manifest/golden fixtures.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **04. Implement strict forward with deadlines, request ID/correlation and no rewrite of Authorization to broader identity.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **05. Test anonymous deny by gateway, user tenant isolation and MCP protocol transport/headers end-to-end through router.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **06. Run pnpm configs:check, build/tests, release manifest fixture and deploy a canary route with disabled-by-default rollout and rollback.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

## Arquivos propostos e relações

```text
packages/router/
  src/{routing,auth-proxy}.ts (review existing router file layout first)
  cloudflare.config.ts (binding update; generated wrangler.jsonc)
  src/__tests__/{agent-api-routing,mcp-routing,auth-header,legacy-prefix}.test.ts
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

Reference: [Existing module authority audit](../../docs/architecture/EXISTING_MODULE_BOUNDARIES_AUDIT.md), root SPECS §23. **Owner:** Existing router handles /api and /gatekeeper plus assets/email. New MCP/HTTP ingress requires opt-in explicit service binding and must not redirect through trusted ExternalMessageGateway/callerEmail; backend/API authentication remains authoritative.

**Gate before implementation:** Before code, define routes /agent-api/v1 and /agent-mcp scoped to new Gateway, review generated cloudflare.config.ts+manifest golden; test prefix conflicts and unauthorized public callers.

Any new agent-platform feature must preserve existing approved observations/actions, tenant scopes, Cap'n Web contract and consumer regressions. A documented proposed integration is not deployed functionality.
