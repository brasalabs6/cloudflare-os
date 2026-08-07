# Scheduled Tasks Gatekeeper Specification

> **Package:** `@gadgets/gatekeeper-scheduler`  
> **Status:** Normative package specification. Scheduler is an ambient, auto-provisionable Gatekeeper whose persistent registrations use the shared **hook** approval model rather than the action queue.

## 1. Mission

The Scheduled Tasks Gatekeeper lets a workspace register persistent callbacks that run on recurring interval schedules, timezone-aware calendar schedules, or one-shot times. It is a platform capability owned by the deployment, not an external OAuth account.

Its central invariant is: **creating a schedule is binding a persistent hook**. Schedule registration MUST NOT bypass the human hook-approval lifecycle, and no driver activation may exist before the hook controller is enabled.

## 2. Account/provisioning model

The vendor advertises:

- `autoProvisionsAccount: true`;
- `providesAuth: false`;
- no interactive `connectAccount()` flow;
- no URL-addressed resources;
- one ambient singleton session (`ScheduleSession`);
- a sandboxed management app (`Scheduled`).

Creation mints an opaque Scheduler account capability with its own account identifier. Kernel ambient provisioning policy remains authoritative (`optional` default, `enabled`, `disabled`).

There are no credentials to reconnect. `reconnect()` MUST fail explicitly. `getAuthenticatedEmail()` returns no external identity.

Revoking the account MUST remove/revoke the account's driver state and all schedule activations.

## 3. Gadget-facing resource/session

The ambient Gatekeeper describes the resource as:

- URL/identity: `scheduler://tasks`;
- suggested binding: `SCHEDULER`;
- session type: `ScheduleSession`;
- hook callback type: `ScheduledTaskHook`.

The concrete facet is workspace-scoped. Its inherited Durable Object ID MUST represent the workspace scope, not the account ID. The current implementation explicitly sanity-checks that these are not the same.

## 4. `ScheduleSession` workflow

The current session provides these scheduling operations:

- `every(everyMs, callback, options)` — recurring elapsed interval anchored at registration time;
- `calendarAt(rule, callback, options)` — timezone-aware calendar recurrence;
- `runAt(when, callback, options)` — one-shot schedule;
- `list()` — list enabled schedules for the current workspace.

Schedule input MUST be normalized by the scheduler core before persistence/approval. Invalid intervals, calendar rules, dates/timezones or occurrence constraints MUST fail before binding an unusable hook.

Occurrence limits apply only to recurring schedules; a one-shot schedule MUST reject recurring occurrence options.

## 5. Hook registration state machine

Registering a schedule MUST follow this order:

1. capture a consistent registration timestamp;
2. normalize the schedule and presentation options;
3. allocate a unique schedule ID;
4. construct a `ScheduleHookController` whose props contain all activation data needed later;
5. call `ApprovalQueue.bindHook(controller, callback, metadata)`;
6. return the schedule ID without enabling external driver state;
7. only when the Overseer approves and calls `controller.enable(initiator, target)` may the driver persist/activate delivery;
8. `controller.disable()` removes driver state for that schedule.

The hook controller MUST record the Gadget target metadata supplied by the Overseer when enabling so later events return to the intended Gadget/session.

## 6. Driver contract

`ScheduleDriver` owns durable schedule activation and account/workspace indexes. It is addressed by the Scheduler account identity while individual schedule records remain workspace-scoped.

Driver operations MUST be idempotency-aware across Worker retries and must not create duplicate deliveries merely because `enable()` is retried. Disabling/revoking must remove enough state that no further callbacks are delivered for the disabled schedule.

The driver is the persistent execution mechanism; the `ScheduleSession` itself is not durable delivery state.

## 7. Observation/action semantics

`list()` returns protected workspace schedule metadata and MUST call `authorizeObservation()` before returning the list.

Scheduler currently defines **no Gatekeeper action queue operations**:

- `getAutoApprovableActions()` returns none;
- `applyAction()` rejects because Scheduler submits no actions;
- `rejectAction()` rejects because Scheduler submits no actions;
- `revertAction()` rejects because Scheduler submits no actions.

This is intentional: schedule creation/removal authority is represented by approved hook activation/disable, not by pretending hook registration is an ordinary action.

## 8. Event delivery

When a schedule fires, the driver/controller path MUST use the stored `HookInitiator` to start a fresh hook session and recover the persistent callback in a new session-bound context.

The scheduled event is an observation. Before callback data is delivered, the new `ApprovalQueue`/authorizer MUST authorize the occurrence.

Delivery logic SHOULD be robust to at-least-once runtime triggers. Schedule/occurrence identity MUST be available to make duplicate handling safe when the runtime can redeliver.

## 9. Management app

The account advertises a read-only schedule management app. `ScheduleManagementApi.list()` lists schedules across the current account using bounded management pagination/options.

The management iframe receives only a narrow management RPC capability. It MUST NOT receive the Workshop API or the underlying driver namespace directly.

Admin/user context from Workshop is not itself permission to synthesize schedules outside the hook approval path.

## 10. Observer/sharing policy

The current Scheduler Gatekeeper accepts collaborators under its low-stakes observer policy and stores no independent observer state. This is safe only because the session exposes schedule metadata and callback registration scoped to the current workspace and does not expose an external user's private third-party dataset.

If future schedules contain sensitive external payloads or identities, this observer policy MUST be revisited explicitly.

## 11. Security invariants

- No OAuth/credential path exists.
- Ambient provisioning follows kernel policy.
- Workspace facet scope cannot collapse into account scope.
- Schedule inputs are normalized before registration.
- No durable delivery state exists before hook `enable()`.
- `disable()`/revoke remove delivery authority.
- Schedule listing is observation-authorized.
- No ordinary action method is used to bypass hook approval.
- Management UI is sandboxed and narrow-capability.

## 12. Build workflow

Worker entrypoint exports are routed through `src/index.ts` / `src/worker.ts`. The management application is bundled by package `build-app.mjs` into generated Worker-consumable HTML and rebuilt/watched by the root dev launcher.

Timezone/calendar behavior relies on the package's temporal support and MUST remain deterministic across Workers/runtime upgrades.

## 13. Tests

Tests SHOULD cover:

- interval/calendar/one-shot normalization and invalid inputs;
- timezone and occurrence-bound semantics;
- hook bind-before-enable invariant;
- enable/disable idempotency;
- account/workspace isolation;
- list observation authorization;
- firing a schedule through a fresh hook session;
- duplicate trigger resilience;
- revoke removes all activations;
- management list pagination;
- explicit failure of unsupported action/reconnect methods.

## 14. Change rules

Do not model schedule registration as an immediate side effect or ordinary Gatekeeper action without a deliberate architecture revision. New schedule types must fit the normalized `ScheduleSpec`/driver model, define durable occurrence semantics, preserve hook approval and update agent-facing types/tests/specs together.
