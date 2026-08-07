// grok-computer-bridge/src/worker.ts
//
// Cloudflare Worker que hospeda um Cloudflare Computer com o grok-build.
// Este Worker:
//   1. Cria um Workspace (Durable Object) com o backend de container
//   2. O container roda o Dockerfile (grok + bridge HTTP server)
//   3. Expõe uma API HTTP que o cloudflare-os backend chama para:
//      - Enviar prompts ao agente grok
//      - Receber respostas em streaming (SSE)
//      - Executar comandos shell no workspace
//      - Resetar a sessão do grok
//
// O Worker atua como proxy entre o cloudflare-os e o bridge dentro do container:
//
//   cloudflare-os (Overseer DO)
//       │  RPC ou HTTP
//       ▼
//   grok-computer-bridge Worker (este arquivo)
//       │  workspace.runtime.exec() ou HTTP para o container
//       ▼
//   Container (Docker)
//   ├── computerd (FUSE mount /workspace)
//   ├── grok agent stdio (ACP)
//   └── bridge.mjs (HTTP :8787)
//
// O bridge dentro do container expõe HTTP na porta 8787. O Worker acessa
// o container via o Computer Workspace API.

import { withWorkspace, getWorkspace } from "@cloudflare/computer";
import { CloudflareContainerBackend } from "@cloudflare/computer/backends/container";
import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";

// ─── Durable Object: GrokComputer ───────────────────────────────────────────
//
// Um Durable Object por agente grok. Mantém:
//   - O Workspace (filesystem SQLite-backed)
//   - O container com grok + bridge
//   - O estado da sessão (URL do bridge, status)

