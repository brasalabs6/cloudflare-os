# Codex ACP Harness Adapter — SPECS

**Kind:** versioned adapter plus pinned runtime image configuration.  
**Status:** specification; implementation pending.

## Responsibility

Expose Codex through ACP using a pinned codex-acp bridge around Codex App Server. The Workshop kernel and agent-runtime public contract must not depend on Codex App Server message types.

## Launch and authentication

Pin the codex-acp package/binary and the compatible Codex version. Launch only from the allowlisted manifest. Isolate HOME/config per session and disable interactive browser flows in unattended containers unless an explicitly reviewed device/auth flow is used. Before implementation, document which authentication strategy is supported in Cloudflare containers and whether all inference can be routed through trusted egress.

Do not copy credentials from the Hub database or persist long-lived credentials in image layers, container backups, logs or browser storage. If provider-native auth is unavoidable, define scoped credential provisioning, expiration, revocation and session isolation first.

## Protocol mapping

Normalize ACP initialization, session creation, prompt, tool events, permissions, cancellation and shutdown. Model/mode controls appear only when negotiated. Translate Codex-specific errors into the shared error taxonomy while preserving sanitized diagnostic codes.

## Tests and acceptance

Real Cloudflare sandbox tests must cover initialize/new/prompt/events/cancel, file tool permissions, auth failure and expiry, no-browser behavior, reconnect, resource limits, egress policy and secret scans. Codex acceptance is independent from Grok acceptance.
