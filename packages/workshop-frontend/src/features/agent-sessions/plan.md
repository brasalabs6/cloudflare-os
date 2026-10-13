# Workshop Unified Agent UI — plan.md

> **Estado:** PLANEJADO, não implementado por estes documentos. **Origem:** U-006/U-007 no [registro de inputs](../../../../../docs/architecture/USER_INPUT_LEDGER.md). **Arquitetura:** [Unified v2](../../../../../docs/architecture/AGENT_PLATFORM_UNIFIED_V2.md).

## Escopo e dependências

One front-end for native Workshop, ACP Grok/Codex/OpenCode and future native protocols; engine feature differences expressed by capability flags and safe protocol.extensions inspector, not branching entire app by provider. Agent list and editor, scheduled/background Tasks, per-run timelines, real subagent graph, command/tool events, approval queue, files/terminal/Git, usage, budget and ops/recovery. Keep existing chat UI behavior and current workpieces.

**Fonte de destilação:** Grokbot components dashboard, session-detail, acp-chat, agent-terminal, file-browser and F-001..F-017; existing Workshop frontend chat/approval and Kumo shared UI.

**Outras dependências:** `agent-protocol` ACC v1, existing Workshop/Overseer/Gatekeeper permissions, `agent-control-plane` Task/Agent definitions, `agent-loop` (when scheduled), runtime DO vs native Overseer and immutable release registry. Do not overwrite already-implemented systems.

## Plano de implementação em ordem de dependência

- [ ] **Etapa 01.** Audit current Workshop React/Kumo components and Grokbot F-001..F-017 screenshots/source; define UI parity checklist and reusable shared components.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 02.** Design AgentDefinition management, Task list/detail, Triggers/LoopPolicy editor, subagent tree and release/engine selector interactions.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 03.** Implement ACC event reducers with per-stream replay cursor/gap/dedup and source provenance badges; merge live native chat safely.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 04.** Add timeline panels for tool, command, child, usage/cost, filesystem, git and protocol-specific declared extensions, with untrusted content escapes.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 05.** Wire task control create/pause/resume/cancel/stop, schedule binding and approval decisions using existing Workshop authenticated Cap'n Web API.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 06.** Build terminal ticket and file browsing behind separate Computer grants, strict focus/accessibility and restricted-mode rules.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 07.** Implement failure/OUTCOME_UNKNOWN, cursor expiry, state reconciliation, server restart, budget and rate-limit UX.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 08.** Run Kumo/browser/a11y tests and cross-engine staging E2E; attach each Grokbot feature row evidence.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

## Proposta de paths de código

```text
packages/workshop-frontend/src/features/agent-sessions/
  src/features/agent-sessions/{AgentDashboard,AgentEditor,TaskDetail,TaskTimeline,ChildTree,LoopControls,ToolApprovals,EngineInspector,TerminalPanel,FileExplorer}.tsx
  src/features/agent-sessions/{useAgentEvents,useTaskActions,agentEventReducer}.ts
  src/features/agent-sessions/*.test.tsx
```

## Gates obrigatórios

- [ ] Capturar commit SHA, linhas/caminhos e fixtures do Grokbot/Hub/Workshop preexistentes e inventariar todas features relacionadas.
- [ ] Definir validators/JSON Schema + erro + migração para cada mudança de dados; não promover um draft Typescript como schema validado.
- [ ] Testar identidades, observer checks, autorização de observações, actions submit/apply, ACP permission e grant de Computer separadamente.
- [ ] Testar concurrency, idempotency, generation fences, reconnect, crash-after-dispatch, UNKNOWN outcomes e cancel sem reexecutar side effects.
- [ ] Validar quotas, recursos, egress, segredos, release A/B pinning e rollback onde aplicável.
- [ ] Rodar lint/build/configs-check/test e E2E real na infraestrutura Cloudflare para funções que dependem de Worker/Container.
- [ ] Atualizar [matriz de migração](../../../../../docs/architecture/ACP_MIGRATION_MATRIX.md) com source→target→teste→URL staging; só marcar MIGRATED após validação.

## Critério final

Compatibilidade com motor nativo Workshop e Gatekeepers existentes; detalhes específicos de ACP/native expostos por extensões tipadas sem quebrar um front-end único. **Sem comprovação de deploy ainda.**


## Cross-module agent-platform boundary audit (2026-10-13)

This package is a preexisting authority/consumer of agent-platform behavior. Refer to the [source-grounded no-overlap audit](../../../../../docs/architecture/EXISTING_MODULE_BOUNDARIES_AUDIT.md) and root SPECS §23 before accepting any overlapping implementation. **Specific requirement:** Before coding Agent dashboard, characterize existing ChatInterface, useActions/useAutoApproval, current ActivityNotifications, Kumo/@gadgets/ui and current route tree. Wire tasks and native chat correlation without rewriting native UI or exposing private reasoning. Add real browser E2E for rejected tool approval, subagent display, budget/pause and page reload.

Any downstream addition needs existing consumer regression tests plus scoped-auth/idempotency/race tests; a documentation reference is not proof of runtime implementation.
