# Code Audit — cloudflare-os — 2026-08-06

## Resumo Executivo

- **Alvo**: suporte ao Grok Build em Cloudflare Computer, incluindo `grok-computer-bridge`, roteamento do Overseer, API compartilhada e UI.
- **Escopo**: todos os arquivos modificados e não rastreados do fluxo, contratos de RPC, configuração Wrangler/Docker, autenticação, isolamento por workspace, lifecycle, streaming e validação local.
- **Evidence level**: alto para código/configuração local; médio para a integração Cloudflare Computer, validada contra documentação oficial atual.
- **Top risks**: bridge publicamente executável sem autenticação efetiva; todos os workspaces usam o mesmo agente/container; o prompt é sempre extraído do campo errado e fica vazio; o deployment do bridge é inválido.
- **Release-blocking?**: sim.

## Mapa Arquitetural Relevante

`ChatInterface` seleciona um modelo `grok-computer`, o `OverseerDurableObject` desvia antes do loop normal e envia `/boot` e `/prompt` para o service binding `GROK_COMPUTER_BRIDGE`. O bridge escolhe um DO pelo nome `agent`, inicia um processo persistente `grok agent stdio`, e repassa eventos ACP por SSE. A configuração e o status ficam no Overseer DO.

## Achados Critical / High

### [Critical][Confirmed] O bridge expõe execução arbitrária de comandos sem autenticação

- **Type**: security
- **Component**: `packages/grok-computer-bridge/src/worker.ts`, `src/bridge.mjs`
- **Evidence**: o handler HTTP do Worker roteia diretamente `/command`, `/boot`, `/prompt` e reset/pause/resume para o DO sem validar Authorization (`worker.ts:271-339`). A autenticação só existe dentro do container (`bridge.mjs:267-274`, `403-438`), mas o Worker não valida o request de entrada. A chave configurada no Wrangler é `GROK_BRIDGE_API_KEY`, enquanto o processo Node lê `BRIDGE_API_KEY` (`wrangler.jsonc:42-45`, `bridge.mjs:40-41`), portanto o controle também está desalinhado.
- **Failure Scenario**: qualquer pessoa que alcance a URL pública do Worker chama `POST /command` com shell arbitrário, lê/escreve o workspace, executa `POST /boot` ou dispara prompts que consomem a chave da xAI.
- **Impact**: RCE no container, exfiltração de repositórios/credenciais, gasto de API e negação de serviço.
- **Validation**: enviar um request sem Authorization ao Worker público; o Worker não retorna 401 antes de chamar o stub. Não executar contra produção.
- **Fix Direction**: autenticar no primeiro Worker boundary com uma secret coerente, rejeitar ausência/mismatch em todos os endpoints, e preferir service binding privado sem superfície HTTP pública. `/command` deve ser removido ou separado atrás de autorização explícita e auditada.
- **Handoff**: @build + security review.

### [Critical][Confirmed] Todos os workspaces compartilham o mesmo agente/container

- **Type**: security | data-consistency
- **Component**: seleção do DO no bridge e chamadas do Workshop
- **Evidence**: o Worker usa `url.searchParams.get("agent") ?? request.headers.get("X-Grok-Agent") ?? "default"` (`worker.ts:275-281`). O backend nunca envia `agent` nem `X-Grok-Agent` (`overseer.ts:3925-3944`, `3970-3982`, e os métodos de controle `8921-8975`).
- **Failure Scenario**: dois workspaces usam o modelo; ambos chegam ao DO nomeado `default`, com o mesmo `/workspace`, sessão ACP e listeners. Um prompt pode continuar o contexto ou alterar arquivos do outro workspace.
- **Impact**: vazamento cross-tenant, execução no código errado e corrupção de estado.
- **Validation**: usar dois nomes de workspace e observar que ambos geram o mesmo `agentName` default. Não executar com dados reais.
- **Fix Direction**: derivar um identificador estável e não controlável pelo cliente a partir do workspace/tenant, encaminhá-lo explicitamente ao binding e aplicar o mesmo isolamento no bridge DO. Nunca usar um singleton global para dados de usuário.
- **Handoff**: @build + security review.

### [High][Confirmed] O deployment do bridge é rejeitado pelo Wrangler

