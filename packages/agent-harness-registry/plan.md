# Agent Harness / Release Registry — plan.md

> **Estado:** PLANEJADO, não implementado por estes documentos. **Origem:** U-006/U-007 no [registro de inputs](../../docs/architecture/USER_INPUT_LEDGER.md). **Arquitetura:** [Unified v2](../../docs/architecture/AGENT_PLATFORM_UNIFIED_V2.md).

## Escopo e dependências

Registry supports native Workshop engine and external ACP or native protocol drivers. Manifests are immutable source-derived configurations, not permission grants. Deployment RELEASE manifest (repository-wide) is distinct from AGENT runtime release and must be mapped explicitly. A session's stable assignment survives fallback, rollback and reconnection.

**Fonte de destilação:** Hub harness catalog; Cloudflare OS existing build-release manifest and deploy wizard; Grokbot model aliases.

**Outras dependências:** `agent-protocol` ACC v1, existing Workshop/Overseer/Gatekeeper permissions, `agent-control-plane` Task/Agent definitions, `agent-loop` (when scheduled), runtime DO vs native Overseer and immutable release registry. Do not overwrite already-implemented systems.

## Plano de implementação em ordem de dependência

- [ ] **Etapa 01.** Inventory Hub catalogs/Grokbot model manifests and existing scripts/release manifests; document release namespace collision risks.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 02.** Define strict EngineManifest, protocol driver, mode/model, tool and resource profile schema; pin CLI/hash/fixture/version.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 03.** Implement live capability intersection: protocol handshake ∩ release/profile policy ∩ user grants; no UI feature based on manifest alone.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 04.** Create release registry and configured mapping runtimeTargetId -> service binding, validate deploy existence before ACTIVE.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 05.** Implement deterministic A/B eligible cohort selection and session assignment write-once in Directory; test sticky routing.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 06.** Support DRAINING/DISABLED rollback without changing active session target; track incompatible checkpoint migration distinctly.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 07.** Run fixture and simulated two-runtime integration tests, release-manifest golden tests and staging rollout.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

## Proposta de paths de código

```text
packages/agent-harness-registry/
  src/{engine-manifest,release,selector,capability-merge,verification}.ts
  src/__tests__/{manifest,compatibility,ab-pinning,rollback}.test.ts
  manifests/{grok,codex,opencode,workshop-native}.json
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


## Mandatory boundary revision (audit 2026-10-13)

See [Existing module authority audit](../../docs/architecture/EXISTING_MODULE_BOUNDARIES_AUDIT.md) and root SPECS §23. **No-overlap rule:** Defines engine capability fixtures, pinned binaries/images and immutable *agent runtime* release; does not own Workshop AI model preferences or the deployment artifact pipeline scripts/release/manifest-lib.ts. RuntimeTargetId MUST map to an actually deployed Worker binding.

**Required preparatory implementation gates:** Create explicit platformDeploymentReleaseId↔runtimeImage/agentRelease relationship; validate actual service bindings, sticky per-session assignment, rollback/drain, model config intersection with Workshop and live protocol handshake.

This is a reviewed design constraint. Neither this folder nor its plan constitutes a running module. Every completed plan step must link a source SHA, target commit, real contract/security tests and E2E proof where a Worker/Container is involved.
