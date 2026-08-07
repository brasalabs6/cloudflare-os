# Cloudflare OS — System Specification

> **Status:** Normative source of truth for the repository.
>
> This document defines the architecture, cross-package contracts, invariants, security model, runtime workflows, and change policy of Cloudflare OS. Package-level `packages/*/SPECS.md` files refine this specification for their package. A package spec MUST NOT contradict this file.

## 1. Authority and precedence

Cloudflare OS uses the following order of authority for intended behavior:

1. `SPECS.md` at the repository root — system-wide invariants and architecture.
2. `packages/<name>/SPECS.md` — package contracts and package-specific requirements.
3. Public TypeScript contracts in `@gadgets/workshop-shared`, package exports, Worker entrypoints, and generated `.d.ts` surfaces — executable interface definitions.
4. Tests — executable examples and regression constraints.
5. Implementation details — may change freely only when the contracts above remain satisfied.
6. README files — explanatory/operator documentation; they are not allowed to silently redefine a contract.

A behavior-changing pull request MUST update the affected spec in the same change. If code and a spec disagree, the disagreement is a defect: either restore the code to the documented contract or deliberately revise the spec and all affected consumers/tests.

Normative keywords **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** have their RFC-style meanings.

## 2. Product model

Cloudflare OS is an AI productivity operating system built on Cloudflare Workers. Its core abstraction is a **workspace** managed by a durable kernel. A workspace can contain one or more **Gadgets**, external-service **Gatekeepers**, AI chat/agent threads, approvals, hooks, collaborators, and blueprint-derived outputs.

The OS analogy used by the repository is architectural, not cosmetic:

- **Kernel:** `packages/workshop-backend`.
- **Shell / first-party UI:** `packages/workshop-frontend`.
- **Public origin/router:** `packages/router`.
- **Device/capability drivers:** `packages/gatekeeper-*`.
- **Shared ABI/contracts:** `packages/workshop-shared`.
- **Processes:** sandboxed Gadgets hosted as dynamic Workers/facets.
- **Executables/templates:** Blueprints.
- **Capability configuration UIs:** `packages/configurator-ui` plus gatekeeper-generated iframe bundles.
- **Persistence helpers:** `packages/typed-storage`.
- **MCP protocol substrate:** `packages/mcp-shared`.
- **System verification:** `packages/integration-tests` and package-local tests.

The system MUST preserve this separation. External-service credentials and privileged account capabilities MUST NOT be passed directly to Gadgets or agents.

## 3. Workspace/package topology

The pnpm workspace is `packages/*`. The current package set is:

### Core runtime and UI

- `workshop-backend` — durable kernel, RPC API, users, workspaces, agents, sharing, approvals, blueprints, admin and billing coordination.
- `workshop-frontend` — React shell, routing, authentication UX, WebSocket RPC lifecycle and management UI.
- `router` — public-origin routing to backend, gatekeepers, frontend assets and Email ingress.
- `workshop-shared` — cross-runtime TypeScript/RPC contracts and global limits/helpers.

### Shared infrastructure

- `backend-utils` — structured logging, observability context and non-fatal error reporting bridge.
- `error-reporting` — vendor-neutral bounded error event schema and frontend event normalization.
- `typed-storage` — typed synchronous Durable Object storage abstraction with collections, indexes and singletons.
- `configurator-ui` — sandboxed resource-configurator module contract and runtime-provided UI primitives.
- `mcp-shared` — shared MCP connection, OAuth, scoping, tool classification, sessions, action storage and generated types.
- `integration-tests` — reusable real-Worker test harness.

### Gatekeepers

- `gatekeeper-cloudflare`
- `gatekeeper-confluence`
- `gatekeeper-context`
- `gatekeeper-email`
- `gatekeeper-github`
- `gatekeeper-google`
- `gatekeeper-homeassistant`
- `gatekeeper-linear`
- `gatekeeper-mcp`
- `gatekeeper-mcp-portal`
- `gatekeeper-notion`
- `gatekeeper-scheduler`
- `gatekeeper-slack`
- `gatekeeper-spotify`
- `gatekeeper-supabase`
- `gatekeeper-zoominfo`

No package may introduce a second, conflicting definition of a shared system contract that belongs in `workshop-shared`.

## 4. Core runtime architecture

### 4.1 Durable kernel

`workshop-backend` is the authority for users and workspaces. Important durable boundaries include:

- `UserDurableObject` — per-user identity, sessions, connected accounts, model preferences, workspace index, blueprint/library state, output index and optional billing counters/state.
- `OverseerDurableObject` — per-workspace authority for workpieces, Gadgets, bindings, chats, code state, approvals, hooks, sharing and execution coordination.
- `AdminSettings` — deployment-level mutable configuration.
- `PendingLogin` — short-lived rendezvous for gatekeeper-backed sign-in.