- **Type**: operational-risk | contract-drift
- **Component**: `packages/grok-computer-bridge/wrangler.jsonc`
- **Evidence**: `pnpm exec wrangler deploy --dry-run --config packages/grok-computer-bridge/wrangler.jsonc` falhou com `"containers.class_name" is a required field`. O bloco `containers` em `wrangler.jsonc:10-15` tem `name` e `image`, mas não `class_name`.
- **Failure Scenario**: o bridge não pode ser publicado; nenhuma integração end-to-end chega a iniciar.
- **Impact**: release bloqueado.
- **Validation**: comando acima, read-only.
- **Fix Direction**: alinhar o binding de container com a classe Durable Object real e com uma implementação suportada pelo pacote oficial. A documentação de Containers exige `class_name` e o Worker deve encaminhar requests via `getContainer(...).fetch()`/`containerFetch()`, não por hostname fictício.
- **Handoff**: @build.

### [High][Confirmed] O prompt enviado ao Grok é sempre vazio

- **Type**: bug
- **Component**: `OverseerImpl.#runComputerAgentTurn`
- **Evidence**: `AiChatMessageBody` define o campo `message` (`packages/workshop-shared/src/api.ts:1932-1935`), e o próprio armazenamento usa `message` (`overseer.ts:5518-5525`). Porém o novo fluxo lê `(lastUserMessage as any).text` (`overseer.ts:4118-4125`).
- **Failure Scenario**: uma mensagem válida é persistida, mas `prompt` vira `""`; o método registra `no user message found` e retorna sem chamar `/prompt`.
- **Impact**: nenhuma tarefa do usuário é executada; o run pode permanecer reportado como `running`.
- **Validation**: teste unitário com uma mensagem `{ type: "message", message: "..." }` reproduz `prompt === ""`.
- **Fix Direction**: usar o tipo real sem `as any`, adicionar teste regressivo do caminho completo e definir estado terminal quando não houver prompt.
- **Handoff**: @build.

### [High][Confirmed] O fluxo Computer ignora limites/contabilidade do loop normal

- **Type**: security | operational-risk
- **Component**: desvio em `#runAgentTurnWithContext`
- **Evidence**: o branch `provider === "grok-computer"` retorna imediatamente (`overseer.ts:4260-4269`), antes da verificação de uso/balanceamento que começa em `overseer.ts:4295-4315`. O bridge usa uma chave xAI global e o fluxo não associa custo nem aplica o limite de uso.
- **Failure Scenario**: um usuário com acesso de build usa o modelo repetidamente sem passar pelo gate de uso que protege os demais providers.
- **Impact**: gasto não autorizado, bypass de quota e risco operacional/financeiro.
- **Fix Direction**: definir explicitamente o owner de billing para Grok, aplicar a mesma autorização/quota antes do branch e registrar consumo/custo; se a política for admin-only, enforce no servidor.
- **Handoff**: user-only/product decision + @build.

### [High][Confirmed] O backend não alcança o container pela API documentada

- **Type**: integration mismatch
- **Component**: `grok-computer-bridge/src/worker.ts`
- **Evidence**: `ensureStarted()` força um `runtime.exec` e retorna `http://container:8787` como hipótese (`worker.ts:67-86`). Os métodos fazem `fetch()` nesse hostname (`worker.ts:102-111`, `135-144`), sem `Container.defaultPort`, `getContainer`, `containerFetch` ou mecanismo equivalente. A documentação oficial de Containers indica `Container`/`getContainer` e `containerFetch` para rotear ao processo (`[Container Interface](https://developers.cloudflare.com/containers/container-class/)`, linhas sobre `defaultPort`, `fetch` e `containerFetch`).
- **Failure Scenario**: mesmo corrigindo o Wrangler, o Worker recebe DNS/connection failure para `container:8787` ou não inicia/espera o processo corretamente.
- **Impact**: integração não funcional em runtime.
- **Fix Direction**: implementar sobre a API suportada e configurar a porta 8787 como `defaultPort`/`requiredPorts`/health check; remover o hostname assumido e validar cold start.
- **Handoff**: @build.

### [High][Confirmed] O processo Grok não recebe `XAI_API_KEY`

