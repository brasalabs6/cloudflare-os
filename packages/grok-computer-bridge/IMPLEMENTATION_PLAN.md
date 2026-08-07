# Plano de Implementação: Grok Computer Agent (Option B)

## Visão Geral

Implementar um novo tipo de agente no cloudflare-os que roteia o chat para o **Grok Computer Bridge** em vez do Code Mode embutido. O agente roda o Grok Build dentro de um Cloudflare Computer (container Linux real com filesystem SQLite-backed), permitindo tarefas longas (24h+), loops contínuos, configuração de boot (credenciais, dotfiles, repos GitHub), e visualização na UI.

### Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│  Workshop Frontend (React SPA)                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  ChatInterface.tsx                                    │    │
│  │  ├── Model picker mostra "Grok Computer"             │    │
│  │  ├── Computer Runs Panel (lateral, colapsável)        │    │
│  │  │   ├── Status: running / paused / completed / error │    │
│  │  │   ├── Duration timer (live)                        │    │
│  │  │   ├── Last activity preview                        │    │
│  │  │   └── Controls: pause / resume / stop / reset      │    │
│  │  ├── Computer Boot Config Modal                      │    │
│  │  │   ├── GitHub repos (clone on boot)                 │    │
│  │  │   ├── Dotfiles (write to ~/)                      │    │
│  │  │   ├── Env vars (inject into container)             │    │
│  │  │   ├── Credentials (git, API keys)                  │    │
│  │  │   └── Boot script (runs on container start)        │    │
│  │  └── Stream events render: text, thought, toolCall,  │    │
│  │      toolResult, plan (igual ao Code Mode)            │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────┘
                           │  Cap'n Web RPC (WebSocket)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Workshop Backend (Cloudflare Worker + Overseer DO)         │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  OverseerDurableObject                                │    │
│  │  ├── #runAgentTurnWithContext()                       │    │
│  │  │   └── if model.config.provider === "grok-computer" │    │
│  │  │       └── #runComputerAgentTurn()  ← NOVO          │    │
│  │  ├── #runComputerAgentTurn()                          │    │
│  │  │   ├── Fetch GROK_COMPUTER_BRIDGE service binding    │    │
│  │  │   ├── POST /prompt (SSE stream)                    │    │
│  │  │   ├── Parse bridge events → AiChatStreamEvent      │    │
│  │  │   ├── Persist messages via addChatMessages()       │    │
│  │  │   ├── Long-run alarm (24h keep-alive)              │    │
│  │  │   └── Loop control (continue/pause/stop)           │    │
│  │  ├── ComputerBootConfig (per-workspace, in DO storage)│    │
│  │  │   ├── githubRepos: {url, branch, path}[]           │    │
│  │  │   ├── dotfiles: {path, content}[]                  │    │
│  │  │   ├── envVars: {key, value}[]                      │    │
│  │  │   ├── credentials: {type, value}[] (encrypted)     │    │
│  │  │   └── bootScript: string                            │    │
│  │  └── ComputerRunRegistry (active runs, in DO storage) │    │
│  │      ├── runId, chatId, status, startedAt, lastActive │    │
│  │      └── loopCount, totalDuration, error               │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────┘
                           │  HTTP (service binding)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Grok Computer Bridge (Cloudflare Worker + GrokComputer DO) │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  GrokComputer DO                                      │    │
│  │  ├── Cloudflare Computer Workspace (SQLite VFS)       │    │
│  │  ├── Container (Debian + Node + grok CLI + bridge.mjs)│    │
│  │  └── HTTP proxy → container:8787                     │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Container (Docker)                                   │    │
│  │  ├── bridge.mjs (HTTP :8787)                          │    │
│  │  │   ├── POST /prompt (SSE → ACP events)              │    │
│  │  │   ├── POST /command (shell exec)                   │    │
│  │  │   ├── POST /session/reset                          │    │
│  │  │   ├── POST /boot (apply boot config)  ← NOVO       │    │
│  │  │   ├── GET  /health                                 │    │
│  │  │   └── GET  /status (run metrics)      ← NOVO       │    │
│  │  ├── grok agent stdio (ACP JSON-RPC)                  │    │
│  │  └── /workspace (FUSE mount from Computer VFS)        │    │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Epic 1: Shared API — Tipos e Contratos RPC

### 1.1 Novo provider `"grok-computer"` em `AiModelProvider`

**Arquivo:** `packages/workshop-shared/src/api.ts`

Adicionar `"grok-computer"` ao tipo `AiModelProvider` (linha ~920) e à constante `SUGGESTED_MODELS` (linha ~965):

```typescript
// Em AiModelProvider:
export type AiModelProvider = "openai" | "anthropic" | "google" | "cloudflare" | "ollama" | "cf-proxy" | "grok-computer";

// Em SUGGESTED_MODELS:
"grok-computer": [
  {
    id: "grok-computer-default",
    name: "Grok Computer",
    provider: "grok-computer",
    contextWindow: 200000,
    description: "Grok Build running inside a Cloudflare Computer with full Linux environment",
  },
],
```

### 1.2 Novo tipo `ComputerBootConfig`

**Arquivo:** `packages/workshop-shared/src/api.ts`

