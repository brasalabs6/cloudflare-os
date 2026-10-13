# Agent Runtime / SessionRuntime Durable Object — plan.md

> **Estado:** PLANEJADO, não implementado por estes documentos. **Origem:** U-006/U-007 no [registro de inputs](../../docs/architecture/USER_INPUT_LEDGER.md). **Arquitetura:** [Unified v2](../../docs/architecture/AGENT_PLATFORM_UNIFIED_V2.md).

## Escopo e dependências

Execution authority for CLI subprocess sessions. Control Plane Task DO owns task policy and loops; Runtime DO owns session/run/operation states and container generation. Every cross-service dispatch persists intent and returns accepted receipt; true completion via journal. Native Workshop engine does not require container, so runtime must not become authority for existing Overseer chat.

**Fonte de destilação:** Grokbot PR#1 sandbox-runtime DO, session generation and terminal/files code; closed Cloudflare OS PR#2 low-level Container API fix; legacy Hub ACP transport.

**Outras dependências:** `agent-protocol` ACC v1, existing Workshop/Overseer/Gatekeeper permissions, `agent-control-plane` Task/Agent definitions, `agent-loop` (when scheduled), runtime DO vs native Overseer and immutable release registry. Do not overwrite already-implemented systems.

## Plano de implementação em ordem de dependência

- [ ] **Etapa 01.** Extract Grokbot generation fencing, PTY, intercept and event journal implementations with exact source SHA; review Cloudflare ctx.container.start/getTcpPort fix.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 02.** Create DO SQLite schema/migrations for Session, Run, Operation, Event, Approval, Checkpoint with indexes and CAS revisions.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 03.** Implement Worker private service binding and Session Directory sticky release routing; reject untrusted principal/workspace IDs.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 04.** Implement manifest-pinned container supervisor, ACP/native CLI driver hosting, heartbeat, lease, generation fencing, process/PTY limits.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 05.** Persist intent/outbox before dispatch; reconcile crash unknown outcomes without replaying unsafe commands or prompts.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 06.** Implement ACC projection of ACP/native tool, command, child, approval, usage events with stable source event mapping and bounded replay.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 07.** Implement scoped filesystem, Git, PTY tickets, terminal bytes and checkpoint R2 storage+verification, test symlink escape and restore.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 08.** Wire task lease/budget cancellation and egress quotas to Control Plane without double-authority of runs.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 09.** Run multi-session concurrency, crash/replay, corrupt checkpoint, 2-release sticky A/B rollout and 3 real harness E2E tests.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

## Proposta de paths de código

```text
packages/agent-runtime/
  src/{worker,session-runtime-do,directory,dispatch,outbox,journal,recovery,checkpoint}.ts
  src/supervisor/{server,protocol-driver,process,pty,filesystem,git}.ts
  src/storage/{schema,migrations}.ts
  src/__tests__/{state,replay,stale-generation,crash,checkpoint,terminal}.test.ts
  cloudflare.config.ts (generated wrangler.jsonc)
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

Audit: [EXISTING_MODULE_BOUNDARIES_AUDIT.md](../../docs/architecture/EXISTING_MODULE_BOUNDARIES_AUDIT.md), governing root SPECS §23. **Owner constraint:** The runtime is the exclusive owner of CLI SessionRuntime/Run/Operation/Container generation and checkpoint. It is NOT an alternate executor for the existing Workshop pi-agent-core native chat, not Task DO, not scheduler and not Gatekeeper grant/approval state.

**Before beginning tasks in this package:** Prove Task DO↔Runtime DO cross-DO operation/outbox and UNKNOWN outcomes; use release-assigned binding, safe PTY/rooted filesystem, no uncontrolled public endpoint. Compare Grokbot generation and cloudflare-os PR#2 low-level Container API evidence.

The directory is DOC_ONLY until package.json, actual source, schema tests and correct Worker configuration are added. No new runtime is implemented by the spec revision. Every relevant plan item requires source→target evidence, typed contract checks, approval/identity threat tests and real worker E2E when applicable.