- **Type**: integration mismatch
- **Component**: Docker/runtime do bridge
- **Evidence**: `XAI_API_KEY` é apenas declarado em `src/env.d.ts` e comentado como secret no README; o Dockerfile não injeta a secret (`Dockerfile:72-78`), e a classe Worker não define `envVars` nem passa a chave ao container (`worker.ts:40-58`). O bridge só herda o ambiente do container (`bridge.mjs:60-69`). A documentação ACP do xAI explicita que o processo precisa estar autenticado localmente ou ter `XAI_API_KEY` configurada ([Headless & Scripting](https://docs.x.ai/build/cli/headless-scripting)).
- **Failure Scenario**: `grok agent stdio` inicia sem autenticação e as chamadas ACP falham ou entram em retry indefinido.
- **Impact**: o agente não funciona após deploy; tentativa de resolver com credencial enviada pelo usuário aumentaria o risco de vazamento.
- **Fix Direction**: definir a origem/ownership da credencial e injetá-la no container via secret/runtime env suportado, sem persistir ou devolver o valor pela API.
- **Handoff**: @build + user-only para escolha de billing/secret ownership.

## Achados Medium

### [Medium][Confirmed] `autoApprove` da UI não tem efeito

- **Type**: contract-drift
- **Component**: boot/prompt bridge
- **Evidence**: o backend envia `autoApprove` no boot, mas o bridge o ignora (`bridge.mjs:330`, lint acusa variável não usada), e `/prompt` sempre recebe/usa `alwaysApprove: true` (`overseer.ts:3980`, `bridge.mjs:330-335`).
- **Failure Scenario**: o usuário desabilita auto-approve, mas ferramentas continuam sendo executadas automaticamente.
- **Impact**: comportamento de segurança enganoso e possível execução não autorizada.
- **Fix Direction**: transportar a política até o runtime ACP ou remover o controle da UI até haver enforcement real.

### [Medium][Confirmed] Pause/stop não atualizam nem cancelam o run persistido

- **Type**: bug | state-consistency
- **Component**: `pauseComputerRun`, `resumeComputerRun`, `stopComputerRun`
- **Evidence**: os métodos só fazem HTTP (`overseer.ts:8921-8951`); não alteram `ComputerRunStatus`, não abortam `liveChat.cancelController` e stop apenas reseta a sessão. O loop só observa abort depois que `/prompt` termina (`overseer.ts:4182-4189`).
- **Failure Scenario**: a UI mostra `running` após Pause; Stop reseta a sessão, mas a execução atual continua e pode avançar/emitir eventos.
- **Impact**: controles não confiáveis, estado divergente e risco de comandos posteriores no container.
- **Fix Direction**: manter um handle/cancelamento por run, persistir transições atômicas e definir semântica clara para pause vs. cancel.

### [Medium][Confirmed] Eventos de tool não podem ser correlacionados

- **Type**: integration mismatch
- **Component**: ACP → SSE → `AiChatStreamEvent`
- **Evidence**: o bridge emite `toolCall` com `{tool,args,status}` e `toolResult` com `{tool,result,status}` (`bridge.mjs:212-234`), sem ID. O backend tenta ler `event.data.id` e usa `""` no resultado (`overseer.ts:4045-4058`).
- **Failure Scenario**: o frontend recebe uma chamada e seu resultado com IDs diferentes/vazios; tool output não aparece no card correto.
- **Impact**: UI de streaming inconsistente e perda de observabilidade.
- **Fix Direction**: preservar `toolCallId` do ACP e manter um mapa de tool call por sessão; adicionar teste de transformação com evento real.

### [Medium][Confirmed] Boot reinicia a sessão em cada novo turno e não é idempotente

- **Type**: state-consistency | performance-risk
- **Component**: `#ensureComputerBooted` / `/boot`
- **Evidence**: o Overseer chama `/boot` sempre ao iniciar um turno (`overseer.ts:4108-4110`); `/boot` mata `grokProc`, zera `sessionId` e inicia outro (`bridge.mjs:565-576`). Clones e credenciais são reaplicados a cada boot (`bridge.mjs:505-555`).
- **Failure Scenario**: contexto ACP é perdido entre mensagens; reboots repetem operações, acumulam credenciais em `.gitconfig` e podem falhar em diretórios já existentes.
- **Impact**: perda de contexto, lentidão e estado do workspace imprevisível.
- **Fix Direction**: separar ensure/start de apply-config, guardar uma versão/hash da configuração, tornar boot idempotente e só reiniciar quando a configuração mudar.

### [Medium][Confirmed] Configuração e credenciais são aceitas sem validação de limites/path/shell

- **Type**: security | input-validation
- **Component**: `ComputerBootConfig` e `/boot`
- **Evidence**: não há validação server-side de tamanho, nomes de env, paths ou URLs; dotfiles usam `path.join(homeDir, dotfile.path)` (`bridge.mjs:506-510`), clone monta comando shell por interpolação (`522-534`), e bootScript é executado via `exec` (`558-562`).
- **Failure Scenario**: `..` escapa do diretório esperado; URL/branch/path injeta shell; payloads grandes causam consumo de memória/tempo.
- **Impact**: sobrescrita de arquivos, RCE e indisponibilidade. A falta de autenticação torna o cenário imediatamente explorável.
- **Fix Direction**: autenticar primeiro; validar esquema/allowlist de URL, resolver e confinar paths, usar `spawnFile`/argumentos sem shell, limites de tamanho/quantidade/timeouts e tratamento de erro.

## Achados Low / Info

### [Low][Confirmed] Os checks do repositório não cobrem o pacote novo

- **Type**: test-gap | operational-risk
- **Component**: `packages/grok-computer-bridge/package.json`
- **Evidence**: o pacote não declara `build`, `types:check`, `lint` ou `test`; `pnpm types:check` reportou `Scope: 27 of 28 workspace projects`, omitindo o bridge. `pnpm lint:check` só descobriu o bridge porque o oxlint varre o repositório.
- **Impact**: erros de import/configuração ficam fora do CI padrão.
- **Fix Direction**: adicionar dependências reais, tsconfig/build/typecheck/test e incluir o pacote na validação/deploy.

### [Low][Confirmed] O lint falha em código novo

- **Type**: maintainability-risk
- **Component**: bridge e Overseer
- **Evidence**: `pnpm lint:check` falha por `no-unused-private-class-members` (`#getComputerRunStatus`), `no-array-reverse`, imports/variáveis não usados em `bridge.mjs`, `WorkerEntrypoint` não usado e outros erros no bridge/worker.
- **Impact**: o gate de qualidade não passa.
- **Fix Direction**: corrigir os erros antes do merge; não silenciar regras.

## Gaps de Teste

- Nenhum teste cobre boot, isolamento por workspace, autenticação, service binding, cold start, lifecycle pause/stop, parsing SSE, ACP tool IDs ou persistência de resposta.
- Falta um teste de contrato usando uma mensagem real do `AiChatMessageBody`; ele teria detectado imediatamente o uso incorreto de `.text`.
- Falta teste negativo do bridge para cada endpoint sem bearer token e teste de que um identificador de workspace nunca compartilha o DO de outro workspace.
- Falta teste de build/deploy que rode Wrangler com o `wrangler.jsonc` do bridge.

## Gaps de Spec / Contrato

- O plano descreve `Computer`/`withWorkspace` e um backend customizado, mas a configuração e o código não demonstram um contrato publicável para essa API; a documentação oficial consultada usa `@cloudflare/containers`, `Container`, `getContainer` e `containerFetch`.
- A documentação interna promete credenciais “encrypted” e `autoApprove`, mas o código persiste/devolve valores e não aplica a opção.
- O plano promete resumption após restart, mas o estado persistido não contém uma forma de reanexar/cancelar o processo ACP nem um mecanismo de retomada confiável.

## Riscos Arquiteturais e Operacionais

- A classe bridge mantém processo, sessão, pending requests e listeners em variáveis de módulo dentro de um DO; isso exige serialização explícita de prompts e cleanup em disconnect/abort.
- `eventListeners` é global e faz broadcast para todos os streams, o que é incompatível com múltiplos prompts concorrentes mesmo dentro do mesmo processo.
- O Dockerfile instala CLI por script remoto não pinado (`curl | bash`) e não fixa versão/digest do Grok; o binário pode mudar entre builds.
- `/health` e `/status` não chamam `authenticate`, expondo metadados do processo/sessão.

## Segurança

Há findings críticos de autenticação, RCE e isolamento cross-tenant. Não considerar este bridge seguro para deploy até corrigir a superfície HTTP, a seleção do DO, a injeção de secrets e a validação de boot.

## Validação Executada

- `pnpm lint:check` — falhou com erros novos no Overseer, bridge e worker.
- `pnpm types:check` — passou para os 27 projetos incluídos, mas omitiu o pacote bridge por falta de script próprio.
- `pnpm exec wrangler deploy --dry-run --config packages/grok-computer-bridge/wrangler.jsonc` — falhou antes do bundle: `containers.class_name` ausente.
- `git diff --check` — passou.
- Consulta da documentação oficial do Cloudflare Containers e da documentação ACP do Grok Build — usada para validar o contrato de runtime/integração.

## Handoff Sugerido

1. Bloquear merge/deploy e corrigir Critical/High de segurança e runtime.
2. Reestruturar o bridge sobre uma API Cloudflare suportada, com um container por workspace e autenticação no Worker boundary.
3. Adicionar testes de contrato/isolamento e incluir o pacote nos gates de CI.
4. Só depois revisar UX, loop/resume e política de billing.
