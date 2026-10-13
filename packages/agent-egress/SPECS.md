# Agent Egress — SPECS

**Kind:** private WorkerEntrypoint/service-bound module initially; separate Worker deployment when justified.  
**Status:** specification; implementation pending.

## Responsibility

Provide a trusted path from isolated harness processes to explicitly permitted inference/provider endpoints. Credentials and provider routing remain on the trusted side of the boundary. The runtime/container never receives reusable platform proxy credentials.

## Policy

Each request is authorized against the pinned release, session/run, selected model alias, provider allowlist, budget and environment. Default deny. Validate destination host and scheme, reject IP literals unless explicitly approved, block private/link-local/metadata ranges, reject redirects by default, and revalidate any permitted redirect before following. Never use a prompt-supplied URL as the upstream target.

Enforce connect/read/total timeouts, request and response byte caps, concurrency, rate limits and usage ceilings. Avoid forwarding caller-controlled headers to providers. Do not log authorization headers, API keys, raw prompts or full provider responses.

## Credential strategy

Preferred: Worker-side secret binding or existing approved inference proxy. Alternative: short-lived, narrowly scoped provider credential with documented expiration, storage, revocation and audit semantics. Never bake secrets into the image, command line, generated source, environment file shipped to the container or browser bundle.

## Observability

Record release, provider alias, session/run IDs, duration, token/cost estimates where available, status class and policy decision. Sanitize all provider error messages before logging. Usage data is not proof of billing correctness unless reconciled against the provider.

## Tests and acceptance

Positive tests for allowed models; negative tests for unapproved providers, redirect escapes, DNS/host manipulation, metadata access, private IPs, oversized responses, timeout, invalid ticket, cross-session request, quota exhaustion and secret redaction. Test staging/production secrets separately and verify deployment without displaying secret values.
