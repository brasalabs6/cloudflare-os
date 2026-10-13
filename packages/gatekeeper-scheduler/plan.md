# Existing Scheduled Tasks Gatekeeper — autonomous agent trigger integration — plan.md

**Situação:** PLANEJADO; o package já existe e o plano NÃO significa substituir sua implementação atual. **User input:** [U-006](../../docs/architecture/USER_INPUT_LEDGER.md). **Contrato:** [Unified v2](../../docs/architecture/AGENT_PLATFORM_UNIFIED_V2.md).

## Base atual, fonte e regras de destilação

Use existing ScheduleDriver for calendar/elapsed-time triggers, with explicit hook approvals and per-occurrence stable runId. An enabled hook may create a new Task via Control Plane with scheduleId:runId idempotency; never activate a hidden cron row or duplicate scheduler. Owner disabled/revoked hook prevents new Task admission. Agent Loop handles intra-task steps and sleeping separately.

**Fontes reais:** Existing ScheduleSession.every/calendarAt/runAt, hook bindHook->enable, ScheduleDriver single alarm and retry policy, README and SPECS.

## Etapas de implementação e validação

- [ ] **01. Read Scheduler SPECS/README source, note 60s minimum, timezones, DST, count semantics, retry/dead and hook approval in characterization fixtures.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **02. Define AgentScheduleLink binding to approved hook, no new timer storage authority; confirm account/workspace scope and trigger grant.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **03. Implement optional approved callback/task bridge with idempotency key derived from scheduleId:runId, not random retry ID.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **04. Preserve bindHook->controller.enable flow, and disable/revoke cancels future task admission while not magically undoing running tasks.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **05. Connect Task service receipts and unknown dispatch to callback retry without duplicate task on redelivery.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **06. Expose schedule/status read projection to unified Agent UI via authorized Workshop RPC; no management UI approval bypass.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **07. Test DST, missed intervals, duplicate/retried occurrence, disabled trigger, revoked account and cross-workspace target, then real worker E2E.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

## Arquivos propostos e relações

```text
packages/gatekeeper-scheduler/
  src/agent-trigger-adapter.ts (thin integration, only if necessary)
  src/__tests__/{agent-hook-admission,task-dedup,disabled-trigger}.test.ts
  src/{schedule-driver,controller}.ts (reuse; no replacement)
```

## Gates de aprovação, migração, aceite

- [ ] Comparar código atual na main com os contratos e criar testes de caracterização antes de mexer em fluxos ativos.
- [ ] Preservar compatibilidade com Workshop Cap'n Web, AgentSpawnerConfig, Scheduler approved hooks e mcp-shared trust; toda nova capability precisa de escopo e eventual revisão de API Gatekeeper.
- [ ] Revisar schema/versão, origem dos dados, IDs, evento/projection cursor, storage migrations e auditoria de observações/ações.
- [ ] Definir falhas/UNKNOWN outcomes, idempotência, replay, timeout, revogação, quotas, aprovação e isolamento de workspace.
- [ ] Validar pnpm configs:check / build / test / lint quando código for alterado; staging E2E para rotas, containers ou integração de serviços.
- [ ] Registrar evidência source→target→tests na [matriz](../../docs/architecture/ACP_MIGRATION_MATRIX.md) e no [user ledger](../../docs/architecture/USER_INPUT_LEDGER.md), distinguindo o que só foi planejado.

**DoD:** todas etapas relevantes com testes e evidência; nenhuma API pública/MCP nova sem autorização e revisão de contrato.


## Integration corrective decision — source audit 2026-10-13

Reference: [Existing module boundary audit](../../docs/architecture/EXISTING_MODULE_BOUNDARIES_AUDIT.md); root SPECS §23 takes precedence. **Confirmed current authority:** ScheduleDriver owns all elapsed/calendar/once recurrence, HookController approval, account-wide alarm, stable runId, retries/DST. Agent Task DO is NOT a scheduler; only accepts deduped runId-triggered jobs and independently controls continuation of already accepted Task.

**Required next implementation checkpoint:** Prototype approved persistent callback linkage without rewriting ScheduleDriver; registration itself is NOT idempotent; task admission must be scheduleId:runId idempotent. Test duplicate delivery, disabled hook, revoke, timezone DST and interaction with task cancellation.

Do not change the existing implementation solely because a draft package exists. Preserve current tests, RPC and storage compatibility; any new state machine needs explicit idempotency, observer/action semantics, crash recovery and rollback acceptance. New agent-platform modules are not deployed.
