# OpenCode ACP Harness Adapter — SPECS

**Kind:** versioned adapter plus pinned runtime image configuration.  
**Status:** specification; implementation pending.

## Responsibility

Launch the official OpenCode ACP command with an isolated per-session configuration directory and normalize protocol behavior through acp-core.

## Launch and configuration

Pin OpenCode version and immutable image digest. Use the supported opencode acp stdio command. Generate provider/model configuration from validated manifests; do not assume every provider or model is enabled. Isolate config, caches, worktree and credentials between sessions. Provider access must use the approved egress policy or an explicitly reviewed short-lived credential flow.

## Protocol mapping

Negotiate ACP initialize capabilities. Implement session creation, prompt, events, cancellation, permission requests and shutdown where supported. Dynamic model and mode selection must reflect negotiated options. Unsupported features must be disabled and return a typed error instead of silently falling back.

## Tests and acceptance

Run real Cloudflare sandbox tests for initialize/new/prompt/tool events/cancel, file permissions, model/provider allowlisting, config isolation, egress bypass attempts, reconnect and container restart. Record exact tested CLI/adapter versions. Passing a mocked protocol fixture alone is not acceptance.
