# Confluence Gatekeeper Specification

> **Package:** `@gadgets/confluence-gatekeeper`  
> **Status:** Normative package specification; inherits all root Gatekeeper approval, observation, credential and sharing rules.

## 1. Mission and resource boundary

The Confluence Gatekeeper gives Gadgets capability-scoped access to Atlassian Confluence while retaining OAuth credentials and provider authority inside the Gatekeeper Worker.

It supports three resource granularities:

- **Site:** `https://*.atlassian.net/wiki`
- **Space:** a specific Confluence space under a site
- **Page / blog post:** a specific content item under a site

A narrower resource MUST NOT silently behave as site-wide access. Resource configurators and URL parsing are part of the security boundary because they determine the facet scope.

## 2. Responsibilities

The package owns:

- OAuth connection and rotating refresh-token lifecycle;
- discovery/selection of Atlassian sites and Confluence resources;
- Confluence REST API normalization;
- Gadget-facing session types;
- observation authorization;
- staging, simulation, application, rejection and reversion of supported mutations;
- bounded caching of provider reads;
- independent observer verification for shareable resources;
- sandboxed resource configurator UI.

## 3. Connection workflow

A first connection creates an account Durable Object, stores the Workshop callback and an expiring random nonce, then performs OAuth. Initiation and OAuth nonces are currently ten-minute, single-use values. Incomplete first connections are bounded by a one-hour cleanup window.

The account object MUST be the sole owner of access/refresh credentials. Rotating refresh-token updates MUST be serialized so two concurrent refreshes/reconnects cannot consume the same rotating token and corrupt the account.

Access tokens MUST be refreshed with a safety skew before exact expiry. Reconnect keeps the same account capability while replacing credentials and notifying the Workshop via `credentialsRestored()`.

## 4. Session/observation contract

Every method that returns protected Confluence data is an observation. The implementation MUST call the session `ApprovalQueue`/`ObservationAuthorizer` and await authorization before returning data to the Gadget.

Read-only provider calls MAY happen before authorization when required to describe the exact observation, but provider data MUST not cross the Gadget boundary until authorization succeeds.

Pagination and provider fan-out MUST stay bounded. Attachment/content extraction MUST apply package limits; the current attachment body limit used by the Gatekeeper is 16 KiB for bounded agent-facing handling unless a more explicit streaming contract is added.

## 5. Action workflow

Mutations MUST use the standard Gatekeeper state machine:

1. validate the requested resource and arguments;
2. stage an immutable-enough action record with a sequential ID;
3. submit a complete `ActionDescription`;
4. expose the proposed state through simulation where supported;
5. wait for the Overseer to call `applyAction()` before sending the external write;
6. on rejection, discard/roll back staged simulation state;
7. on revert, perform the provider-side inverse when the package truthfully advertises it.

Action descriptions MUST include the target site/space/page and the meaningful proposed change. Provider/user-controlled text included in the description MUST be safely bounded.

## 6. Simulation and cache coherence

The Gatekeeper maintains short-lived Durable Object caches for Confluence reads and overlays pending actions so a Gadget can see its own proposed changes.

Simulation MUST be deterministic relative to the staged action sequence and MUST NOT produce the external side effect. Applying/reverting an action MUST invalidate or advance affected caches so subsequent reads do not indefinitely expose stale state.

Known provider/list simulation limitations MUST be documented in the generated Gadget-facing type/JSDoc when exact list reconstruction is not possible.

## 7. Observer/sharing policy

A collaborator is not authorized merely because the owner is. `addObserver()` / verifier logic MUST independently determine whether the observer has access to the relevant Confluence site/space/content.

Restricted spaces/pages MUST fail closed. If the Gatekeeper cannot establish that the observer is authorized for data that has been or will be observed, it MUST reject observer access or exclude the observer through the shared observation policy.

## 8. Resource configurators

Configurator UIs are compiled from source and run in sandboxed iframes. They may use a narrow RPC capability to list/resolve sites, spaces and pages. The concrete URL returned by each configurator MUST map unambiguously to the corresponding `SupportedResource` and MUST not widen scope.

Generated configurator HTML is derived output; the source configurator and this spec are authoritative.

## 9. Security invariants

- OAuth nonces/state are random, expiring and single use.
- Credentials never leave the account capability boundary.
- Rotating-token refresh/revoke/reconnect operations are serialized.
- Every protected read is observation-authorized before disclosure.
- Every side effect is submitted before application.
- Narrow URL resources do not acquire site-wide authority.
- Observer access is independently verified.
- Provider payloads and attachments are bounded before being surfaced to agents or approval UI.

## 10. Build and configuration

Worker entrypoint: `src/confluence.ts`.

Configurator bundles are built through the repository's Gatekeeper configurator builder. OAuth `CLIENT_ID`/`CLIENT_SECRET` are deployment secrets/dev vars; the root dev launcher may map shared Confluence credentials into generated Wrangler config. Secrets MUST NOT be committed.

## 11. Tests

Required coverage SHOULD include:

- nonce expiry/replay and OAuth reconnect;
- rotating refresh concurrency;
- site/space/page URL matching and anti-widening;
- configurator URL generation;
- observation authorization on every read path;
- action stage/simulate/apply/reject/revert;
- cache invalidation after writes;
- restricted-resource observer verification;
- pagination/attachment bounds.

Cross-package behavior SHOULD use `@gadgets/integration-tests` where practical.

## 12. Change rules

Adding a new Confluence resource type or mutation requires, in the same change: `SupportedResource` definition, concrete URL/scoping logic, OAuth-scope review, configurator support if user-selectable, Gadget TypeScript API, observation/action policy, observer semantics, tests and this spec update.
