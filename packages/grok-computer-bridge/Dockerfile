# Dockerfile para o Cloudflare Computer que roda o grok-build.
#
# Constrói uma imagem Debian com:
#   - Node.js 22 (para o bridge HTTP server)
#   - grok CLI (instalado via script oficial)
#   - Ferramentas básicas: git, curl, jq, python3
#   - O script bridge.mjs copiado para /opt/bridge/
#
# O Cloudflare Computer sincroniza o /workspace entre o container e o
# Durable Object via FUSE (computerd). O grok opera nesse diretório,
# e o bridge expõe a API HTTP para o cloudflare-os se comunicar.

FROM debian:bookworm-slim

# ─── Dependências do sistema ────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    jq \
    python3 \
    xz-utils \
    fuse \
    libfuse2 \
    && rm -rf /var/lib/apt/lists/*

# ─── Node.js 22 ─────────────────────────────────────────────────────────────
# O bridge HTTP server roda em Node.js. Instalamos a versão LTS.
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

# ─── Grok CLI ───────────────────────────────────────────────────────────────
# Instala o grok-build usando o script oficial.
# Em ambientes sem browser (containers), a autenticação é feita via
# XAI_API_KEY ou auth_provider_command configurado em ~/.grok/config.toml.
RUN curl -fsSL https://x.ai/cli/install.sh | bash

# Verifica a instalação
RUN grok --version

# ─── Bridge HTTP server ────────────────────────────────────────────────────
# Copia o script do bridge para o container.
# O bridge é um servidor HTTP simples (sem deps npm) que gerencia o
# subprocesso `grok agent stdio` e expõe endpoints para o cloudflare-os.
COPY src/bridge.mjs /opt/bridge/bridge.mjs

# ─── Configuração do grok ──────────────────────────────────────────────────
# Cria o diretório de config do grok e um config.toml padrão.
# O cloudflare-os pode injetar configurações via variáveis de ambiente
# ou montando um config.toml personalizado no /workspace/.grok/.
RUN mkdir -p /root/.grok

# Config padrão: always-approve (auto-aprovar tools no modo headless),
# modelo grok-build, sem telemetry.
RUN echo '[cli]\n\
auto_update = false\n\
\n\
[features]\n\
support_permission = false\n\
telemetry = false\n\
\n\
[session]\n\
auto_compact_threshold_percent = 80\n' > /root/.grok/config.toml

# ─── Diretório de trabalho ─────────────────────────────────────────────────
# /workspace é o ponto de montagem do Cloudflare Computer (FUSE).
# O computerd monta o SQLite-backed VFS do Durable Object aqui.
RUN mkdir -p /workspace
WORKDIR /workspace

# ─── Variáveis de ambiente ─────────────────────────────────────────────────
ENV BRIDGE_PORT=8787
ENV GROK_CWD=/workspace
ENV GROK_MODEL=grok-build
# XAI_API_KEY deve ser injetado pelo cloudflare-os ao iniciar o container.
# O grok lê essa variável para autenticação sem browser.
# ENV XAI_API_KEY=...

# ─── Entrypoint ────────────────────────────────────────────────────────────
# Inicia o bridge HTTP server. O computerd (do Cloudflare Computer) já
# terá montado o /workspace antes do entrypoint rodar.
CMD ["node", "/opt/bridge/bridge.mjs"]