```typescript
/** Configuration for bootstrapping a Cloudflare Computer container. */
export type ComputerBootConfig = {
  /** GitHub repositories to clone on boot. Cloned into /workspace/repos/<name>. */
  githubRepos: Array<{
    url: string;       // e.g. "https://github.com/user/repo"
    branch?: string;  // default: main
    path?: string;     // subdirectory to clone into, default: repo name
    private?: boolean; // if true, uses configured GitHub token
  }>;

  /** Dotfiles to write into the container's home directory. */
  dotfiles: Array<{
    path: string;     // e.g. ".bashrc", ".gitconfig", ".grok/config.toml"
    content: string;
  }>;

  /** Environment variables to inject into the container. */
  envVars: Array<{
    key: string;
    value: string;
    secret?: boolean;  // if true, value is masked in UI
  }>;

  /** Credentials for authentication. Stored encrypted in DO storage. */
  credentials: Array<{
    type: "github-token" | "ssh-key" | "api-key" | "custom";
    name: string;
    value: string;  // the token/key/secret
  }>;

  /** Shell script to run after boot (after repos cloned, dotfiles written, env set). */
  bootScript?: string;

  /** Grok model to use inside the Computer. */
  grokModel?: string;

  /** Whether to enable auto-approve in the grok agent (headless mode). */
  autoApprove?: boolean;

  /** Max loop iterations before auto-stopping (0 = unlimited). */
  maxLoopIterations?: number;

  /** Max run duration in seconds (0 = unlimited, default 86400 = 24h). */
  maxDurationSeconds?: number;
};
```

### 1.3 Novo tipo `ComputerRunStatus`

```typescript
/** Status of a Computer agent run. */
export type ComputerRunStatus = {
  runId: string;
  chatId: number;
  status: "idle" | "booting" | "running" | "paused" | "completed" | "error" | "timeout";
  startedAt: Date;
  lastActiveAt: Date;
  /** Total wall-clock duration in ms. */
  durationMs: number;
  /** Number of loop iterations completed. */
  loopCount: number;
  /** Last text output from the agent (truncated for preview). */
  lastOutputPreview: string;
  /** Error message if status is "error". */
  error?: string;
  /** Current grok session ID inside the container. */
  grokSessionId?: string;
  /** Whether the container is currently alive. */
  containerAlive: boolean;
};
```

### 1.4 Extensões da interface `Overseer`

```typescript
// Em Overseer (api.ts ~1430):

  // Get the Computer boot configuration for this workspace.
  getComputerBootConfig(): Promise<ComputerBootConfig>;

  // Set the Computer boot configuration. Applied on next container boot.
  setComputerBootConfig(config: ComputerBootConfig): Promise<void>;

  // Get the status of the current or most recent Computer agent run.
  getComputerRunStatus(): Promise<ComputerRunStatus | null>;

  // Pause the current Computer agent run (suspends the grok process).
  pauseComputerRun(): Promise<void>;

  // Resume a paused Computer agent run.
  resumeComputerRun(): Promise<void>;

  // Stop the current Computer agent run and reset the grok session.
  stopComputerRun(): Promise<void>;

  // Send a direct shell command to the Computer (bypasses grok agent).
  // Useful for inspecting files, running tests, etc.
  sendComputerCommand(command: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;
```

### 1.5 Novo `AiChatStreamEvent` para Computer

Adicionar variantes ao tipo `AiChatStreamEvent` (linha ~2301):

```typescript
  // Computer agent boot started.
  | { type: "computerBooting" }
  // Computer agent boot completed.
  | { type: "computerBooted"; grokSessionId: string }
  // Computer agent loop iteration started.
  | { type: "computerLoopStart"; iteration: number }
  // Computer agent loop iteration completed.
  | { type: "computerLoopEnd"; iteration: number; durationMs: number }
  // Computer agent run status changed.
  | { type: "computerStatus"; status: ComputerRunStatus["status"] }
```

---

## Epic 2: Backend — Roteamento e Execução do Computer Agent

### 2.1 Roteamento em `ai-models.ts`

**Arquivo:** `packages/workshop-backend/src/ai-models.ts`

Adicionar caso `"grok-computer"` em `getModelDirect()` e `catalogModel()`:

```typescript
// Em getModelDirect():
case "grok-computer": {
  // The Computer agent doesn't use pi's streaming model interface.
  // Instead, #runComputerAgentTurn() handles execution directly.
  // We return a minimal ModelHandle that signals "computer mode".
  return {
    api: "grok-computer",
    stream: async function* () {
      // This generator is never called — #runAgentTurnWithContext
      // branches to #runComputerAgentTurn() before reaching runAgent().
      throw new Error("Computer agent does not use pi streaming");
    },
    // ... other required ModelHandle fields with stubs
  };
}
```

### 2.2 Branch em `#runAgentTurnWithContext()`

**Arquivo:** `packages/workshop-backend/src/overseer.ts`

Na função `#runAgentTurnWithContext()` (linha ~3864), adicionar branch no início:

```typescript
async #runAgentTurnWithContext(chatId, aiModel, initiator, callbackInitiated, liveChat) {
  // ── Computer agent branch ──────────────────────────────────
  if (aiModel.config.provider === "grok-computer") {
    return this.#runComputerAgentTurn(chatId, aiModel, initiator, liveChat);
  }

  // ── Normal agent flow (existing code) ──────────────────────
  // ... existing code unchanged ...
}
```

### 2.3 Implementar `#runComputerAgentTurn()`

**Arquivo:** `packages/workshop-backend/src/overseer.ts`

Nova função na classe `OverseerImpl`:

```typescript
/**
 * Runs a Computer agent turn. Instead of calling pi's runAgent(), this:
 * 1. Boots the Computer container (if not already running)
 * 2. Sends the user's prompt to the grok bridge via HTTP
 * 3. Streams SSE events back as AiChatStreamEvent
 * 4. Persists the response as AiChatMessage
 * 5. If loop mode is enabled, continues sending prompts until stopped
 *
 * Long-running support:
 * - Uses ctx.waitUntil() to keep the DO alive across requests
 * - Sets a 24h alarm to enforce max duration
 * - Stores run state in DO storage for resumption after restart
 * - Emits computerStatus events so the UI can track progress
 */
async #runComputerAgentTurn(
  chatId: number,
  aiModel: UserAiModelRecord,
  initiator: AiChatAuthorInfo,
  liveChat: LiveChatContext,
): Promise<void> {
  const turnLogger = this.logger.with({
    operation: "computer.agent.run",
    chatId,
    modelId: aiModel.profile.id,
  });

  try {
    // 1. Get or create the Computer run state
    let runState = await this.#getOrCreateComputerRunState(chatId, aiModel);
    turnLogger.info("computer agent run started", {
      event: "computer.agent.run.started",
      runId: runState.runId,
    });

    // 2. Emit booting event
    this.#emitStreamEvent(chatId, { type: "computerBooting" });

    // 3. Ensure container is booted with the configured boot config
    const bootConfig = await this.#getComputerBootConfig();
    const bridgeUrl = await this.#ensureComputerBooted(bootConfig, runState);

    // 4. Emit booted event
    this.#emitStreamEvent(chatId, {
      type: "computerBooted",
      grokSessionId: runState.grokSessionId ?? "",
    });

    // 5. Build the prompt from chat history
    const chatMessages = this.#listChatTail(chatId, null);
    const lastUserMessage = [...chatMessages]
      .reverse()
      .find(m => m.author.type === "user" && m.type === "message");
    const prompt = lastUserMessage?.type === "message"
      ? lastUserMessage.text
      : "";

    if (!prompt) {
      turnLogger.warn("no user message found for computer agent", { chatId });
      return;
    }

    // 6. Run the agent loop
    const maxLoops = bootConfig.maxLoopIterations ?? 1;
    const maxDuration = (bootConfig.maxDurationSeconds ?? 86400) * 1000;

    while (runState.status === "running") {
      // Check duration limit
      const elapsed = Date.now() - runState.startedAt.getTime();
      if (maxDuration > 0 && elapsed >= maxDuration) {
        runState.status = "timeout";
        this.#emitStreamEvent(chatId, {
          type: "computerStatus",
          status: "timeout",
        });
        break;
      }

      // Check loop limit
      if (maxLoops > 0 && runState.loopCount >= maxLoops) {
        runState.status = "completed";
        this.#emitStreamEvent(chatId, {
          type: "computerStatus",
          status: "completed",
        });
        break;
      }

      // Emit loop start
      this.#emitStreamEvent(chatId, {
        type: "computerLoopStart",
        iteration: runState.loopCount + 1,
      });

      const loopStart = Date.now();

      // Send prompt to bridge and stream response
      await this.#streamComputerPrompt(chatId, bridgeUrl, prompt, runState, liveChat);

      runState.loopCount++;
      runState.lastActiveAt = new Date();
      const loopDuration = Date.now() - loopStart;

      this.#emitStreamEvent(chatId, {
        type: "computerLoopEnd",
        iteration: runState.loopCount,
        durationMs: loopDuration,
      });

      // Persist the run state
      await this.#saveComputerRunState(chatId, runState);

      // Check abort signal
      if (liveChat.cancelController.signal.aborted) {
        runState.status = "paused";
        this.#emitStreamEvent(chatId, {
          type: "computerStatus",
          status: "paused",
        });
        break;
      }
    }

    // 7. Persist final status
    await this.#saveComputerRunState(chatId, runState);
    this.#emitStreamEvent(chatId, {
      type: "computerStatus",
      status: runState.status,
    });

    turnLogger.info("computer agent run finished", {
      event: "computer.agent.run.finished",
      runId: runState.runId,
      status: runState.status,
      loopCount: runState.loopCount,
      durationMs: Date.now() - runState.startedAt.getTime(),
    });

  } catch (err) {
    turnLogger.error("computer agent run failed", {
      event: "computer.agent.run.failed",
      error: err,
    });
    // Persist error state
    await this.#updateComputerRunState(chatId, { status: "error", error: String(err) });
    this.#emitStreamEvent(chatId, { type: "computerStatus", status: "error" });
    // Post error message to chat
    this.postAgentErrorMessage(chatId, aiModel.profile, String(err), "computer_error");
  } finally {
    this.#unregisterRunningAgent(chatId);
  }
}
```

### 2.4 Métodos auxiliares do Computer no Overseer