export class GrokComputer extends withWorkspace(
  class extends DurableObject<Env> {},
  (self) => ({
    storage: self.ctx.storage,
    backends: [
      // Container backend: roda o Dockerfile com grok + bridge.
      // O container tem rede pública (para o grok acessar a API da xAI)
      // e o /workspace montado via FUSE (computerd).
      new CloudflareContainerBackend({
        id: "grok-container",
        container: () => self.ctx.container,
        workspace: {
          binding: "GrokComputer",
          id: self.ctx.id.toString(),
        },
        ctx: self.ctx,
      }),
    ],
  }),
) {
  // URL do bridge HTTP dentro do container (atribuído quando o container sobe)
  private bridgeUrl: string | null = null;

  /**
   * Inicializa o container e aguarda o bridge estar pronto.
   * O container roda o Dockerfile que inicia o bridge.mjs na porta 8787.
   */
  async ensureStarted(): Promise<string> {
    if (this.bridgeUrl) return this.bridgeUrl;

    // O container sobe lazy (primeiro exec). Disparamos um exec trivial
    // para forçar o cold-start e então verificamos o health do bridge.
    const ws = await getWorkspace(this.ctx.stub());
    await ws.runtime.exec("echo 'container started'", {
      backend: "grok-container",
    });

    // O container expõe o bridge na porta 8787 internamente.
    // O Computer expõe o container via um URL que o Worker pode acessar.
    // Na implementação atual do Computer, o container é acessível via
    // o container binding do DO.
    //
    // Em uma implementação completa, o URL seria descoberto via o
    // container API do Cloudflare. Por ora, assumimos que o container
    // expõe a porta 8787 e o Worker pode acessá-la.
    this.bridgeUrl = `http://container:8787`;
    return this.bridgeUrl;
  }

  /**
   * Envia um prompt ao grok agent e faz streaming da resposta.
   * O cloudflare-os chama este método via RPC (Cap'n Web) ou HTTP.
   *
   * @param prompt - O texto do prompt do usuário
   * @returns Um ReadableStream de eventos no formato AiChatStreamEvent
   */
  async prompt(prompt: string): Promise<ReadableStream<Uint8Array>> {
    const url = await this.ensureStarted();

    // Faz um POST /prompt para o bridge dentro do container.
    // O bridge inicia o `grok agent stdio`, envia o prompt via ACP,
    // e faz streaming dos eventos transformados via SSE.
    const response = await fetch(`${url}/prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.env.GROK_BRIDGE_API_KEY
          ? { Authorization: `Bearer ${this.env.GROK_BRIDGE_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({ prompt, alwaysApprove: true }),
    });

    if (!response.ok) {
      throw new Error(`Bridge error: ${response.status} ${await response.text()}`);
    }

    // Retorna o stream SSE cru para o caller processar.
    return response.body as ReadableStream<Uint8Array>;
  }

  /**
   * Executa um comando shell diretamente no workspace do Computer
   * (não passa pelo grok — é direto no container).
   *
   * @param command - Comando shell (ex: "ls -la /workspace")
   * @returns { stdout, stderr, exitCode }
   */
  async command(command: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    const url = await this.ensureStarted();

    const response = await fetch(`${url}/command`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.env.GROK_BRIDGE_API_KEY
          ? { Authorization: `Bearer ${this.env.GROK_BRIDGE_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({ command }),
    });

    if (!response.ok) {
      throw new Error(`Bridge error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Reseta a sessão do grok (limpa o contexto da conversa atual).
   */
  async resetSession(): Promise<{ ok: boolean; sessionId: string | null }> {
    const url = await this.ensureStarted();

    const response = await fetch(`${url}/session/reset`, {
      method: "POST",
      headers: {
        ...(this.env.GROK_BRIDGE_API_KEY
          ? { Authorization: `Bearer ${this.env.GROK_BRIDGE_API_KEY}` }
          : {}),
      },
    });

    return response.json();
  }

  /**
   * Health check: verifica se o grok agent está rodando dentro do container.
   */
  async health(): Promise<{
    ok: boolean;
    grokRunning: boolean;
    sessionId: string | null;
    model: string;
    cwd: string;
  }> {
    const url = await this.ensureStarted();

    const response = await fetch(`${url}/health`);
    return response.json();
  }

  /**
   * Applies boot configuration to the Computer container. Writes dotfiles,
   * sets env vars, clones repos, writes credentials, runs the boot script,
   * and restarts the grok agent with the new configuration.
   */
  async boot(config: {
    githubRepos?: Array<{ url: string; branch?: string; path?: string; private?: boolean }>;
    dotfiles?: Array<{ path: string; content: string }>;
    envVars?: Array<{ key: string; value: string }>;
    credentials?: Array<{ type: string; name: string; value: string }>;
    bootScript?: string;
    grokModel?: string;
    autoApprove?: boolean;
  }): Promise<{ ok: boolean; grokSessionId: string }> {
    const url = await this.ensureStarted();
    const response = await fetch(`${url}/boot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.env.GROK_BRIDGE_API_KEY
          ? { Authorization: `Bearer ${this.env.GROK_BRIDGE_API_KEY}` }
          : {}),
      },
      body: JSON.stringify(config),
    });
    return response.json();
  }

  /**
   * Returns detailed status of the bridge and grok agent.
   */
  async status(): Promise<{
    ok: boolean;
    grokRunning: boolean;
    sessionId: string | null;
    model: string;
    cwd: string;
    uptime: number;
    pendingRequests: number;
    eventListeners: number;
  }> {
    const url = await this.ensureStarted();
    const response = await fetch(`${url}/status`);
    return response.json();
  }

  /**
   * Pauses the grok agent (SIGSTOP). The process stays alive but is suspended.
   */
  async pauseSession(): Promise<{ ok: boolean }> {
    const url = await this.ensureStarted();
    const response = await fetch(`${url}/session/pause`, {
      method: "POST",
      headers: {
        ...(this.env.GROK_BRIDGE_API_KEY
          ? { Authorization: `Bearer ${this.env.GROK_BRIDGE_API_KEY}` }
          : {}),
      },
    });
    return response.json();
  }

  /**
   * Resumes a paused grok agent (SIGCONT).
   */
  async resumeSession(): Promise<{ ok: boolean }> {
    const url = await this.ensureStarted();
    const response = await fetch(`${url}/session/resume`, {
      method: "POST",
      headers: {
        ...(this.env.GROK_BRIDGE_API_KEY
          ? { Authorization: `Bearer ${this.env.GROK_BRIDGE_API_KEY}` }
          : {}),
      },
    });
    return response.json();
  }
}

// ─── Worker Entrypoint ──────────────────────────────────────────────────────
//
// O Worker expõe a API HTTP que o cloudflare-os backend chama.
// Ele roteia para o GrokComputer Durable Object apropriado.

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Cria/obtém o DO para o agent name (path param ou header)
    const agentName = url.searchParams.get("agent")
      ?? request.headers.get("X-Grok-Agent")
      ?? "default";

    const doId = env.GROK_COMPUTER.idFromName(agentName);
    const stub = env.GROK_COMPUTER.get(doId);

    // Roteamento HTTP → DO methods
    if (request.method === "GET" && url.pathname === "/health") {
      const result = await stub.health();
      return Response.json(result);
    }

    if (request.method === "POST" && url.pathname === "/prompt") {
      const body = await request.json() as { prompt: string };
      const stream = await stub.prompt(body.prompt);
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    if (request.method === "POST" && url.pathname === "/command") {
      const body = await request.json() as { command: string };
      const result = await stub.command(body.command);
      return Response.json(result);
    }

    if (request.method === "POST" && url.pathname === "/session/reset") {
      const result = await stub.resetSession();
      return Response.json(result);
    }

    // ── Computer boot configuration ────────────────────────────────────────
    // Applies boot config (repos, dotfiles, env vars, credentials, boot script)
    // to the container and restarts the grok agent with the new configuration.
    if (request.method === "POST" && url.pathname === "/boot") {
      const body = await request.json();
      const result = await stub.boot(body);
      return Response.json(result);
    }

    // Returns detailed status of the bridge and grok agent.
    if (request.method === "GET" && url.pathname === "/status") {
      const result = await stub.status();
      return Response.json(result);
    }

    // Pauses the grok agent (SIGSTOP).
    if (request.method === "POST" && url.pathname === "/session/pause") {
      const result = await stub.pauseSession();
      return Response.json(result);
    }

    // Resumes a paused grok agent (SIGCONT).
    if (request.method === "POST" && url.pathname === "/session/resume") {
      const result = await stub.resumeSession();
      return Response.json(result);
    }

    return Response.json({ error: "not found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
