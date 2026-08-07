# Home Assistant Gatekeeper Specification

> **Package:** `@gadgets/homeassistant-gatekeeper`  
> **Status:** Normative package specification; inherits the root Gatekeeper security, approval, simulation and observer rules.

## 1. Mission

The Home Assistant Gatekeeper connects a user-controlled Home Assistant instance and exposes capability-scoped access to its areas, labels, devices, entities, dashboards and service operations. The provider credential is a Home Assistant long-lived access token supplied directly by the user rather than an OAuth grant.

Because a long-lived token can carry broad Home Assistant account authority, the Gatekeeper's resource scoping is a critical containment boundary and MUST be enforced server-side.

## 2. Connection model

The browser connection form collects:

- the Home Assistant base URL; and
- a long-lived access token.

The connection URL itself is protected by a random nonce tied to a fresh account Durable Object. The current nonce lifetime is ten minutes. GET verifies the nonce before rendering the credential form; POST validates the form and consumes the connection attempt before storing credentials/completing the account.

The base URL MUST be normalized and subsequently used only by the account/session that owns the corresponding token. Reconnect MUST not allow a stale browser link to replace credentials without a fresh nonce-protected flow.

## 3. Credential ownership

The account Durable Object is the authority for the Home Assistant instance URL and long-lived token.

- Tokens MUST never be returned to Workshop frontend, Gadget code or agents.
- Resource facets receive only the minimum account reference/scope needed to make approved calls.
- Logging/telemetry MUST omit tokens and authorization headers.
- Revocation clears account-side credentials/state even though provider-side token revocation may require user action in Home Assistant.

## 4. Resource model

The Gatekeeper exposes five granularities:

1. whole Home Assistant instance — `https://*` catch-all resource;
2. area — synthetic resource URL under `https://homeassistant.local/_resource/area/:areaId`;
3. label — synthetic resource URL under `https://homeassistant.local/_resource/label/:labelId`;
4. device — synthetic resource URL under `https://homeassistant.local/_resource/device/:deviceId`;
5. entity — synthetic resource URL under `https://homeassistant.local/_resource/entity/:entityId`.

The synthetic URLs are identifiers for Gatekeeper scope, not network destinations. They deliberately avoid colliding with the whole-instance catch-all.

A narrow scope MUST filter/validate every exposed read and action against the selected area/label/device/entity. Holding a token that could access more is not permission to widen the Gadget capability.

## 5. Provider transport

The package uses Home Assistant REST and WebSocket APIs plus registry snapshots where needed.

Provider transport helpers MUST:

- target only the connected Home Assistant instance;
- preserve authentication inside the Gatekeeper;
- normalize provider errors before Gadget exposure;
- bound registry/history/logbook/fan-out operations;
- treat provider-returned names/content as untrusted data.

Any relaxation allowing local/insecure Home Assistant URLs MUST be deliberate deployment/user behavior and MUST NOT accidentally weaken unrelated SSRF protections in the Workshop backend.

## 6. Observation workflow

Entity states, registries, dashboards, history, logbook, services and metadata returned to the Gadget are protected observations.

The session MAY fetch the required Home Assistant data first to build an accurate description, but MUST await `authorizeObservation()` before returning any protected data.

For narrow scopes, the observation description SHOULD identify the concrete area/device/entity/dashboard being observed.

## 7. Action workflow

Service calls, state-affecting controls and dashboard/config changes exposed by the package are approval-gated actions.

The action path MUST:

1. resolve targets inside the bound resource scope;
2. stage the action and its pre-change/revert metadata when applicable;
3. submit the action through `ApprovalQueue`;
4. overlay the pending action on subsequent state/dashboard reads when simulation supports it;
5. call the Home Assistant API only from `applyAction()`;
6. remove/rollback overlay state on reject;
7. execute an automatic inverse only when `canRevert`/the action contract establishes one.

A service action that has no reliable inverse MUST set `implementsRevert: false` rather than inventing one.

## 8. Simulation

Pending entity actions are overlaid on entity state/list reads; pending dashboard modifications are overlaid on dashboard configuration where supported.

Simulation is a local world-model aid only. It MUST NOT emit Home Assistant service calls. The ordering of multiple pending actions on the same entity/config MUST be deterministic and compatible with apply/reject ordering.

## 9. Configurator UI

Instance, area, label, device and entity configurators run in sandboxed iframes and may use narrow account RPCs to enumerate registry options.

A configurator MUST return the canonical scope URL defined above. It MUST not pass the long-lived access token or raw account capability into the iframe.

## 10. Observer/sharing policy

A shared collaborator must not inherit the owner's Home Assistant authority automatically. Observer verification MUST apply the package's declared policy and fail closed when the collaborator cannot be independently authorized for the selected instance/resource.

For resources where independent Home Assistant verification is not possible with the available verifier model, the Gatekeeper MUST restrict sharing instead of assuming access.

## 11. Security invariants

- Connect URLs use random expiring nonce protection.
- The long-lived token never leaves the account boundary.
- The selected base URL cannot be swapped by a stale/replayed link.
- Synthetic resource URLs are scope identifiers and cannot widen to the whole instance.
- Every protected read authorizes before return.
- Every external state change is staged before apply.
- Pending simulation never performs a side effect.
- Provider target resolution is checked against the bound resource on the server.

## 12. Build/configuration

Worker entrypoint: `src/homeassistant.ts`. Multiple configurator bundles are generated through the shared Gatekeeper configurator pipeline.

`BASE_URL` configures this Gatekeeper Worker's public connection URL; it is distinct from each user's Home Assistant instance URL.

## 13. Tests

Tests SHOULD cover:

- nonce expiry/replay and invalid forms;
- Home Assistant base URL/token persistence and reconnect;
- whole/area/label/device/entity anti-widening;
- registry configurators;
- REST/WebSocket failure normalization;
- observation authorization;
- action scope validation and stage/apply/reject/revert;
- simulation overlay ordering;
- observer policy;
- bounded history/registry fan-out.

## 14. Change rules

A new Home Assistant resource granularity or service action requires explicit scope resolution, configurator/type updates, approval/simulation/revert semantics, observer policy and tests. Broadening the authority of an existing synthetic resource is a breaking security change and MUST be treated as such.
