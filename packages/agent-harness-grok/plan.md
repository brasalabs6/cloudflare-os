# Grok Build Harness Adapter — plan.md

> **Estado:** PLANEJADO, não implementado por estes documentos. **Origem:** U-006/U-007 no [registro de inputs](../../docs/architecture/USER_INPUT_LEDGER.md). **Arquitetura:** [Unified v2](../../docs/architecture/AGENT_PLATFORM_UNIFIED_V2.md).

## Escopo e dependências

Distill Grokbot tested Grok CLI behavior only. Default driver ACP; native Grok protocol path may be added as a second protocol driver when verified. Native subagent metadata must map into canonical parent/child graph with unsupported-control semantics where appropriate. Preserve generation fencing and trusted outbound interception; do not reuse Grokbot auth/Postgres or broad always-approve smoke flags.

**Fonte de destilação:** Grokbot PR#1 services/sandbox-runtime/src/index.ts, ai-gateway.ts, tools/acp-smoke.mjs, tools/run-grok.sh, Dockerfile, Grokbot feature spec F-005..F-013; cloudflare-os PR#2 closed reference.

**Outras dependências:** `agent-protocol` ACC v1, existing Workshop/Overseer/Gatekeeper permissions, `agent-control-plane` Task/Agent definitions, `agent-loop` (when scheduled), runtime DO vs native Overseer and immutable release registry. Do not overwrite already-implemented systems.

## Plano de implementação em ordem de dependência

- [ ] **Etapa 01.** Pin Grokbot PR head source SHA, versioned Grok CLI binary/Container image, smoke fixtures and staging evidence URLs in extraction matrix.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 02.** Port strictly allowlisted CLI command, TOML config schema and per-session filesystem/home profile without secrets.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 03.** Implement initialize ACP and negotiation with Grok-specific protocolVersion; prove session/new/prompt/update/cancel and tool permission callback.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 04.** Translate Grok text/tool/command/plan/terminal/subagent events to ACC; retain namespaced extensions for native-only details.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 05.** Integrate Grokbot HTTPS interception + CA trust, model allowlist and proxied secret policy through agent-egress.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 06.** Port signed generation-scoped supervisor grants, PTY/file handoff and typed bridge errors without porting public legacy bridges.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 07.** Run real Cloudflare staging E2E file edit + permission + cancel + crash/replay + checkpoint file restore; link F-005..F-013 evidence.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

## Proposta de paths de código

```text
packages/agent-harness-grok/
  src/{index,manifest,launch,config,driver,acp-translator,tool-permissions}.ts
  src/__fixtures__/{initialize,new,prompt,permission,tools,errors}.jsonl
  src/__tests__/{config,launch,acl,events,restoration}.test.ts
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

See [Existing module authority audit](../../docs/architecture/EXISTING_MODULE_BOUNDARIES_AUDIT.md) and root SPECS §23. **No-overlap rule:** Only Grok CLI-specific protocol/config/translation (Grokbot extraction). CLI Linux supervisor, terminal, filesystem, egress and policy are owned by agent-runtime, gatekeeper-computers and agent-egress respectively. Do not port Grokbot Next.js/Postgres identity.

**Required preparatory implementation gates:** Trace Grokbot PR #1 pinned SHA and ACP smoke fixture; port CLI-specific commands and event maps, test deny tool permissions and provider intercepted HTTPS with runtime adapter; no --always-approve production flag.

This is a reviewed design constraint. Neither this folder nor its plan constitutes a running module. Every completed plan step must link a source SHA, target commit, real contract/security tests and E2E proof where a Worker/Container is involved.
