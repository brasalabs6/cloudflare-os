# ADR 0001: Separate CLI agent runtime from the Workshop kernel

**Status:** Accepted as target architecture; implementation pending  
**Date:** 2026-10-13

## Context

Cloudflare OS already owns users, workspaces, agent orchestration, capability grants and independent Gatekeeper Workers. GrokBot has a sandbox/runtime implementation and Hub has ACP/harness abstractions. Embedding Linux process supervision and harness-specific behavior into the Workshop backend would create a second kernel and couple UI deployments to runtime failures.

## Decision

Create an independently deployable agent-runtime Worker. It routes to a SessionRuntime Durable Object, which owns one logical session and supervises one isolated Cloudflare Container generation. Keep ACP framing in a shared library and harness-specific behavior in adapters. Gatekeepers authorize operations; they do not own processes or session journals.

## Consequences

- Runtime and image releases can be scaled, rolled back and A/B tested independently.
- Workshop kernel changes stay small and typed.
- Session state is authoritative in its DO; any SQL/search projection is secondary.
- Service bindings and authenticated, scoped tickets are preferred to a public unauthenticated runtime API.
- Cross-service contracts, image pinning, migration compatibility and end-to-end testing become explicit work.
