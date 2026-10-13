# ACP Core — plan.md

> **Estado:** PLANEJADO, não implementado por estes documentos. **Origem:** U-006/U-007 no [registro de inputs](../../docs/architecture/USER_INPUT_LEDGER.md). **Arquitetura:** [Unified v2](../../docs/architecture/AGENT_PLATFORM_UNIFIED_V2.md).

## Escopo e dependências

ACP is only one driver transport. Keep JSON-RPC over supervisor-controlled stdio; normalize to AgentEventV1 using agent-protocol. Separate native message ID, ACP session ID, platform session ID and canonical run/child ID. Server-initiated session/request_permission is a blocking RPC answered only after the runtime's tool approval policy resolves.

**Fonte de destilação:** Hub src/runtime/acp/acp-client.manager.ts; Grokbot services/sandbox-runtime/tools/acp-smoke.mjs and Grok ACP manager.

**Outras dependências:** `agent-protocol` ACC v1, existing Workshop/Overseer/Gatekeeper permissions, `agent-control-plane` Task/Agent definitions, `agent-loop` (when scheduled), runtime DO vs native Overseer and immutable release registry. Do not overwrite already-implemented systems.

## Plano de implementação em ordem de dependência

- [ ] **Etapa 01.** Audit Grokbot smoke JSONRPC schema, Hub stdio manager and tested pinned CLI versions; save byte-for-byte fixtures with source commit.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 02.** Build strict incremental UTF8 NDJSON parser, bounded buffer/frame count, partial-chunk handling and stderr isolation.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 03.** Define JSON-RPC v2 request/response/notification variants, outstanding IDs, timeout, disconnect and cancellation with unknown side effect distinction.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 04.** Negotiate initialize per harness fixture, validate actual protocolVersion and capability intersection, refuse incompatible versions.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 05.** Implement session/new/load/prompt/update/cancel + permission callback dispatcher, with single response and generation guards.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 06.** Implement typed normalized event mapping to ACC, preserving raw namespaced extensions under bounded diagnostics.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

- [ ] **Etapa 07.** Run contract fuzz/negative fixtures, separate real smoke test per Grok/Codex/OpenCode version, and publish API compatibility tests.
  - **Artefato:** implementação com arquivo/commit identificado, exemplo de payload/schema e teste de regressão.
  - **Critério de aceite:** não alterar a autoridade do Workshop/Runtime sem migração explícita; revisar segurança e evidência antes da etapa seguinte.

## Proposta de paths de código

```text
packages/acp-core/
  src/{index,framing,jsonrpc,session,handshake,capabilities,errors}.ts
  src/__fixtures__/{grok,codex,opencode}/*.jsonl
  src/__tests__/{framing,negotiation,requests,server-permission,backpressure}.test.ts
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

See [Existing module authority audit](../../docs/architecture/EXISTING_MODULE_BOUNDARIES_AUDIT.md) and root SPECS §23. **No-overlap rule:** Owns ACP-specific JSON-RPC stdio framing/correlation only. It neither replaces Workshop Cap'n Web ABI nor implements a platform-wide wire protocol; source ACP session IDs must never become authorization or native chat IDs.

**Required preparatory implementation gates:** Compare Hub and Grokbot initialization fixtures with live pinned version; translate via agent-protocol into ACC; test server-initiated permission alongside Workshop action approval without double grant.

This is a reviewed design constraint. Neither this folder nor its plan constitutes a running module. Every completed plan step must link a source SHA, target commit, real contract/security tests and E2E proof where a Worker/Container is involved.