```typescript
/**
 * Gets or creates the Computer run state for a chat.
 * The run state persists across DO restarts via DO storage.
 */
async #getOrCreateComputerRunState(
  chatId: number,
  aiModel: UserAiModelRecord,
): Promise<ComputerRunState> {
  const key = `computerRun.${chatId}`;
  let state = this.storage.computerRuns.get(key);
  if (!state || state.status === "completed" || state.status === "error") {
    const runId = crypto.randomUUID();
    state = {
      runId,
      chatId,
      status: "running",
      startedAt: new Date(),
      lastActiveAt: new Date(),
      durationMs: 0,
      loopCount: 0,
      lastOutputPreview: "",
      containerAlive: false,
    };
    this.storage.computerRuns.put(key, state);
  }
  return state;
}

/**
 * Ensures the Computer container is booted with the given config.
 * Calls the bridge's /boot endpoint to apply repos, dotfiles, env vars, etc.
 */
async #ensureComputerBooted(
  bootConfig: ComputerBootConfig,
  runState: ComputerRunState,
): Promise<string> {
  const bridgeUrl = this.env.GROK_COMPUTER_BRIDGE
    ? this.env.GROK_COMPUTER_BRIDGE.url
    : "http://localhost:8787";

  // Call /boot to apply configuration
  const bootResponse = await fetch(`${bridgeUrl}/boot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(this.env.GROK_BRIDGE_API_KEY
        ? { Authorization: `Bearer ${this.env.GROK_BRIDGE_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      githubRepos: bootConfig.githubRepos,
      dotfiles: bootConfig.dotfiles,
      envVars: bootConfig.envVars,
      credentials: bootConfig.credentials,
      bootScript: bootConfig.bootScript,
      grokModel: bootConfig.grokModel ?? "grok-build",
      autoApprove: bootConfig.autoApprove ?? true,
    }),
  });

  if (!bootResponse.ok) {
    throw new Error(`Computer boot failed: ${bootResponse.status} ${await bootResponse.text()}`);
  }

  const result = await bootResponse.json() as { grokSessionId: string };
  runState.grokSessionId = result.grokSessionId;
  runState.containerAlive = true;
  return bridgeUrl;
}

/**
 * Streams a prompt to the Computer bridge and transforms SSE events
 * into AiChatStreamEvent for the chat subscribers.
 */
async #streamComputerPrompt(
  chatId: number,
  bridgeUrl: string,
  prompt: string,
  runState: ComputerRunState,
  liveChat: LiveChatContext,
): Promise<void> {
  const response = await fetch(`${bridgeUrl}/prompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(this.env.GROK_BRIDGE_API_KEY
        ? { Authorization: `Bearer ${this.env.GROK_BRIDGE_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({ prompt, alwaysApprove: true }),
    signal: liveChat.cancelController.signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Bridge error: ${response.status}`);
  }

  // Parse SSE stream and emit AiChatStreamEvent
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      try {
        const event = JSON.parse(data);
        const streamEvent = this.#transformBridgeEvent(event);
        if (streamEvent) {
          this.#emitStreamEvent(chatId, streamEvent);
          if (event.type === "text") {
            fullText += event.data;
          }
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  // Persist the agent response as a chat message
  runState.lastOutputPreview = fullText.slice(0, 200);
  this.addChatMessages(chatId, { type: "agent", id: "grok-computer", name: "Grok Computer" }, [{
    type: "message",
    text: fullText,
    model: "grok-computer",
  }]);
}

/**
 * Transforms a bridge SSE event into an AiChatStreamEvent.
 * Bridge events: { type: "text"|"thought"|"toolCall"|"toolResult"|"plan"|"end", data }
 * Maps to AiChatStreamEvent variants.
 */
#transformBridgeEvent(event: BridgeEvent): AiChatStreamEvent | null {
  switch (event.type) {
    case "text":
      return { type: "textDelta", delta: event.data };
    case "thought":
      return { type: "reasoningDelta", delta: event.data };
    case "toolCall":
      return {
        type: "toolCallStarted",
        toolCallId: event.data.id ?? crypto.randomUUID(),
        toolName: event.data.tool,
      };
    case "toolResult":
      return {
        type: "toolOutputDelta",
        toolCallId: event.data.id ?? "",
        delta: typeof event.data.result === "string"
          ? event.data.result
          : JSON.stringify(event.data.result),
      };
    case "end":
      return null; // handled by caller
    default:
      return null;
  }
}

/** Emits a stream event to all chat subscribers. */
#emitStreamEvent(chatId: number, event: AiChatStreamEvent): void {
  for (const subscriber of this.#chatSubscribers) {
    subscriber.stream(chatId, event).catch(() => {});
  }
}
```

### 2.5 Boot config storage no Overseer

Adicionar à classe `OverseerImpl`:

```typescript
// In storage initialization:
// computerBootConfig: StorageCollection<ComputerBootConfig> — stored as single record
// computerRuns: StorageCollection<ComputerRunState> — keyed by `computerRun.<chatId>`

async #getComputerBootConfig(): Promise<ComputerBootConfig> {
  return this.storage.computerBootConfig.get("default")
    ?? {
      githubRepos: [],
      dotfiles: [],
      envVars: [],
      credentials: [],
      bootScript: "",
      autoApprove: true,
      maxLoopIterations: 0,
      maxDurationSeconds: 86400,
    };
}

