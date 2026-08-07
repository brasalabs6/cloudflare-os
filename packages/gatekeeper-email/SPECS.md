# Email Gatekeeper Specification

> **Package:** `@gadgets/email-gatekeeper`  
> **Status:** Normative package specification. This Gatekeeper is both a capability provider and an asynchronous Email ingress path.

## 1. Mission

The Email Gatekeeper lets a user claim a deployment-local mailbox address and bind incoming messages to persistent Gadget hooks. It deliberately does not require an external OAuth provider: the account connection establishes ownership of a local-part within the deployment's configured mail domain/routing environment.

Its highest-risk boundary is asynchronous ingress. Email delivery is external, at-least-once-prone input and MUST remain idempotent, bounded, observation-authorized and routed only to an explicitly enabled hook.

## 2. Resource model

The canonical mailbox resource is derived from this Gatekeeper's public base URL and a normalized mailbox user/local-part, conceptually:

`<BASE_URL>/mailbox/:user`

Mailbox names are normalized to lowercase and constrained to the package's safe local-part grammar. Current rules permit ASCII letters, digits and `._+-`, bound the length to 1–64 characters, and reject problematic dot placement such as leading/trailing/consecutive dots.

A mailbox binding grants only that mailbox. It MUST NOT imply access to arbitrary recipients or other users' claimed names.

## 3. Account connection flow

Because there is no provider OAuth flow, `connectAccount()` creates an account Durable Object and returns a nonce-protected local connection URL.

The flow MUST:

1. create a fresh account object and Workshop callback;
2. generate a cryptographically random initiation nonce;
3. store it with an expiration (currently ten minutes);
4. validate/consume it before completing the account;
5. self-clean an abandoned first connection within a bounded period (currently one hour);
6. persist the account capability once successfully completed.

The account tracks the local mailbox identity/claims needed to prevent two accounts from silently acquiring the same mailbox name.

## 4. Email ingress workflow

The router forwards Worker Email events only when `GATEKEEPER_EMAIL` is installed. This package then:

1. receives the raw inbound message;
2. identifies/normalizes the intended local mailbox recipient;
3. parses MIME content through the package parser;
4. converts message body, headers and attachments into bounded structured data;
5. resolves the mailbox/address Durable Object;
6. resolves the currently-enabled persistent hook delivery state;
7. starts a fresh hook invocation/session with the Overseer;
8. authorizes the incoming message as an observation;
9. invokes the persistent Gadget callback;
10. only acknowledges delivery after the package's delivery contract is satisfied.

If the address is invalid/unclaimed, no hook is active, or the hook delivery fails in a way that cannot be accepted safely, the Email event MUST be rejected rather than silently dropped as successful.

## 5. Idempotency

Email infrastructure can redeliver when acknowledgement is lost. Any stable provider/message identity available to this package SHOULD be transformed into a stable message key and used so duplicate delivery cannot create uncontrolled duplicate agent work or side effects.

Hook consumers MUST be designed for at-least-once invocation. The Gatekeeper MUST NOT rely on in-memory "already seen" state for correctness across Worker restarts.

## 6. MIME/content handling

Inbound Email is untrusted content and may contain malformed MIME structures, hostile filenames, giant bodies/attachments or prompt-injection text.

The parser/normalizer MUST:

- bound message/attachment data before exposing it to the Gadget;
- preserve useful MIME/content metadata without treating it as trusted instruction;
- avoid interpreting attachment filenames/content types as filesystem authority;
- reject or truncate according to explicit package limits rather than consuming unbounded memory;
- never log raw secrets/private message bodies by default.

## 7. Hook lifecycle

Registering an Email callback uses the shared persistent hook contract.

- Hook registration MUST go through `ApprovalQueue.bindHook()`.
- External routing/durable activation state MUST not become active until the Overseer calls the hook controller's `enable()`.
- `disable()` MUST make future delivery fail closed/no-delivery for that hook.
- Incoming event delivery creates a new session-bound callback/approval context and MUST authorize observation before giving message contents to the Gadget.

## 8. Sharing/observer policy

An incoming email can contain private information intended for the mailbox owner. Sharing behavior MUST follow the Gatekeeper observer policy established by the concrete resource/session. The package MUST NOT assume that all workspace collaborators are authorized to read arbitrary incoming messages.

Where independent recipient/source authorization cannot be proven, the Gatekeeper SHOULD constrain/exclude observers or mark observations with the appropriate sharing restriction.

## 9. Security invariants

- Mailbox claim URLs use random expiring single-use nonces.
- Local-part normalization is canonical and collision-safe.
- One user's mailbox cannot mint another mailbox's facet.
- Inbound raw Email is untrusted and bounded before agent delivery.
- Hook registration is approval-controlled; delivery only targets enabled hooks.
- Message contents are observation-authorized before callback disclosure.
- Delivery/retry paths are idempotency-aware.
- Missing installation/recipient/hook fails closed rather than accepting mail into a black hole.

## 10. Build/configuration

Worker entrypoint: `src/email.ts`. The package uses `postal-mime` for message parsing and the shared configurator build for mailbox selection UI where applicable.

Production Email Routing/custom-domain configuration is deployment infrastructure outside this package, but the Worker/router contract MUST remain compatible with Cloudflare Email events.

## 11. Tests

Tests SHOULD cover:

- valid/invalid mailbox names and canonicalization;
- nonce expiry/replay;
- duplicate mailbox claims;
- hook enable/disable lifecycle;
- malformed MIME and bounded attachment/body behavior;
- unclaimed recipient/no hook rejection;
- duplicate/redelivered message behavior;
- observation authorization before callback;
- router integration with/without `GATEKEEPER_EMAIL`.

## 12. Change rules

Changes to mailbox syntax, message normalization, routing keys, hook persistence or acknowledgement semantics are compatibility-sensitive because they affect deployed addresses and at-least-once delivery. They require migration/backward-compatibility analysis, tests and this spec update.