Workspace workpieces share one sequential ID namespace. Gadget IDs and Gatekeeper IDs MUST NOT collide. Binding edges live on the Gadget/workspace relationship, not as global mutable metadata on a Gatekeeper.

### 4.2 Gadget isolation

A Gadget is untrusted workload code. The design MUST preserve these properties:

- Server-side Gadget code runs in a dynamically-created Worker/facet scoped to its workspace.
- Gadget code has no ambient internet or external-service authority. External access is introduced only through explicit bindings/capabilities.
- Client-side Gadget UI runs in a sandboxed iframe and communicates through explicit RPC/message channels.
- A Gadget MUST NOT receive OAuth refresh tokens, provider secrets, raw Gatekeeper account objects or deployment admin capabilities.
- A capability available in `env.NAME` MUST correspond to an explicit workspace/chat binding or a deliberately-provisioned ambient capability.

### 4.3 Frontend/backend RPC

The public Workshop API is Cap'n Web RPC over a WebSocket at `/api`.

- `PublicApi` covers unauthenticated/deployment discovery, login/signup, gatekeeper-backed sign-in and public blueprints.
- Successful authentication returns an `AuthenticatedApi` capability rather than exposing privileged HTTP endpoints.
- Long-lived workspace/Gadget capabilities are reached through RPC stubs.
- If a critical Durable Object connection breaks, the backend MAY close the WebSocket to force the frontend reconnect path; the frontend MUST recover by replacing the RPC session with bounded exponential backoff.
- Browser code MUST treat a new socket as unproven until a real RPC succeeds.

### 4.4 Router

Routing configuration is the installed binding set. The router MUST discover Gatekeepers from environment bindings named `GATEKEEPER_*`.

Path routing precedence:

1. `/gatekeeper/<binding-suffix>` and descendants → matching Gatekeeper Worker.
2. `/api`, `/api/*`, `/blueprint-screenshot`, `/blueprint-screenshot/*` → Workshop backend.
3. Remaining paths → static frontend assets when `ASSETS` exists.
4. Dev fallback without assets → backend.

Inbound Email MUST be forwarded only to `GATEKEEPER_EMAIL`; if that binding is absent, the message is rejected.

Adding a Gatekeeper SHOULD require deployment wiring/binding changes, not edits to a hard-coded router registry.

## 5. Gatekeeper capability model

Gatekeepers are the security boundary around external systems. They consist conceptually of:

1. **Vendor (`GatekeeperVendor`)** — describes a connector, starts connection or auto-provisioning, advertises supported resource types and TypeScript declarations.
2. **Connected account (`GatekeeperUser`)** — privileged per-human account capability holding or reaching credentials; only the Workshop may hold it directly.
3. **Resource Gatekeeper (`Gatekeeper<Session>`)** — workspace/facet-scoped capability for one resource or ambient singleton.
4. **Session** — narrow Gadget-facing RPC surface.
5. **Verifier (`GatekeeperUserVerifier`)** — capability used to prove an observer independently has required access.
6. Optional **Resource Configurator**, **Management App**, **Agent Catalog**, **Slash Commands**, and **Hooks**.

### 5.1 No ambient authority

A new Gadget/agent MUST have no external authority by default. Every external resource MUST be introduced through an explicit Gatekeeper binding or an admin/user-controlled ambient account policy.

### 5.2 Resource selection

`resolveRequestedResource()` in `workshop-shared/gatekeeper` is the single source of truth for resolving an agent-requested resource:

1. matching non-catch-all URL pattern;
2. `https://*` whole-instance fallback;
3. the only supported resource when exactly one exists;
4. otherwise fail with an actionable error.

Frontend and backend MUST NOT implement divergent selection precedence.

### 5.3 Connection security

Interactive `connectAccount()` and `reconnect()` flows MUST use cryptographically-random, single-use, time-bounded nonces and MUST verify them before accepting the browser flow. OAuth `state`/PKCE or equivalent provider protection MUST be used where applicable.

- Credential secrets MUST live inside the Gatekeeper's account Durable Object or deployment secret binding.
- Gatekeeper account objects MUST serialize refresh/revoke operations when provider rotation semantics make concurrency unsafe.
- OAuth access-token cache expiry MUST include a safety skew.
- A failed/abandoned first connection SHOULD self-clean with a bounded alarm.
- Auth-only sign-in grants MUST be transient unless a connector contract explicitly makes the sign-in grant persistent (Cloudflare billing is the intentional special case).
- `getAuthenticatedEmail()` MUST return only provider-verified identity suitable as an account key.

