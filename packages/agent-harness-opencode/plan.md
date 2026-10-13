# OpenCode Harness Adapter — plan.md

> **Estado:** PLANEJADO, não implementado por estes documentos. **Origem:** U-006/U-007 no [registro de inputs](../../docs/architecture/USER_INPUT_LEDGER.md). **Arquitetura:** [Unified v2](../../docs/architecture/AGENT_PLATFORM_UNIFIED_V2.md).

## Escopo e dependências

Use native supported opencode acp interface, version-locked. Map mode/model selection, command/timeline, tool approvals and potential child session events to ACC only after verifying native metadata. Workspace config, HOME and cache are per-session; do not silently treat session/new as restored session/load.

**Fonte de destilação:** OpenCode CLI ACP behavior to verify from pinned executable; Hub ACP client as transport reference and Grokbot isolation model as sandbox reference.

**Outras dependências:** `agent-protocol` ACC v1, existing Workshop/Overseer/Gatekeeper permissions, `agent-control-plane` Task/Agent definitions, `agent-loop` (when scheduled), runtime DO vs native Overseer and immutable release registry. Do not overwrite already-implemented systems.

## Plano de implementação em ordem de dependência

- [ ] **Etapa 01.** Pin OpenCode CLI image and SHA; capture real ACP negotiation, session and tool fixtures including capability deltas.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 02.** Implement config validation, isolated HOME/cache/workspace and restricted provider egress with immutable launch command.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 03.** Wire opencode acp through ACP Core; verify initialize/new/prompt, cancel, explicit session/load when negotiated.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 04.** Implement normalized ACC text/tool/command/model/mode events and declared namespaced extensions.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 05.** Test permission request/response handling and distinguish native subagent vs platform-created child tasks.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 06.** Implement failure, restart/restore provenance, unknown outcome and typed unsupported feature paths.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 07.** Stage actual OpenCode prompt/tool filesystem operation with replay, authorization, approval, cancel, budget tests and migration evidence.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

## Proposta de paths de código

```text
packages/agent-harness-opencode/
  src/{index,manifest,driver,config,event-translator,permissions}.ts
  src/__fixtures__/{initialize,prompt,mode,tools,permission,subagents}.jsonl
  src/__tests__/{profile,events,cancel,capabilities,replay}.test.ts
```

## Gates obrigatórios

- [ ] Capturar commit SHA, linhas/caminhos e fixtures do Grokbot/Hub/Workshop preexistentes e inventariar todas features relacionadas.
- [ ] Definir validators/JSON Schema + erro + migração para cada mudança de dados; não promover um draft Typescript como schema validado.
- [ ] Testar identidades, observer checks, autorização de observações, actions submit/apply, ACP permission e grant de Computer separadamente.
- [ ] Testar concurrency, idempotency, generation fences, reconnect, crash-after-dispatch, UNKNOWN outcomes e cancel sem reexecutar side effects.
- [ ] Validar quotas, recursos, egress, segredos, release A/B pinning e rollback onde aplicável.
- [ ] Rodar lint/build/configs-check/test e E2E real na infraestrutura Cloudflare para funções que dependem de Worker/Container.
- [ ] Atualizar [matriz de migração](../../docs/architecture/ACP_MIGRATION_MATRIX.md) com source→target→teste→URL staging; só marcar MIGRATED após validação.

## Critério final

Compatibilidade com motor nativo Workshop e Gatekeepers existentes; detalhes específicos de ACP/native expostos por extensões tipadas sem quebrar um front-end único. **Sem comprovação de deploy ainda.**


## Mandatory existing-module boundary / implementation gate (2026-10-13)

Audit: [EXISTING_MODULE_BOUNDARIES_AUDIT.md](../../docs/architecture/EXISTING_MODULE_BOUNDARIES_AUDIT.md), governing root SPECS §23. **Owner constraint:** Only OpenCode CLI protocol/config and event mapping. Root-scoped filesystem, command authorization, PTY, environment secrets, session/run storage are Runtime/Computer/Egress responsibilities; native subagent information is not automatically a controllable platform child.

**Before beginning tasks in this package:** Capture pinned OpenCode ACP negotiation fixtures and verify tool permission/cancel/resume, model/mode and subagent events against ACC; test isolated HOME/config and provider egress.

The directory is DOC_ONLY until package.json, actual source, schema tests and correct Worker configuration are added. No new runtime is implemented by the spec revision. Every relevant plan item requires source→target evidence, typed contract checks, approval/identity threat tests and real worker E2E when applicable.
