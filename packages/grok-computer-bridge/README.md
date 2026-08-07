# Grok Computer Bridge

Executa o [Grok Build](https://github.com/xai-org/grok-build) dentro de um
[Cloudflare Computer](https://github.com/cloudflare/computer), com uma ponte
HTTP que transforma os eventos ACP do grok para o formato de chat do
cloudflare-os.

## Arquitetura

```
cloudflare-os (Overseer DO)
    │  HTTP / RPC
    ▼
┌─────────────────────────────────────────────┐
│  grok-computer-bridge Worker                │
│    │                                         │
│    └── GrokComputer Durable Object           │
│          ├── Workspace (SQLite VFS)          │
│          └── Container (Docker)              │
│                ├── computerd (FUSE /workspace)│
│                ├── grok agent stdio (ACP)     │
│                └── bridge.mjs (HTTP :8787)   │
└─────────────────────────────────────────────┘
```

## Componentes

### `src/bridge.mjs` — Ponte HTTP dentro do container

Servidor HTTP Node.js (zero dependências) que roda dentro do container.
Gerencia um subprocesso `grok agent stdio` e expõe:

| Endpoint | Método | Propósito |
|---|---|---|
| `/health` | GET | Status do grok agent |
| `/prompt` | POST | Envia prompt (SSE streaming) |
| `/command` | POST | Executa shell no workspace |
| `/session/reset` | POST | Reinicia a sessão |

O bridge transforma os eventos ACP (`agent_message_chunk`, `tool_call`,
`plan`, etc.) para o formato do cloudflare-os:

```json
{"type":"text","data":"Here's a summary"}
{"type":"thought","data":"Analyzing..."}
{"type":"toolCall","data":{"tool":"bash","args":{"command":"ls"}}}
{"type":"end","data":{"stopReason":"EndTurn"}}
```

### `src/worker.ts` — Cloudflare Worker

Hospeda o `GrokComputer` Durable Object que:
1. Cria um Workspace com o backend de container
2. O container roda o Dockerfile (instala grok + bridge)
3. Expõe HTTP para o cloudflare-os enviar prompts e receber respostas

### `Dockerfile` — Imagem do container

Debian com Node.js 22, grok CLI, git, curl, jq, python3 e o bridge.mjs.
O `/workspace` é montado pelo computerd (FUSE) e o grok opera nele.

## Deploy

```bash
# 1. Configurar a chave de API da xAI (secret)
npx wrangler secret put XAI_API_KEY
# cole: xai-...

# 2. Deploy
npx wrangler deploy
```

## Uso

### Enviar um prompt (streaming)

```bash
curl -N -X POST https://grok-computer-bridge.<account>.workers.dev/prompt \
  -H "Content-Type: application/json" \
  -d '{"prompt": "List the files in /workspace and explain what each does"}'
```

### Executar um comando shell

```bash
curl -X POST https://grok-computer-bridge.<account>.workers.dev/command \
  -H "Content-Type: application/json" \
  -d '{"command": "ls -la /workspace"}'
```

### Health check

```bash
curl https://grok-computer-bridge.<account>.workers.dev/health
```

### Resetar a sessão

```bash
curl -X POST https://grok-computer-bridge.<account>.workers.dev/session/reset
```

## Integração com cloudflare-os

O cloudflare-os pode integrar este bridge de duas formas:

### Opção A: Como um gatekeeper

Criar um `gatekeeper-grok` que provisiona um `GrokComputer` por workspace.
O agente do cloudflare-os acessa o grok via capability-based security.

### Opção B: Como um novo tipo de agente

Adicionar um modo no cloudflare-os onde o chat roteia para o bridge em
vez do Code Mode interno. O usuário escolhe "Grok Agent" como modelo e
os prompts são encaminhados para o bridge.

### Opção C: Como uma tool do agente existente

Adicionar uma tool `grokAgent` no agente do cloudflare-os que delega
tarefas para o grok rodando no Computer. O agente do cloudflare-os atua
como orquestrador e o grok como especialista.
