# `@gadgets/backend-utils` Specification

> **Status:** Normative package specification. This file refines the repository-level `SPECS.md` and MUST remain consistent with it.

## 1. Mission

`backend-utils` contains backend-only cross-cutting utilities that are safe to share among the Workshop kernel and Gatekeeper Workers without importing application business logic. It currently owns structured logging, activation-local observability context, and the best-effort bridge to the error-reporting service.

This package MUST remain infrastructure. It MUST NOT become an authority for users, workspaces, approvals, credentials, resources, or provider-specific behavior.

## 2. Public surface

The package exports three subpaths:

- `@gadgets/backend-utils/logger`
- `@gadgets/backend-utils/observability-context`
- `@gadgets/backend-utils/error-reporting`

Consumers SHOULD import the narrowest subpath they need.

### 2.1 Structured logger

The logger contract is structured-data-first. Stable fields such as `component`, `event`, `vendorId`, workspace/account identifiers, and bounded error metadata SHOULD be emitted as fields rather than interpolated into free-form strings.

Package consumers MUST NOT place credentials, access tokens, refresh tokens, raw authorization headers, or unbounded user/provider content into logs.

### 2.2 Observability context

The observability context uses `AsyncLocalStorage` to make request/activation metadata available to nested code.

The context is **activation-local**, not a durable distributed context. Consumers MUST re-establish the appropriate context at every relevant runtime boundary, including:

- public Worker `fetch()`/event handlers;
- RPC entrypoints;
- Durable Object requests after hibernation/restart;
- alarms;
- hook/event delivery;
- queue/scheduled invocations;
- any other independently-entered Worker activation.

Code MUST NOT assume that context automatically crosses RPC, Worker boundaries, persistence, hibernation, or process restart.

### 2.3 Error-reporting bridge

`reportIssue()`-style reporting is best-effort telemetry. If an `ERROR_REPORTER` service binding is present, reports may be forwarded asynchronously; absence or failure of that binding MUST NOT fail the caller's primary operation.

Reports MUST be normalized and bounded before crossing the service boundary. Attribute counts and string lengths MUST stay within the implementation limits, and attributes MUST remain scalar diagnostic metadata.

## 3. Dependency boundary

`backend-utils` may depend on `@gadgets/error-reporting` for the shared event schema. It SHOULD NOT depend on `workshop-backend` or a Gatekeeper implementation.

Provider-specific adapters MAY supply contextual fields to these utilities, but provider semantics remain in the provider package.

## 4. Security requirements

- Logging and telemetry MUST NOT become an authorization decision source.
- Telemetry failures MUST fail open with respect to telemetry only; they MUST NOT bypass or weaken the caller's actual security checks.
- Secrets MUST be redacted/omitted rather than relying on downstream redaction.
- Untrusted error strings and metadata SHOULD be bounded before logging or forwarding.
- Context values MUST be treated as diagnostic labels, not proof of identity or privilege.

## 5. Reliability requirements

- Reporting helpers SHOULD use the current execution context's background lifetime mechanism when available so diagnostics do not delay the primary response.
- Any exception raised by the reporting backend MUST be contained and may itself be logged locally in bounded form.
- Logger APIs MUST remain usable in Workers and Durable Objects without Node-only process assumptions beyond repository runtime compatibility settings.

## 6. Testing contract

Tests SHOULD cover:

- structured field propagation;
- nested observability context behavior;
- context isolation between independent activations/tests;
- missing/failing error-reporting bindings;
- bounds/normalization of diagnostic attributes;
- the invariant that reporting failures do not alter the primary result.

## 7. Compatibility

Exported subpaths and their semantic behavior are compatibility-sensitive because many Workers import them directly. Renaming fields used by log consumers or changing error-event semantics SHOULD be coordinated with `error-reporting` and downstream packages.

## 8. Non-goals / known limits

This package does not provide distributed tracing propagation across Worker/RPC boundaries by itself. It also does not persist observability context. Callers own boundary re-establishment.

## 9. Change checklist

A change is complete when:

- [ ] it remains generic infrastructure;
- [ ] it does not add business authority;
- [ ] secrets/unbounded payloads cannot leak through new logging/reporting paths;
- [ ] boundary/context behavior is explicit and tested;
- [ ] this spec and `error-reporting/SPECS.md` are updated when the shared event contract changes.
