# ZoomInfo Gatekeeper Specification

> **Package:** `@gadgets/zoominfo-gatekeeper`  
> **Status:** Normative package specification. Search/lookup and credit-consuming enrichment have different consequence profiles and MUST remain distinguishable.

## 1. Mission

The ZoomInfo Gatekeeper connects a user's ZoomInfo account and exposes B2B company/contact intelligence, lookup taxonomies, intent/news/scoop data, recommendations, insights and enrichment workflows subject to the user's ZoomInfo entitlements.

The connected resource is whole-account because ZoomInfo does not provide a narrower URL-addressable grant model in this package. Provider package entitlements remain the ultimate external authority.

## 2. Resource model

The package exposes one account-wide resource:

`https://*` — ZoomInfo Account

The canonical connected-account URL is the ZoomInfo application home because there is no per-user public resource URL suitable as a narrower capability identifier.

A whole-account binding is broad. It MUST be presented as such and MUST NOT imply that every feature is entitled: unentitled API families may return provider-denied/empty results and the Gatekeeper MUST normalize those outcomes truthfully.

## 3. OAuth + PKCE

The connector uses Authorization Code OAuth with PKCE. Deployment configuration may override the provider authorize/token/API base URLs for controlled environments.

Connection requirements:

- random fixed-length initiation and OAuth nonce material;
- ten-minute expiry for each nonce stage;
- constant-time comparison for fixed-length nonces;
- PKCE code verifier/challenge generation and binding to the active attempt;
- one-hour bounded cleanup for abandoned first connection;
- access-token refresh with safety before exact expiry;
- reconnect on the same account capability;
- no token/PKCE verifier leakage into browser logs/Gadget data.

## 4. OAuth scopes

The package requests the explicit provider-recognized scope set for its current API families:

- company data;
- contact data;
- intent data;
- news data;
- scoops data;
- recommendations read;
- account-summary read;
- insights read.

The authorization server rejects unknown scope names; the package MUST not fabricate assumed scopes such as generic OpenID/offline scopes or a nonexistent lookup-specific scope.

Lookup/reference-data access is governed by the provider entitlements associated with the actual data scopes.

## 5. Credential and identity handling

All OAuth credentials belong to the account Durable Object.

The package may decode claims from an ID token returned by the trusted token endpoint solely to derive a **friendly display identity**. Such decoding without local signature verification MUST NOT be used as proof for Cloudflare OS authentication or security decisions. Display names/emails extracted this way are presentation metadata only.

## 6. Observation/read workflow

Lookup taxonomies, searches, insights, account summaries, recommendations and returned ZoomInfo records are protected observations. Every method returning such data MUST await `authorizeObservation()` before disclosure.

Dynamic searches/insights are intentionally not broadly cached because they can change and may be consequence/cost sensitive. Reference lookup taxonomies are effectively static and may use the package's bounded account cache; current lookup cache TTL is one day.

Cache entries are not authorization authority and must remain scoped to the connected account/binding.

## 7. Search vs enrichment consequence model

Search and lookup resolve candidates/identifiers and are not semantically equivalent to **enrichment**, which can consume ZoomInfo credits and reveal additional fields.

Credit-consuming enrichment MUST be represented in approval/audit semantics according to its actual consequence. The Gatekeeper MUST NOT hide a credit-consuming provider operation behind a method described merely as a harmless read.

Where enrichment is implemented as an approval-gated action/ticket workflow, it MUST:

1. identify the entity/entities and requested output fields;
2. communicate that provider credits may be consumed;
3. stage/submit the operation before performing the billable provider call;
4. apply only after the corresponding approval decision;
5. deliver resulting enriched data through the observation authorization path;
6. never claim automatic revert for consumed provider credits unless the provider actually supports it.

If a specific provider endpoint has non-consuming semantics, the generated API/JSDoc and action policy must state that explicitly rather than generalizing from other enrichment endpoints.

## 8. Bounded data/field selection

The generated types enumerate supported search criteria, output-field families, lookup filters and enrichment shapes. Requests MUST be bounded so an agent cannot accidentally request arbitrary/unlimited output-field expansions or huge provider pages.

Provider-supplied free text (news, scoops, insights, names/descriptions) is untrusted and SHOULD be bounded before audit/prompt inclusion.

## 9. Configurator

The account configurator is sandboxed and represents the whole-account grant. It may display account metadata through a narrow RPC but MUST never receive OAuth credentials.

Because the resource is `https://*`, UI copy MUST make the broad account scope clear.

## 10. Observer/sharing policy

ZoomInfo account data and enriched records may be licensed/sensitive. A collaborator does not automatically inherit the owner's provider entitlements or right to receive data purchased with the owner's credits.

Observer verification MUST fail closed according to the package's account/resource policy. If equivalent independent authorization cannot be established, the binding should be restricted rather than assuming organization-wide sharing rights.

## 11. Security invariants

- OAuth state/PKCE is replay-resistant and bound to the active account attempt.
- Only provider-recognized scopes are requested.
- Credentials remain account-owned.
- Unsigned decoded ID-token claims are presentation only.
- Every returned provider dataset is observation-authorized.
- Credit-consuming enrichment is never disguised as a consequence-free read.
- Enrichment approval text states credit/cost consequence where applicable.
- Reference caches are bounded/account-scoped and do not bypass authorization.
- Provider text is untrusted and bounded in approval/prompt contexts.

## 12. Build/configuration

Worker entrypoint: `src/zoominfo.ts`. OAuth credentials and optional endpoint overrides are deployment settings. `CLIENT_ID`/`CLIENT_SECRET` MUST be supplied as secrets/dev vars, not committed.

The local dev launcher may inject shared ZoomInfo credentials into generated dev configuration.

## 13. Tests

Tests SHOULD cover:

- nonce/PKCE/reconnect/refresh behavior;
- exact accepted OAuth scope set and invalid-scope regression;
- account-wide resource semantics;
- lookup cache isolation/TTL;
- dynamic read observation authorization;
- credit-consuming enrichment approval-before-call and result observation;
- no-revert truthfulness for consumed credits;
- entitlement-denied/unknown-provider responses;
- bounded field/page requests;
- display-only ID-token claim handling;
- observer policy.

## 14. Change rules

Adding a new ZoomInfo API family requires entitlement/scope verification against the real provider, consequence/cost classification, observation vs action decision, output bounds, generated types and tests. Never guess provider scopes or billing semantics from naming alone.