### 5.4 Observations

Every operation that returns protected external data to a Gadget is an **observation**.

The Gatekeeper MUST call `ObservationAuthorizer.authorizeObservation()` for every observation and MUST await it before returning protected data. It MAY fetch read-only remote data first in order to produce an accurate audit description, but authorization MUST happen before disclosure to the Gadget.

A Gatekeeper MUST fail closed when observer authorization cannot be proven.

`ObservationDescription.prohibitAllSharing` is a strong policy signal: once such data is observed, sharing is prohibited and the workspace enters the restricted behavior enforced by the Overseer.

### 5.5 Actions and human approval

Every operation with side effects is an **action**.

A Gatekeeper MUST:

1. allocate/store an action record;
2. submit it through `ApprovalQueue.submitAction()` with a complete human-readable `ActionDescription`;
3. return/simulate according to its package contract;
4. perform the external side effect only when `Gatekeeper.applyAction(actionId)` is invoked;
5. clean staged state on rejection;
6. implement `revertAction()` when a reliable inverse exists, or truthfully declare that no automatic revert is available.

There is **no mode in which a Gatekeeper may skip submission merely because an action is considered safe or auto-approvable**.

Auto-approval in the kernel requires both:

- the Gatekeeper marks the action `autoApprovable: true` and gives a stable `actionKind`; and
- the user has enabled an auto-approval rule for that Gatekeeper/action kind.

Auto-approval MUST drain actions in ascending action-ID order and MUST stop at the first manual gate or apply failure. It MUST NOT skip ahead.

### 5.6 Simulation

Gatekeepers that support optimistic simulation SHOULD overlay pending staged actions on subsequent reads so an agent can reason about its own proposed changes without waiting hours/days for human approval.

When simulation is not implemented, `ActionDescription.awaitDecision` SHOULD be true so the agent does not continue under a false world model.

Simulation MUST never itself perform the external side effect.

### 5.7 Hooks

Persistent hooks use `ApprovalQueue.bindHook()`.

- Registering a hook is an approval-controlled capability operation.
- Gatekeepers SHOULD encode all pre-enable configuration in a `HookController` capability/props.
- They MUST avoid durable external registration/state until `controller.enable()` is called.
- Event delivery starts a fresh hook session through `HookInitiator`, obtains the session-bound callback and approval/observation capability, authorizes the event observation, then invokes the callback.
- `disable()` MUST remove durable delivery state.

### 5.8 Observer/sharing verification

Workspace collaboration does not automatically imply external-resource access. Before a non-owner can observe data, the Gatekeeper policy MUST either:

- verify the observer has independent access through a `GatekeeperUserVerifier`; or
- explicitly reject observers for that connector/resource.

MCP connectors are intentionally owner-only because they cannot prove per-record authorization.

## 6. Sharing model

Workspace sharing is a permission graph managed by the Overseer.

- Roles are ordered: `build` > `use`.
- Effective access is computed from live reachability from the owner, not merely record existence.
- Share keys are random bearer secrets; only an HMAC-SHA-256-derived identifier is persisted.
- Revocation is intentionally lazy: edges/records may remain, but an unreachable collaborator MUST be denied on every `open()`.
- Revoked share links MUST not grant reachability.
- A user MUST NOT grant a role higher than their own effective role.
- `prohibitAllSharing` is a higher-level policy enforced by the Overseer and applies beyond the sharing table itself.

## 7. Agent and chat execution model

AI chat is durable workspace state coordinated by the Overseer.

- A chat has a frozen seed binding layer at creation; subsequent binding changes are reconstructed by replaying durable change messages.
- Agent code-mode runs with an explicit `env` containing only resolved workpiece/value bindings.
- Binding names MUST pass the shared identifier validator and MUST be protected from JavaScript reserved names/prototype-pollution hazards.
- Gadget creations, binding additions and code edits made by an agent can be provisional to a chat until the user accepts the corresponding change batch.
- The chat log is the authoritative history for proposed/accepted changes; materialized pending registry rows exist to make previews functional and MUST remain reconcilable with the log.
- Agent callback/hook values are transient capabilities and MUST not be treated as ordinary persistable secrets.
- Model-facing assistant state may be stored server-side for faithful replay/compaction, but private model metadata MUST NOT leak to clients.
- Chat compaction checkpoints are immutable replay accelerators, not a replacement source of truth for pending registry state.

## 8. Blueprints and outputs

Blueprints are portable descriptions/content for constructing Gadgets/workspaces.

