# GitHub Gatekeeper Specification

> **Package:** `@gadgets/github-gatekeeper`  
> **Status:** Normative package specification; inherits all root Gatekeeper security, approval and observer rules.

## 1. Mission

The GitHub Gatekeeper exposes capability-scoped repository, issue and pull-request access while keeping GitHub OAuth credentials inside the Gatekeeper account boundary. It supports both Cloudflare OS sign-in through a verified GitHub email and Gadget-facing GitHub workflows.

## 2. Resource model

Supported resource granularities are:

- repository: `https://github.com/:owner/:repo`;
- issue: `https://github.com/:owner/:repo/issues/:number`;
- pull request: `https://github.com/:owner/:repo/pull/:number`.

A repository grant may encompass repository-level session operations. Issue/PR grants MUST stay confined to the selected resource and the minimum surrounding metadata needed to operate on it.

URL canonicalization MUST prevent malformed numbers/owners/repos or path tricks from widening a narrow grant.

## 3. OAuth and identity

The Gatekeeper uses a nonce-protected OAuth flow. Initiation and OAuth state are expiring, single-use random values; current flows use ten-minute nonce windows.

Connection tiers:

- `auth`: minimum identity scopes required to resolve a primary verified email and user identity;
- `full`: the GitHub capability scopes required by the resource/session API, including private repository access where authorized by the user.

Current full-scope behavior includes repository authority plus user/email identity scopes. Any future reduction/granularization of scopes is preferred when it preserves the resource API.

`getAuthenticatedEmail()` MUST use a GitHub email that is both primary and verified (or an equivalent provider-verified rule). An arbitrary profile/public email MUST NOT be used as a login key.

## 4. Credential lifecycle

The account Durable Object owns tokens, callback and reconnect state. Credentials MUST never be copied into Workshop user storage or Gadget state.

Reconnect MUST replace credentials on the existing account capability and notify `credentialsRestored()`. Revocation/authorization failure MUST notify expiry and fail provider operations rather than silently using invalid authority.

## 5. Observation contract

Repository/issue/PR reads, comments, diffs, review data, metadata, users, labels and other provider data are protected observations.

Every read path MUST await `authorizeObservation()` before data reaches the Gadget. Pagination and discussion/diff retrieval MUST remain bounded so an agent request cannot accidentally fan out across an unbounded repository history.

## 6. Action model

GitHub mutations are staged actions. Supported action families include the package's create/update/comment/review/state/label/merge operations, such as:

- create issue or pull request;
- update issue/PR title/body/state;
- add/remove labels where supported;
- create comments/review or diff replies;
- merge a pull request when the session/resource permits it.

The exact Gadget-facing method list is defined by the generated TypeScript declarations and implementation; this spec defines the invariant behavior.

For every side effect:

1. validate it against the bound resource;
2. allocate/store the staged action;
3. submit a complete approval description;
4. simulate pending state where the package supports it;
5. perform the GitHub API write only from `applyAction()`;
6. reject/clean staged state when denied;
7. retain enough information to revert when `implementsRevert` is advertised.

A merge or other difficult/non-reversible provider operation MUST NOT claim a reliable revert unless one truly exists.

## 7. Simulation and caching

The implementation maintains short-lived caches for provider entities/lists/viewer information and may overlay staged actions.

Cache TTLs are implementation details but MUST stay bounded and MUST be invalidated/updated after mutations that affect cached data. Simulation MUST never itself call a mutating GitHub endpoint.

## 8. Observer verification

Sharing a GitHub-backed workspace requires independent observer verification at the GitHub resource boundary. A collaborator must not inherit the owner's repository/private issue access solely through Cloudflare OS sharing.

The verifier MUST fail closed if it cannot prove access to the repository/resource. Fine-grained private-resource restrictions SHOULD be reflected in `excludeObservers` or direct denial as appropriate.

## 9. Configurator contract

Sandboxed configurators select repositories/issues/pull requests and produce canonical resource URLs. They may query a narrow account RPC for provider options.

Configurator output MUST correspond to one advertised `SupportedResource`, preserve repository ownership/name exactly enough for canonical lookup, and never convert a narrow issue/PR selection into repository-wide authority.

## 10. Security invariants

- OAuth nonce/state is random, expiring and single-use.
- Sign-in identity is provider-verified.
- Credentials stay inside the account object.
- Reads authorize before disclosure.
- Writes stage/submit before provider mutation.
- Resource scope is enforced server-side, not only in the configurator.
- Observer access is independently verified.
- Approval text includes meaningful target/change details without unbounded provider content.
- Merge/review permissions from GitHub are respected; the Gatekeeper cannot manufacture provider authority.

## 11. Build/configuration

Worker entrypoint: `src/github.ts`. Resource configurators are generated through the repository configurator build pipeline.

OAuth client ID/secret are deployment secrets/dev variables; `run-dev-server.js` may inject the shared GitHub OAuth credentials into generated development config. They MUST NOT be committed to source control.

## 12. Tests

Tests SHOULD cover:

- OAuth nonce/state and verified-email identity;
- repository/issue/PR URL parsing and anti-widening;
- private-resource observer verification;
- pagination/diff/discussion bounds;
- action staging, simulation, apply, rejection and revert semantics;
- merge/non-reversible action descriptions;
- cache invalidation after writes;
- configurator canonical URLs;
- reconnect/expired credentials.

## 13. Change rules

A new GitHub method that reads protected data requires observation authorization and scope tests. A new mutation requires a stable action kind, approval description, resource-scope validation, simulation/await-decision decision, revert truthfulness, generated type update, tests and this spec update.
