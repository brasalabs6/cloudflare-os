# ADR 0002: ACP as the common harness protocol

**Status:** Accepted as target architecture; implementation pending  
**Date:** 2026-10-13

## Context

Grok Build, Codex and OpenCode have different launch commands, configuration and authentication behavior. Hub already contains an ACP client manager and harness catalog, but its Codex path primarily uses Codex App Server. ACP supports a shared protocol boundary without making the Workshop kernel understand each CLI.

## Decision

Use ACP JSON-RPC over stdio as the default process-level protocol, supervised inside the sandbox. Add adapters for:
- Grok Build using a pinned CLI version and its supported ACP stdio command.
- Codex using a pinned codex-acp bridge around Codex App Server.
- OpenCode using a pinned opencode acp command.

A sidecar or private bridge may transport framed messages between the sandbox and the runtime Worker, but this is an internal transport and must not be described as ACP-over-WebSocket. The browser transport is a separate authenticated API.

Capabilities such as session/load, model selection, mode changes and permission extensions are available only when negotiated by the live initialize handshake. The registry records compatibility expectations but cannot override the effective protocol capabilities.

## Consequences

- The three harnesses share lifecycle, event, permission and cancellation handling.
- Adapter versions and CLI image digests must be pinned.
- Codex authentication and inference routing require an explicit security review before deployment.
- A passing Grok smoke test does not establish Codex or OpenCode compatibility.
