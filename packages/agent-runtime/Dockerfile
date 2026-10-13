FROM node:24-trixie-slim AS grok-install
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
ARG GROK_VERSION=1.0.50
RUN curl -fsSL https://x.ai/cli/install.sh | bash -s -- "$GROK_VERSION" && test -x /root/.grok/bin/grok

FROM node:24-trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates gosu git bash curl && rm -rf /var/lib/apt/lists/*
COPY --from=grok-install /root/.grok/bin/grok /usr/local/bin/grok
RUN grok --version
RUN install -d -o node -g node -m 0750 /home/node/.grok && install -d -o node -g node -m 0755 /workspace
COPY --chown=node:node config/grok-models.toml /home/node/.grok/config.toml
RUN chmod 0600 /home/node/.grok/config.toml
COPY tools/run-grok.sh /opt/run-grok.sh
RUN chmod 0755 /opt/run-grok.sh
ENV HOME=/home/node
ENV NODE_EXTRA_CA_CERTS=/etc/cloudflare/certs/cloudflare-containers-ca.crt
ENV SSL_CERT_FILE=/home/node/.grok/ca-bundle.crt
ENV CURL_CA_BUNDLE=/home/node/.grok/ca-bundle.crt
ENV NODE_OPTIONS=--use-openssl-ca
EXPOSE 2419
WORKDIR /workspace
CMD ["sh", "/opt/run-grok.sh"]