- Blueprint metadata/content storage is split between metadata-oriented KV and content-oriented R2 in the backend deployment.
- Package/runtime code MUST sanitize/validate blueprint metadata before exposing or instantiating it.
- Binding assignments from a blueprint MUST resolve through explicit user/account/model selection; a blueprint cannot smuggle privileged live capabilities.
- Output format metadata is descriptive and does not grant authority.
- Screenshot/media endpoints MUST set bounded known content types and immutable caching only for immutable content keys.

## 9. Ambient accounts and management apps

Gatekeepers with `VendorDescription.autoProvisionsAccount` use deployment policy with three modes:

- `disabled` — unavailable/dormant; do not provision.
- `optional` — user opt-in; **default**.
- `enabled` — force-provision for all users and make non-removable through normal connector UX.

The provisioning policy helpers in `workshop-backend` are the system chokepoint; packages MUST NOT invent independent ambient defaults.

A connected account may advertise `providesUi`; such management UIs run as sandboxed `GatekeeperUiFrame`s. Admin status is passed fresh at each open and MUST not be cached as durable authority in a client iframe.

## 10. Sandboxed configuration/UI contract

Gatekeeper configurators and management apps are complete HTML documents hosted in `sandbox="allow-scripts"` iframes and receive only a narrow RPC capability.

Configurator state is iframe-owned. `@gadgets/configurator-ui` defines the module ABI:

- `initial`
- optional `initialValuesFromResourceUrl()`
- optional `isReady()`
- `resourceUrl()`
- synchronous `render()` using runtime-supplied primitives

`CheckboxList` encodes selected values as comma-separated strings; option values MUST NOT contain commas unless safely encoded first.

Workshop/server code SHOULD NOT import the configurator package because its ambient JSX contract is intended for sandboxed configurator bundles.

## 11. Persistence model

Durable Object persistence is the primary source of mutable runtime state.

`@gadgets/typed-storage` provides typed collections, unique/non-unique indexes, singletons, synchronous transactions and subscribers over `DurableObjectStorage.kv`.

Current contract limitations:

- typed-storage does **not** currently provide schema versions or automatic migrations;
- callers remain responsible for application-level migrations/backward-compatible reads;
- persistence changes MUST account for old stored rows and partially-completed operations;
- state machines that cross awaits MUST prevent duplicate or stale completion (generation numbers, claimed states, single-flight guards, etc.).

## 12. Observability and error reporting

Backend logs SHOULD be structured and carry stable component/event metadata.

`backend-utils` AsyncLocalStorage context is request/activation-local. It MUST be re-established at RPC, alarm, hook, queue or restart boundaries; context is not assumed to cross them automatically.

Error reporting is best-effort and MUST NOT break the primary request. Browser error telemetry is untrusted diagnostic input and MUST NOT become authorization or business logic.

Error payloads MUST remain bounded and normalized before crossing service boundaries.

## 13. Security invariants

The following are repository-wide MUSTs:

1. **Least authority:** no credential or external privilege without explicit capability introduction.
2. **Fail closed:** authorization/verifier uncertainty blocks disclosure or privileged action.
3. **No action-before-approval:** external writes only from `applyAction()` or equivalent approved hook activation.
4. **No credential leakage:** refresh tokens/secrets stay inside their Gatekeeper account or deployment secret scope.
5. **No cross-origin privileged API:** deployments using Cloudflare Access require same-origin API requests and a valid Access JWT.
6. **SSRF protection:** production backend keeps `global_fetch_strictly_public`; code that fetches arbitrary URLs MUST preserve private-network protections and package-specific URL validation.
7. **Nonce/replay protection:** browser connection flows use random, expiring, single-use nonce/state.
8. **Bound untrusted metadata:** provider/tool descriptions shown in approval UI are escaped/quoted/truncated so external text cannot forge trusted approval prose.
9. **Stable action identity:** policy keys use stable machine-readable action tags, separate from labels.
10. **Observer isolation:** sharing a workspace cannot bypass source-system authorization.
11. **Prototype-safe bindings:** agent/Gadget binding identifiers pass the shared validator.
12. **Idempotent ingress:** at-least-once external delivery paths MUST expose/use stable message keys and make duplicate handling safe.

## 14. MCP-specific global rules

MCP connectors share implementation in `mcp-shared` and MUST keep policy centralized there.

