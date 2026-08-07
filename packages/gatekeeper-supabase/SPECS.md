# Supabase Gatekeeper Specification

> **Package:** `@gadgets/supabase-gatekeeper`  
> **Status:** Normative package specification. This Gatekeeper's SQL read/write boundary is security-critical and MUST remain explicit.

## 1. Mission

The Supabase Gatekeeper exposes selected Supabase projects or organizations to Gadgets. It supports project discovery, schema/database introspection, read-only SQL queries, service/edge-function/storage inspection, and explicitly-approved mutating SQL where provided by the session.

The package MUST preserve a strict distinction between **query/observation** and **execute/action**. A SQL string is not safe merely because the caller names the method `query()`.

## 2. Resource model

Current resource types are:

- **Project:** `https://supabase.com/dashboard/project/:ref`;
- **Organization:** `https://supabase.com/dashboard/org/:slug`.

A project grant is scoped to one project. An organization grant may discover/manage projects within that organization only according to the session API. Provider refs/slugs MUST be canonicalized and revalidated server-side.

## 3. OAuth/credential lifecycle

The connector uses OAuth with random 32-byte initiation and OAuth nonces, ten-minute nonce lifetimes, one-hour incomplete-connect cleanup and an access-token refresh skew before provider expiry.

The account Durable Object owns refresh/access credentials. Reconnect replaces credentials on the existing account capability. Provider authorization failures MUST mark the account expired/unusable through the Workshop callback contract.

## 4. Cache model

The implementation uses bounded caches because provider metadata/schema calls are comparatively expensive:

- project/organization/service metadata: approximately 60 seconds;
- schema introspection: approximately 30 seconds;
- session access-token reuse: approximately 30 seconds.

Caches are optimization only. Authorization/resource validation MUST not rely solely on cached values. Applying a mutation that may change schema or metadata MUST invalidate the affected cache generation so the Gadget cannot continue against indefinitely stale introspection.

Cache keys MUST encode each component unambiguously so legal Postgres identifiers containing delimiters cannot collide.

## 5. Read-only SQL contract

`query()` is for read-only observations. The primary enforcement is the restricted/read-only database execution path. The package additionally performs defense-in-depth rejection of known SQL primitives that can cause synchronous/external/file side effects even when they do not look like ordinary DML.

Current explicit defensive classes include references to:

- `pg_net`/`net.*`;
- `dblink` operations;
- HTTP extension functions;
- server file read/list/stat functions;
- large-object import/export;
- `COPY ... FROM/TO PROGRAM`.

This pattern list is **not** the primary SQL parser/security boundary and MUST NOT be treated as exhaustive. The restricted database role/transaction mode remains required.

Any statement that can cause an external or durable side effect MUST use the approved mutation path, not `query()`.

## 6. Observation workflow

Read-only SQL results, schemas, table details, project metadata, service health, storage/edge-function metadata and organization/project listings are protected observations.

The session MUST await `authorizeObservation()` before returning them to the Gadget. Query results MUST be bounded by the public method contract to avoid unbounded Worker memory/result payloads.

## 7. Mutating SQL/action workflow

`execute()`-style mutation is approval-gated:

1. validate project/resource scope;
2. persist the SQL text/parameters as a staged action record with sequential identity;
3. submit a complete `ActionDescription` identifying the target project and meaningful SQL intent;
4. do not run the SQL yet;
5. execute it only from `applyAction()` after approval;
6. remove staged state on rejection;
7. invalidate schema/metadata caches after successful apply where relevant;
8. advertise automatic revert only when the implementation has an actual safe inverse.

Because arbitrary SQL is generally not reliably invertible, the package MUST be conservative about `implementsRevert` and `autoApprovable`.

## 8. SQL/result safety

- SQL parameters SHOULD be passed separately from SQL text where the API supports them.
- Approval descriptions MUST bound SQL text/parameters before display while retaining enough information for meaningful human review.
- Provider/database errors exposed to the Gadget SHOULD be normalized and MUST not include credentials/connection secrets.
- Unknown Supabase project status values MUST map to a documented fallback such as `UNKNOWN`, not unchecked casts.

## 9. Configurator contract

Project and organization configurators are sandboxed and may list connected account resources through narrow RPC. They return canonical dashboard URLs and MUST not pass OAuth credentials into the iframe.

## 10. Observer/sharing policy

Database/project data may be highly sensitive. A Cloudflare OS collaborator must independently satisfy the package's observer policy for the selected project/organization; an owner's broad Supabase OAuth connection is not proof of collaborator access.

When independent access cannot be proven, sharing MUST fail closed or the observation must prohibit/exclude affected collaborators under the shared policy.

## 11. Security invariants

- OAuth nonce/state is random, expiring and single-use.
- Credentials remain account-owned.
- Project/organization scope is server-enforced.
- `query()` remains read-only at the database authority layer plus defense-in-depth primitive filtering.
- External/file/network SQL side effects cannot bypass `execute()` approval.
- Every query/result/introspection read authorizes before disclosure.
- Mutating SQL executes only in `applyAction()`.
- Cache invalidation follows mutation.
- SQL/provider errors and approval text never leak credentials.

## 12. Build/configuration

Worker entrypoint: `src/supabase.ts`. Project/organization configurators are generated through the shared Gatekeeper configurator pipeline. Structured observability uses `backend-utils`.

`CLIENT_ID` and `CLIENT_SECRET` are deployment secrets/dev vars; the root dev launcher may inject the shared Supabase credentials into generated dev config.

## 13. Tests

Tests SHOULD cover:

- OAuth nonce/reconnect/token refresh;
- project/organization anti-widening;
- cache key collision resistance and TTL/invalidation;
- adversarial read-only SQL, including every side-effect primitive class;
- restricted-role/read-only execution behavior;
- bounded query results;
- execute stage/apply/reject semantics;
- schema cache invalidation after DDL;
- unknown project status fallback;
- observer verification and configurator canonical URLs.

## 14. Change rules

Any relaxation of `query()` restrictions or addition of a SQL/provider mutation is a security-sensitive architectural change. It requires server-side enforcement design, action/revert/auto-approval analysis, adversarial tests and this spec update. A regex-only rule is never sufficient as the sole enforcement for SQL safety.
