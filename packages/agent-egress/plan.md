# Agent Egress — plan.md

> **Estado:** PLANEJADO, não implementado por estes documentos. **Origem:** U-006/U-007 no [registro de inputs](../../docs/architecture/USER_INPUT_LEDGER.md). **Arquitetura:** [Unified v2](../../docs/architecture/AGENT_PLATFORM_UNIFIED_V2.md).

## Escopo e dependências

The trust boundary is the Worker-held credential and allowlisted path/host: neither CLI nor harness adapter receives a long-lived provider secret. Provider/native authentication differs by engine; no blanket assumption that a generic proxy can impersonate native login. Egress policy applies to model inference and separate bootstrap dependency/Git hosts.

**Fonte de destilação:** Grokbot PR#1 services/sandbox-runtime/src/ai-gateway.ts and interceptOutboundHttps + enableInternet:false; existing Workshop AI Gateway billing flow.

**Outras dependências:** `agent-protocol` ACC v1, existing Workshop/Overseer/Gatekeeper permissions, `agent-control-plane` Task/Agent definitions, `agent-loop` (when scheduled), runtime DO vs native Overseer and immutable release registry. Do not overwrite already-implemented systems.

## Plano de implementação em ordem de dependência

- [ ] **Etapa 01.** Capture tested Grokbot HTTPS interception, CA bootstrapping and WorkerEntrypoint integration; pin source and validate Cloudflare API versions.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 02.** Define EgressGrant, allowed provider profiles, model alias translation, per-session generation and release identity binding.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 03.** Implement interception before container.start(enableInternet:false); ensure TLS verification intact and no proxy credential in container.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 04.** Implement strict origin/path/verb/model allowlists, redirect/manual, quota reservations, bounded streaming and opaque error codes.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 05.** Implement provider-specific Codex/OpenCode authentication strategies with revocable short-lived grants; do not enable if native login cannot be protected.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 06.** Separate package/Git bootstrap policy from inference egress, prevent DNS, IP, redirect and non-HTTPS bypasses.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 07.** Collect privacy-safe usage/cost counters and reconcile timeout UNKNOWN provider outcomes with conservative quota accounting.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 08.** Stage denied network, credential leak, quota exhaustion and success cases for all three pinned harness profiles.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

## Proposta de paths de código

```text
packages/agent-egress/
  src/{entrypoint,policy,model-map,quota,headers,stream,telemetry}.ts
  src/__tests__/{allowlist,interception,ca-trust,redirect,ssrf,quota,secrets}.test.ts
  profiles/{grok,codex,opencode}.json
  cloudflare.config.ts when private Worker deployed
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

Audit: [EXISTING_MODULE_BOUNDARIES_AUDIT.md](../../docs/architecture/EXISTING_MODULE_BOUNDARIES_AUDIT.md), governing root SPECS §23. **Owner constraint:** Owns only trusted *container* external network/credential boundary and quota validation. Workshop ai-models.ts/ai-gateway.ts already own native provider request configuration and billing flows. Avoid a second unverified AI model catalog and duplicate cost state.

**Before beginning tasks in this package:** Define shared model policy mapping and usage correlation with Workshop, pin provider-specific routes, reject raw CLI secret credentials; test actual Cloudflare CA/interceptOutboundHttps, disallowed hosts/redirects and quota/restart.

The directory is DOC_ONLY until package.json, actual source, schema tests and correct Worker configuration are added. No new runtime is implemented by the spec revision. Every relevant plan item requires source→target evidence, typed contract checks, approval/identity threat tests and real worker E2E when applicable.