- Tool `readOnlyHint === true` classifies a call as a read; missing/false means action.
- A user-supplied BYO endpoint MAY use `readOnlyHint` for read-vs-action classification, but its annotations MUST NOT grant auto-approval.
- Auto-approvable MCP writes require a deployment-vetted server plus `destructiveHint === false` and `idempotentHint === true`.
- MCP bindings are owner-only unless a future verifiable sharing policy is explicitly designed and specified.
- Tool catalogs and generated types MUST be bounded.
- An MCP endpoint account owns all credentials and pins endpoint identity across reconnects, except controlled deployment portal repointing that invalidates old generations/facets safely.
- Tool-call results produced asynchronously after approval become observations when later delivered to the Gadget.

## 15. Build, development and deployment workflow

The repository uses pnpm workspaces.

Root expectations:

- `pnpm build` recursively builds packages.
- `pnpm test` runs root script tests plus recursive package tests.
- `pnpm dev-client` runs the Vite Workshop frontend.
- `pnpm dev-server` generates dev Wrangler configs and starts all discovered Workers.
- `pnpm run-local` is the local integrated mode with a built frontend.

`run-dev-server.js` MUST continue to discover `packages/gatekeeper-*` packages that contain `wrangler.jsonc`, generate their UIs before Worker bundling, wire `GATEKEEPER_*` service bindings, and pass deployment-only variables without requiring tracked secrets.

Gatekeeper OAuth client secrets MUST NOT be committed to `wrangler.jsonc`; they come from secrets/dev environment.

Generated files under `src/generated` are build outputs. Their source module/configurator code is authoritative.

## 16. Test contract

A behavior change is incomplete until relevant tests are updated/added.

Minimum expectations:

- Shared contract/helpers: focused unit tests.
- Durable state transitions: tests covering retries/interleaving/restarts where applicable.
- Gatekeeper observations/actions: tests proving observation authorization and delayed action application.
- OAuth/connect flows: invalid/expired/replayed nonce cases.
- Resource scoping: broad and narrow URL cases plus invalid resources.
- Sharing: permission graph and revocation behavior.
- Router: dynamic gatekeeper routing and API/assets precedence.
- Cross-package Gatekeeper changes: use `@gadgets/integration-tests` to boot the real Workshop backend plus real/fixture Gatekeepers where practical.

Docs-only changes do not require runtime test execution, but MUST be checked against current public source/contracts.

## 17. Compatibility and evolution

Changes to these surfaces are compatibility-sensitive:

- `workshop-shared` exported RPC/types and constants;
- Gatekeeper resource URL patterns;
- generated Gadget-facing `.d.ts` APIs;
- action-kind tags and semantics;
- Durable Object storage keys/record shapes;
- binding-name conventions (`GATEKEEPER_*`, Gadget env names);
- public routes (`/api`, `/gatekeeper/*`, blueprint screenshot paths);
- external message idempotency keys;
- blueprint archive/schema formats.

A breaking change MUST include migration/compatibility handling or an explicit coordinated version transition. Never silently reinterpret persisted state or a previously-issued capability URL.

## 18. Package dependency rules

- `workshop-shared` MUST remain runtime-neutral enough to be consumed by backend, frontend and Gatekeepers without importing privileged kernel implementation.
- Gatekeepers SHOULD depend on `workshop-shared` contracts and shared infrastructure, not on `workshop-backend` internals.
- `mcp-shared` owns MCP policy/common transport; the two MCP Gatekeepers add connector-specific endpoint/provisioning behavior.
- `backend-utils` and `error-reporting` MUST remain best-effort infrastructure and MUST NOT acquire business authority.
- `configurator-ui` MUST remain a narrow sandbox ABI.
- `typed-storage` MUST remain storage infrastructure; application-specific schema semantics belong to consuming packages.
- `integration-tests` may know how to boot packages but MUST NOT become a production dependency.

## 19. Definition of done for architectural changes

A change touching architecture is complete only when all applicable items are true:

- [ ] Root and affected package specs remain accurate.
- [ ] Public types/RPC declarations match documented behavior.
- [ ] Security checks live at the authoritative boundary, not only in UI.
- [ ] Persisted-state compatibility is handled.
- [ ] Observation/action/hook semantics are preserved.
- [ ] Credentials remain encapsulated.
- [ ] Resource URL patterns and OAuth scopes are least-privilege and tested.
- [ ] Concurrency/retry/idempotency behavior is explicit.
- [ ] Generated artifacts are regenerated from source when needed.
- [ ] Unit/integration tests cover the new contract.
- [ ] New packages are added to this topology and receive their own `SPECS.md`.

## 20. Package specifications

Every package under `packages/` MUST contain a `SPECS.md`. Those documents describe the package mission, ownership boundary, exported surface, state, workflows, security requirements, configuration, tests, known limitations and change rules. When a new package is created, its spec is part of the package's minimum viable implementation.
