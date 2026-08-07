// Tipo do ambiente do Worker. Os bindings são declarados no wrangler.jsonc.

interface Env {
  // Durable Object namespace para o GrokComputer (um por agente).
  // Tipado com a classe GrokComputer para que getContainer() retorne
  // um stub com os métodos corretos.
  GROK_COMPUTER: DurableObjectNamespace<GrokComputer>;

  // Worker Loader binding — necessário para o Computer Workspace.
  LOADER: WorkerLoader;

  // Chave de API do bridge (opcional — para autenticar requests).
  GROK_BRIDGE_API_KEY: string;

  // Chave de API da xAI (secret — injetada via `wrangler secret put`).
  // O grok lê essa variável para autenticação sem browser.
  XAI_API_KEY: string;

  // Modelo do grok a usar (default: "grok-build").
  GROK_MODEL: string;
}
