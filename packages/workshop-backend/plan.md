# Workshop Backend Kernel / Native Agent Integration — plan.md

**Situação:** PLANEJADO; o package já existe e o plano NÃO significa substituir sua implementação atual. **User input:** [U-006](../../docs/architecture/USER_INPUT_LEDGER.md). **Contrato:** [Unified v2](../../docs/architecture/AGENT_PLATFORM_UNIFIED_V2.md).

## Base atual, fonte e regras de destilação

Remain owner of Workspace identity, per-chat history, action queue/observer verification, native pi-agent-core turn, edit/change barriers and compaction. A thin native bridge creates independent tasks only with authorized principal/grant and maps existing chat events; it must not copy the whole ChatHistory into a new task DO or turn on a second native agent scheduler.

**Fontes reais:** Existing src/agent.ts runAgentLoopContinue + step commit barrier, src/overseer.ts alarms/pendingAgentCalls/approval/replay, src/agent-compaction.ts, src/agent-spawner-binding import, scheduler callbacks.

## Etapas de implementação e validação

- [ ] **01. Characterize current runAgent/native tool and queued callable-agent behavior with focused tests and a full Chat/Gatekeeper RPC surface inventory.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **02. Design minimal typed kernel extension to link native chat turn to Agent Task without breaking existing Overseer/client methods.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **03. Resolve authentic Workshop principal/scope on inbound agent/task actions; add private capability binding to Agent Control Plane and no browser-supplied identity.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **04. Wrap native runAgent with a read-only-to-state ACC projector that preserves existing step commit barriers, reasoning privacy and compaction.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **05. Connect AgentSpawnerConfig/newAgentSpawnerGatekeeper to optional Task creation with snapshot of authorized env/callback stubs; maintain legacy spawner behavior.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **06. Integrate task pause/stop/revoke and budget into existing activeAgent/callback queue semantics without spawning duplicate native run loops.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **07. Add cross-DO outbox/reconciliation with Task DO to handle stale task state and unknown turn completion without mutating chat history outside Overseer.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

- [ ] **08. Run existing kernel unit/integration suites, restricted-mode, sharing, tool approvals, Git worktree, callback and restart regression; stage one native independent background task.**
  - Entrega: commit com caminhos afetados, schema ou fluxograma atualizado e teste comprovável.
  - Checagem: preservação da segurança de Gatekeeper, testes regressivos e documentação de impactos em ACC/API.

## Arquivos propostos e relações

```text
packages/workshop-backend/
  src/agent-platform/{native-turn-bridge,event-projection,control-plane-binding,task-admission}.ts
  src/__tests__/{native-event-parity,task-auth,spawner-compatibility}.test.ts
```

## Gates de aprovação, migração, aceite

- [ ] Comparar código atual na main com os contratos e criar testes de caracterização antes de mexer em fluxos ativos.
- [ ] Preservar compatibilidade com Workshop Cap'n Web, AgentSpawnerConfig, Scheduler approved hooks e mcp-shared trust; toda nova capability precisa de escopo e eventual revisão de API Gatekeeper.
- [ ] Revisar schema/versão, origem dos dados, IDs, evento/projection cursor, storage migrations e auditoria de observações/ações.
- [ ] Definir falhas/UNKNOWN outcomes, idempotência, replay, timeout, revogação, quotas, aprovação e isolamento de workspace.
- [ ] Validar pnpm configs:check / build / test / lint quando código for alterado; staging E2E para rotas, containers ou integração de serviços.
- [ ] Registrar evidência source→target→tests na [matriz](../../docs/architecture/ACP_MIGRATION_MATRIX.md) e no [user ledger](../../docs/architecture/USER_INPUT_LEDGER.md), distinguindo o que só foi planejado.

**DoD:** todas etapas relevantes com testes e evidência; nenhuma API pública/MCP nova sem autorização e revisão de contrato.
