# ADR 0003: Trusted egress and credential boundaries

**Status:** Accepted as target architecture; implementation pending  
**Date:** 2026-10-13

## Context

CLI processes need model/provider access, but containers, user prompts and tool output must not gain access to long-lived platform credentials. The GrokBot release gate also shows that control-plane secrets require paired configuration and careful staging/production separation.

## Decision

Use a trusted agent-egress WorkerEntrypoint behind a service binding. It injects credentials only on permitted upstream requests and enforces explicit destination, model and quota policies. Egress is deny-by-default. Redirects, arbitrary user-supplied URLs, metadata endpoints, unapproved providers and unbounded response bodies are rejected.

Secrets are stored as Cloudflare secrets in the environment that uses them; never place them in images, CLI arguments, frontend code, durable event payloads or logs. If a harness requires provider-native credentials rather than the proxy, use a short-lived, scoped credential flow and document the exact revocation/expiry model before enabling it.

## Consequences

- The runtime must not be granted broad access to unrelated application secrets.
- Egress policy requires positive and negative tests, including redirect and DNS/host bypass attempts.
- Usage metrics must be redacted and correlated by session, run and release without logging credentials or raw prompts.
- Production enablement requires a verified secret-pairing checklist, not only a healthy Worker response.