async #setComputerBootConfig(config: ComputerBootConfig): Promise<void> {
  this.storage.computerBootConfig.put("default", config);
}
```

### 2.6 Alarm para long-running (24h)

Modificar `alarm()` no `OverseerDurableObject`:

```typescript
async alarm() {
  // Check for active Computer agent runs that need continuation
  const computerRuns = this.impl.storage.computerRuns.list();
  for (const [key, run] of computerRuns) {
    if (run.status === "running") {
      // Reschedule alarm for the next check interval (5 min)
      this.ctx.storage.setAlarm(Date.now() + 300_000);
      // The run will be resumed by #runComputerAgentTurn's loop
      return;
    }
  }
  // Fall through to normal agent completion check
  await this.impl.waitForAllAgentsToComplete();
  await this.impl.deliverReadyExternalMessageResponses();
}
```

### 2.7 Service binding no wrangler

**Arquivo:** `packages/workshop-backend/wrangler.prod.jsonc` (e dev config)

Adicionar service binding para o grok-computer-bridge:

```jsonc
{
  "services": [
    {
      "binding": "GROK_COMPUTER_BRIDGE",
      "service": "grok-computer-bridge"
    }
  ]
}
```

---

## Epic 3: Bridge — Endpoints de Boot e Status

### 3.1 Novo endpoint `POST /boot` no bridge.mjs

**Arquivo:** `packages/grok-computer-bridge/src/bridge.mjs`

```javascript
// ── POST /boot ──────────────────────────────────────────────────────────
// Applies boot configuration to the Computer container:
//   1. Writes dotfiles to ~/
//   2. Sets environment variables
//   3. Clones GitHub repos into /workspace/repos/
//   4. Writes credentials (git config, SSH keys, API keys)
//   5. Runs the boot script
//   6. Restarts the grok agent with the new configuration
//
// Request body: ComputerBootConfig (minus the metadata fields)
// Response: { ok: true, grokSessionId: "..." }
if (req.method === "POST" && url.pathname === "/boot") {
  if (!authenticate(req)) {
    res.writeHead(401);
    res.end('{"error":"unauthorized"}');
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;
  let config;
  try {
    config = JSON.parse(body);
  } catch {
    res.writeHead(400);
    res.end('{"error":"invalid JSON"}');
    return;
  }

  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const os = await import("node:os");
  const { exec } = await import("node:child_process");

  const homeDir = os.homedir();
  const workspaceDir = GROK_CWD;

  // 1. Write dotfiles
  for (const dotfile of config.dotfiles ?? []) {
    const filePath = path.join(homeDir, dotfile.path);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, dotfile.content, "utf8");
  }

  // 2. Set environment variables (for the grok process)
  // These are set in process.env so the restarted grok inherits them
  for (const envVar of config.envVars ?? []) {
    process.env[envVar.key] = envVar.value;
  }

  // 3. Clone GitHub repos
  const reposDir = path.join(workspaceDir, "repos");
  await fs.mkdir(reposDir, { recursive: true });
  for (const repo of config.githubRepos ?? []) {
    const repoName = repo.path || repo.url.split("/").pop()?.replace(".git", "") || "repo";
    const cloneDir = path.join(reposDir, repoName);
    const branchFlag = repo.branch ? ` -b ${repo.branch}` : "";
    const token = repo.private
      ? config.credentials?.find(c => c.type === "github-token")?.value
      : null;
    const cloneUrl = token
      ? repo.url.replace("https://", `https://${token}@`)
      : repo.url;

    await new Promise((resolve, reject) => {
      exec(`git clone ${branchFlag} ${cloneUrl} ${cloneDir}`, { timeout: 120_000 }, (err) => {
        if (err && !err.message.includes("already exists")) reject(err);
        else resolve();
      });
    });
  }

  // 4. Write credentials
  for (const cred of config.credentials ?? []) {
    switch (cred.type) {
      case "github-token":
        // Write to .gitconfig
        await fs.appendFile(path.join(homeDir, ".gitconfig"),
          `\n[github]\n  token = ${cred.value}\n`);
        break;
      case "ssh-key":
        await fs.mkdir(path.join(homeDir, ".ssh"), { recursive: true });
        await fs.writeFile(path.join(homeDir, ".ssh/id_rsa"), cred.value, { mode: 0o600 });
        break;
      case "api-key":
        // Store as env var for the grok process
        process.env[cred.name] = cred.value;
        break;
    }
  }

  // 5. Run boot script
  if (config.bootScript) {
    await new Promise((resolve) => {
      exec(config.bootScript, { cwd: workspaceDir, timeout: 300_000 }, () => resolve());
    });
  }

  // 6. Restart grok agent with new model/config
  if (grokProc) {
    grokProc.kill("SIGTERM");
    grokProc = null;
    sessionId = null;
  }

  // Update model if specified
  if (config.grokModel) {
    process.env.GROK_MODEL = config.grokModel;
  }

  await startGrokAgent();

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, grokSessionId: sessionId }));
  return;
}
```

### 3.2 Novo endpoint `GET /status` no bridge.mjs

```javascript
// ── GET /status ──────────────────────────────────────────────────────────
// Returns detailed status of the current run, including loop metrics.
if (req.method === "GET" && url.pathname === "/status") {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    ok: true,
    grokRunning: grokProc !== null,
    sessionId: sessionId,
    model: GROK_MODEL,
    cwd: GROK_CWD,
    uptime: grokProc ? process.uptime() : 0,
    pendingRequests: pendingRequests.size,
    eventListeners: eventListeners.size,
  }));
  return;
}
```

### 3.3 Novo endpoint `POST /session/pause` e `POST /session/resume`

```javascript
// ── POST /session/pause ─────────────────────────────────────────────────
// Pauses the grok agent by sending SIGSTOP to the process.
// The process stays alive but is suspended.
if (req.method === "POST" && url.pathname === "/session/pause") {
  if (!authenticate(req)) { res.writeHead(401); res.end('{"error":"unauthorized"}'); return; }
  if (grokProc) {
    grokProc.kill("SIGSTOP");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, message: "grok agent paused" }));
  } else {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "grok agent not running" }));
  }
  return;
}

