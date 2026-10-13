# Grok Build Harness Adapter — SPECS

**Kind:** versioned adapter plus pinned runtime image configuration.  
**Status:** specification; implementation pending in Cloudflare OS.

## Responsibility

Launch the supported Grok Build CLI ACP stdio process and normalize harness-specific metadata/events into acp-core. Reuse verified GrokBot runtime behavior as evidence and implementation reference, not as a reason to copy the old application architecture or secrets flow.

## Launch contract

Use a pinned CLI version, immutable image digest, explicit working directory and validated configuration schema. The launch command and args come from the reviewed manifest, never from a prompt or untrusted request. Keep provider credentials out of the profile file. If the harness requires TOML configuration, generate it from a validated allowlisted schema and never write proxy secrets to it.

## Protocol

Perform ACP initialize before declaring the session ready. Support session creation, prompt, cancellation, event mapping, tool-call permissions and shutdown where negotiated. Any native WebSocket transport is an optional adapter optimization and must not replace the common stdio ACP contract for the first release.

## Reuse and migration

Review GrokBot PR #1 runtime/session code for generation fencing, terminal, file operations, signed tickets and checkpoint behavior. Port only components compatible with Cloudflare OS service bindings, Gatekeeper authorization and current Sandbox APIs. Do not port a public bridge with bypassed authentication, embedded control-plane credentials or unrestricted egress.

## Tests and acceptance

Run real sandbox tests for initialize, new session, prompt, tool event, filesystem write, cancellation, permission round-trip, terminal, reload/replay and checkpoint restore. Document the exact tested image/CLI versions and mark staging evidence separately from production.
