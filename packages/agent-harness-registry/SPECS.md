# Agent Harness Registry — SPECS

**Kind:** shared TypeScript library; not a Worker deployment.  
**Status:** specification; implementation pending.

## Responsibility

Store validated, immutable harness and runtime release metadata. It chooses a compatible, permitted manifest; it does not provision containers or infer unsupported capabilities.

## Manifest

Each manifest includes:
- stable harness ID: grok-build, codex or opencode;
- pinned CLI version, adapter version and immutable image digest;
- launch command/arguments and working directory;
- ACP transport and supported protocol range;
- configuration schema version and safe non-secret defaults;
- authentication strategy and allowed inference routes;
- default permission policy, resource requirements and health probe;
- checkpoint compatibility identifier and deprecation state.

Effective capabilities are the intersection of: manifest support, live ACP initialize result, runtime profile policy and user/session grants. Never expose a UI control solely because a static manifest lists a capability.

## Release selection

A release record pins runtime Worker target, image digest, harness manifest, policy version and experiment assignment. Selection validates eligibility and policy before a session is created. The resulting assignment is persisted for the lifetime of that session. Rollback prevents new assignments but does not silently move existing sessions.

## Validation

Reject mutable image tags, missing digests, duplicate IDs, unrecognized auth strategies, unsupported schema versions, commands outside the image's allowlisted launch catalog and a release with an incompatible checkpoint schema. Do not accept user-provided command strings as a manifest.

## Tests and acceptance

Test manifest schema validation, version compatibility, allowlist enforcement, deterministic cohort assignment, sticky session assignment, deprecation, rollback behavior and migration compatibility. The registry must return structured diagnostics rather than silently falling back to another harness.