// ── POST /session/resume ────────────────────────────────────────────────
// Resumes a paused grok agent by sending SIGCONT.
if (req.method === "POST" && url.pathname === "/session/resume") {
  if (!authenticate(req)) { res.writeHead(401); res.end('{"error":"unauthorized"}'); return; }
  if (grokProc) {
    grokProc.kill("SIGCONT");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, message: "grok agent resumed" }));
  } else {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "grok agent not running" }));
  }
  return;
}
```

---

## Epic 4: Frontend — UI de Visualização e Configuração

### 4.1 Computer Runs Panel no ChatInterface

**Arquivo:** `packages/workshop-frontend/src/ChatInterface.tsx`

Adicionar um painel colapsável na lateral do chat que mostra o status do Computer agent:

```tsx
// New component: ComputerRunPanel
function ComputerRunPanel({
  runStatus,
  onPause,
  onResume,
  onStop,
  onReset,
}: {
  runStatus: ComputerRunStatus | null;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onReset: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  if (!runStatus) return null;

  const statusColors = {
    running: "var(--color-kumo-success)",
    paused: "var(--color-kumo-warning)",
    error: "var(--color-kumo-danger)",
    completed: "var(--color-kumo-info)",
    timeout: "var(--color-kumo-warning)",
    booting: "var(--color-kumo-info)",
    idle: "var(--color-kumo-tint)",
  };

  return (
    <div style={{
      border: "1px solid var(--color-kumo-border)",
      borderRadius: "8px",
      padding: "12px",
      marginBottom: "8px",
    }}>
      <div onClick={() => setExpanded(!expanded)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
        {expanded ? <CaretDown size={16} /> : <CaretRight size={16} />}
        <Circle size={8} fill={statusColors[runStatus.status]} color={statusColors[runStatus.status]} />
        <Text size="sm" weight="medium">Computer Run</Text>
        <Text size="xs" color="secondary">{runStatus.status}</Text>
        {runStatus.status === "running" && (
          <Text size="xs" color="secondary">
            {formatDuration(Date.now() - runStatus.startedAt.getTime())}
          </Text>
        )}
      </div>
      {expanded && (
        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <Row label="Run ID" value={runStatus.runId.slice(0, 8)} />
          <Row label="Loops" value={String(runStatus.loopCount)} />
          <Row label="Started" value={formatTimestamp(runStatus.startedAt)} />
          <Row label="Last Active" value={formatTimestamp(runStatus.lastActiveAt)} />
          {runStatus.lastOutputPreview && (
            <div>
              <Text size="xs" color="secondary">Last Output</Text>
              <div style={{
                background: "var(--color-kumo-tint)",
                padding: "8px",
                borderRadius: "4px",
                fontSize: "12px",
                fontFamily: "monospace",
                maxHeight: "100px",
                overflow: "auto",
              }}>
                {runStatus.lastOutputPreview}
              </div>
            </div>
          )}
          {runStatus.error && (
            <Banner type="danger" size="sm">{runStatus.error}</Banner>
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            {runStatus.status === "running" && (
              <Button size="sm" variant="secondary" onClick={onPause}>
                <Pause size={14} /> Pause
              </Button>
            )}
            {runStatus.status === "paused" && (
              <Button size="sm" variant="secondary" onClick={onResume}>
                <Play size={14} /> Resume
              </Button>
            )}
            {(runStatus.status === "running" || runStatus.status === "paused") && (
              <Button size="sm" variant="danger" onClick={onStop}>
                <Stop size={14} /> Stop
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onReset}>
              <ArrowClockwise size={14} /> Reset
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 4.2 Computer Boot Config Modal

**Arquivo:** `packages/workshop-frontend/src/components/chat/ComputerBootConfigModal.tsx` (novo)

```tsx
// Modal for configuring the Computer's boot/preparation.
// Accessed from the chat interface when "Grok Computer" model is selected.

export function ComputerBootConfigModal({
  open,
  onClose,
  config,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  config: ComputerBootConfig;
  onSave: (config: ComputerBootConfig) => Promise<void>;
}) {
  const [githubRepos, setGithubRepos] = useState(config.githubRepos);
  const [dotfiles, setDotfiles] = useState(config.dotfiles);
  const [envVars, setEnvVars] = useState(config.envVars);
  const [credentials, setCredentials] = useState(config.credentials);
  const [bootScript, setBootScript] = useState(config.bootScript ?? "");
  const [grokModel, setGrokModel] = useState(config.grokModel ?? "grok-build");
  const [autoApprove, setAutoApprove] = useState(config.autoApprove ?? true);
  const [maxLoops, setMaxLoops] = useState(config.maxLoopIterations ?? 0);
  const [maxDuration, setMaxDuration] = useState(config.maxDurationSeconds ?? 86400);
  const [saving, setSaving] = useState(false);

  // Tabs: Repos | Dotfiles | Env Vars | Credentials | Boot Script | Advanced
  return (
    <Modal open={open} onClose={onClose} title="Computer Boot Configuration" size="large">
      <Tabs>
        <TabsList>
          <TabsTrigger>GitHub Repos</TabsTrigger>
          <TabsTrigger>Dotfiles</TabsTrigger>
          <TabsTrigger>Env Vars</TabsTrigger>
          <TabsTrigger>Credentials</TabsTrigger>
          <TabsTrigger>Boot Script</TabsTrigger>
          <TabsTrigger>Advanced</TabsTrigger>
        </TabsList>

        {/* GitHub Repos tab */}
        <TabsContent>
          {githubRepos.map((repo, i) => (
            <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <Input placeholder="https://github.com/user/repo" value={repo.url}
                onChange={e => updateRepo(i, { url: e.target.value })} />
              <Input placeholder="branch (default: main)" value={repo.branch ?? ""}
                onChange={e => updateRepo(i, { branch: e.target.value })} />
              <Input placeholder="path (optional)" value={repo.path ?? ""}
                onChange={e => updateRepo(i, { path: e.target.value })} />
              <Switch checked={repo.private ?? false}
                onChange={v => updateRepo(i, { private: v })} />
              <Button onClick={() => removeRepo(i)}>Remove</Button>
            </div>
          ))}
          <Button onClick={() => setGithubRepos([...githubRepos, { url: "", branch: "", path: "", private: false }])}>
            Add Repo
          </Button>
        </TabsContent>

        {/* Dotfiles tab */}
        <TabsContent>
          {dotfiles.map((df, i) => (
            <div key={i} style={{ marginBottom: "12px" }}>
              <Input placeholder=".bashrc" value={df.path}
                onChange={e => updateDotfile(i, { path: e.target.value })} />
              <Textarea placeholder="File content" value={df.content}
                onChange={e => updateDotfile(i, { content: e.target.value })}
                rows={8} style={{ fontFamily: "monospace" }} />
              <Button onClick={() => removeDotfile(i)}>Remove</Button>
            </div>
          ))}
          <Button onClick={() => setDotfiles([...dotfiles, { path: "", content: "" }])}>
            Add Dotfile
          </Button>
        </TabsContent>

        {/* Env Vars tab */}
        <TabsContent>
          {envVars.map((ev, i) => (
            <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <Input placeholder="KEY" value={ev.key}
                onChange={e => updateEnvVar(i, { key: e.target.value })} />
              <Input placeholder="value" value={ev.value} type={ev.secret ? "password" : "text"}
                onChange={e => updateEnvVar(i, { value: e.target.value })} />
              <Switch checked={ev.secret ?? false}
                onChange={v => updateEnvVar(i, { secret: v })} />
              <Button onClick={() => removeEnvVar(i)}>Remove</Button>
            </div>
          ))}
          <Button onClick={() => setEnvVars([...envVars, { key: "", value: "", secret: false }])}>
            Add Env Var
          </Button>
        </TabsContent>

        {/* Credentials tab */}
        <TabsContent>
          {credentials.map((cred, i) => (
            <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <Select value={cred.type}
                onChange={v => updateCredential(i, { type: v as any })}>
                <option value="github-token">GitHub Token</option>
                <option value="ssh-key">SSH Key</option>
                <option value="api-key">API Key</option>
                <option value="custom">Custom</option>
              </Select>
              <Input placeholder="name" value={cred.name}
                onChange={e => updateCredential(i, { name: e.target.value })} />
              <Input placeholder="value" type="password" value={cred.value}
                onChange={e => updateCredential(i, { value: e.target.value })} />
              <Button onClick={() => removeCredential(i)}>Remove</Button>
            </div>
          ))}
          <Button onClick={() => setCredentials([...credentials, { type: "github-token", name: "", value: "" }])}>
            Add Credential
          </Button>
        </TabsContent>

        {/* Boot Script tab */}
        <TabsContent>
          <Textarea
            placeholder="# Runs after repos are cloned, dotfiles written, env vars set"
            value={bootScript}
            onChange={setBootScript}
            rows={12}
            style={{ fontFamily: "monospace", width: "100%" }}
          />
        </TabsContent>

        {/* Advanced tab */}
        <TabsContent>
          <FormField label="Grok Model">
            <Input value={grokModel} onChange={setGrokModel} placeholder="grok-build" />
          </FormField>
          <FormField label="Auto-approve tools">
            <Switch checked={autoApprove} onChange={setAutoApprove} />
          </FormField>
          <FormField label="Max loop iterations (0 = unlimited)">
            <Input type="number" value={maxLoops} onChange={v => setMaxLoops(Number(v))} />
          </FormField>
          <FormField label="Max duration (seconds, 0 = unlimited, default 86400 = 24h)">
            <Input type="number" value={maxDuration} onChange={v => setMaxDuration(Number(v))} />
          </FormField>
        </TabsContent>
      </Tabs>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={saving} onClick={async () => {
          setSaving(true);
          await onSave({
            githubRepos, dotfiles, envVars, credentials,
            bootScript, grokModel, autoApprove,
            maxLoopIterations: maxLoops,
            maxDurationSeconds: maxDuration,
          });
          setSaving(false);
          onClose();
        }}>Save Configuration</Button>
      </div>
    </Modal>
  );
}
```

### 4.3 Integração no ChatInterface

**Arquivo:** `packages/workshop-frontend/src/ChatInterface.tsx`

Modificar o componente principal para:

1. Detectar quando o modelo selecionado é `"grok-computer"`
2. Mostrar o `ComputerRunPanel` acima da área de mensagens
3. Adicionar botão de configuração (gear icon) que abre o `ComputerBootConfigModal`
4. Subscrever ao `getComputerRunStatus()` periodicamente (poll a cada 5s quando running)
5. Renderizar os novos `AiChatStreamEvent` variants (`computerBooting`, `computerBooted`, `computerLoopStart`, `computerLoopEnd`, `computerStatus`)

```tsx
// In ChatInterface component:
const [computerRunStatus, setComputerRunStatus] = useState<ComputerRunStatus | null>(null);
const [bootConfigOpen, setBootConfigOpen] = useState(false);
const [bootConfig, setBootConfig] = useState<ComputerBootConfig | null>(null);
const isComputerModel = selectedModel?.id === "grok-computer-default";

// Poll run status when computer model is active
useEffect(() => {
  if (!isComputerModel || !overseer) return;
  const interval = setInterval(async () => {
    const status = await overseer.getComputerRunStatus();
    setComputerRunStatus(status);
  }, 5000);
  return () => clearInterval(interval);
}, [isComputerModel, overseer]);

// Load boot config when computer model is selected
useEffect(() => {
  if (!isComputerModel || !overseer) return;
  overseer.getComputerBootConfig().then(setBootConfig);
}, [isComputerModel, overseer]);

// Handle stream events for computer
const onStreamEvent = (chatId: number, event: AiChatStreamEvent) => {
  switch (event.type) {
    case "computerBooting":
      setComputerRunStatus(prev => prev ? { ...prev, status: "booting" } : null);
      break;
    case "computerBooted":
      setComputerRunStatus(prev => prev ? { ...prev, status: "running", grokSessionId: event.grokSessionId } : null);
      break;
    case "computerLoopStart":
      // Update loop iteration display
      break;
    case "computerLoopEnd":
      setComputerRunStatus(prev => prev ? {
        ...prev,
        loopCount: event.iteration,
        lastActiveAt: new Date(),
      } : null);
      break;
    case "computerStatus":
      setComputerRunStatus(prev => prev ? { ...prev, status: event.status } : null);
      break;
    // ... existing event handlers
  }
};
```

### 4.4 Model picker — adicionar ícone do Computer

No model picker dropdown, quando o modelo é `grok-computer`, mostrar um ícone de Computer (Desktop icon do Phosphor) e um badge "Container".

---

## Epic 5: Bridge Worker — Proxy de Boot e Status

### 5.1 Atualizar worker.ts para rotear novos endpoints

**Arquivo:** `packages/grok-computer-bridge/src/worker.ts`

Adicionar rotas para `/boot`, `/status`, `/session/pause`, `/session/resume`:

```typescript
// In the Worker fetch handler, add:
if (request.method === "POST" && url.pathname === "/boot") {
  const body = await request.json();
  const result = await stub.boot(body);
  return Response.json(result);
}

if (request.method === "GET" && url.pathname === "/status") {
  const result = await stub.status();
  return Response.json(result);
}

if (request.method === "POST" && url.pathname === "/session/pause") {
  const result = await stub.pauseSession();
  return Response.json(result);
}

if (request.method === "POST" && url.pathname === "/session/resume") {
  const result = await stub.resumeSession();
  return Response.json(result);
}
```

Adicionar métodos correspondentes no `GrokComputer` DO:

```typescript
async boot(config: ComputerBootConfig): Promise<{ ok: boolean; grokSessionId: string }> {
  const url = await this.ensureStarted();
  const response = await fetch(`${url}/boot`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(this.env.GROK_BRIDGE_API_KEY ? { Authorization: `Bearer ${this.env.GROK_BRIDGE_API_KEY}` } : {}) },
    body: JSON.stringify(config),
  });
  return response.json();
}

async status(): Promise<{ ok: boolean; grokRunning: boolean; sessionId: string | null; uptime: number }> {
  const url = await this.ensureStarted();
  const response = await fetch(`${url}/status`);
  return response.json();
}

async pauseSession(): Promise<{ ok: boolean }> {
  const url = await this.ensureStarted();
  const response = await fetch(`${url}/session/pause`, { method: "POST" });
  return response.json();
}

async resumeSession(): Promise<{ ok: boolean }> {
  const url = await this.ensureStarted();
  const response = await fetch(`${url}/session/resume`, { method: "POST" });
  return response.json();
}
```

---

## Epic 6: Env Bindings e Deployment

### 6.1 Env vars do workshop-backend

**Arquivo:** `packages/workshop-backend/src/env.d.ts`

```typescript
// Add to Cloudflare.Env:
/** URL of the grok-computer-bridge Worker (service binding). */
GROK_COMPUTER_BRIDGE?: { url: string; fetch: typeof fetch };
/** API key for authenticating with the bridge. */
GROK_BRIDGE_API_KEY?: string;
```

### 6.2 Wrangler config do workshop-backend

**Arquivo:** `packages/workshop-backend/wrangler.prod.jsonc`

```jsonc
{
  "services": [
    {
      "binding": "GROK_COMPUTER_BRIDGE",
      "service": "grok-computer-bridge"
    }
  ]
}
```

### 6.3 Wrangler config do grok-computer-bridge

**Arquivo:** `packages/grok-computer-bridge/wrangler.jsonc`

Adicionar suporte para XAI_API_KEY como secret e GROK_BRIDGE_API_KEY:

```jsonc
{
  "vars": {
    "GROK_BRIDGE_API_KEY": "",
    "GROK_MODEL": "grok-build"
  }
  // XAI_API_KEY is set via `wrangler secret put XAI_API_KEY`
}
```

---

## Sequência de Implementação

### Fase 1: Shared API (1 arquivo)
1. `packages/workshop-shared/src/api.ts` — adicionar `"grok-computer"` provider, `ComputerBootConfig`, `ComputerRunStatus`, novos métodos no `Overseer`, novos `AiChatStreamEvent` variants

### Fase 2: Backend Kernel (3 arquivos)
2. `packages/workshop-backend/src/ai-models.ts` — caso `"grok-computer"` em `getModelDirect()` e `catalogModel()`
3. `packages/workshop-backend/src/overseer.ts` — `#runComputerAgentTurn()`, métodos auxiliares, boot config storage, alarm modification
4. `packages/workshop-backend/src/env.d.ts` — bindings `GROK_COMPUTER_BRIDGE`, `GROK_BRIDGE_API_KEY`

### Fase 3: Bridge (2 arquivos)
5. `packages/grok-computer-bridge/src/bridge.mjs` — endpoints `/boot`, `/status`, `/session/pause`, `/session/resume`
6. `packages/grok-computer-bridge/src/worker.ts` — rotear novos endpoints, métodos no DO

### Fase 4: Frontend (3 arquivos)
7. `packages/workshop-frontend/src/components/chat/ComputerBootConfigModal.tsx` — modal de configuração (novo)
8. `packages/workshop-frontend/src/components/chat/ComputerRunPanel.tsx` — painel de status (novo)
9. `packages/workshop-frontend/src/ChatInterface.tsx` — integrar painel, modal, poll de status, handlers de stream events

### Fase 5: Deployment Config (2 arquivos)
10. `packages/workshop-backend/wrangler.prod.jsonc` — service binding `GROK_COMPUTER_BRIDGE`
11. `packages/grok-computer-bridge/wrangler.jsonc` — vars atualizadas

---

## Considerações Técnicas

### Long-running (24h+)

- O Overseer DO usa `ctx.waitUntil()` para manter o DO vivo durante o turn
- O alarme de keep-alive é estendido para 5 min (em vez de 60s) durante runs do Computer
- O estado do run é persistido em DO storage (SQLite) para resumption após restart
- O `#runComputerAgentTurn()` loop verifica `maxDurationSeconds` (default 86400 = 24h) e `maxLoopIterations` (0 = unlimited)
- O container sobrevive entre prompts (o grok agent stdio é persistente)

### Segurança

- Credenciais são armazenadas no DO storage (encrypted at rest pelo Cloudflare)
- O bridge usa `BRIDGE_API_KEY` para autenticar requests do backend
- O container tem rede pública (necessário para o grok acessar a API da xAI), mas o bridge só aceita requests autenticados
- O boot script é executado como root no container (sandboxed pelo Cloudflare Computer)
- Env vars marcadas como `secret` são mascaradas na UI

### Limitações Conhecidas

- O Cloudflare Computer requer um plano pago (Workers Paid Plan)
- O container tem um cold-start de ~30s na primeira execução
- O filesystem do Computer é SQLite-backed (não é um filesystem real — algumas operações podem ser lentas)
- O grok agent stdio precisa de autenticação (XAI_API_KEY ou auth_provider_command)
- O service binding entre Workers requer que ambos estejam no mesmo account

### Validação

1. **Type check:** `pnpm types:check` — verificar tipos após mudanças no shared API
2. **Build:** `pnpm build` — verificar se o build do workshop-backend e workshop-frontend passam
3. **Lint:** `pnpm lint:check` — verificar linting
4. **Testes manuais:**
   - Configurar um modelo "Grok Computer" no AddModelModal
   - Abrir o boot config modal e adicionar um repo GitHub
   - Enviar um prompt e verificar se o container boota
   - Verificar se o ComputerRunPanel mostra status atualizado
   - Testar pause/resume/stop
   - Testar loop mode (maxLoopIterations > 1)
