#!/bin/sh
set -eu
: "${GROK_AGENT_SECRET:?missing internal server secret}"
umask 077
ca=/etc/cloudflare/certs/cloudflare-containers-ca.crt
bundle=/home/node/.grok/ca-bundle.crt
attempt=0
until [ -s "$ca" ]; do
  attempt=$((attempt+1))
  if [ "$attempt" -ge 50 ]; then
    echo "GROK_PROXY_CA_UNAVAILABLE" >&2
    exit 1
  fi
  sleep 0.2
done
cp "$ca" /usr/local/share/ca-certificates/grok-cloudflare.crt
update-ca-certificates >/dev/null 2>&1
cp /etc/ssl/certs/ca-certificates.crt "$bundle"
chown node:node "$bundle"
chmod 0600 "$bundle"
# CLI stdout/stderr can include private tool activity; do not pipe raw transcript
# to Cloudflare container logs.
exec gosu node sh -c 'exec grok --no-auto-update agent --no-leader --model cf-qwen3.8-27b serve --bind 0.0.0.0:2419 >/dev/null 2>&1'
