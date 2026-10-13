# Gatekeeper Computers — SPECS

**Kind:** independent Cloudflare Gatekeeper Worker following the repository's Gatekeeper authoring guide.  
**Status:** proposed API for review; implementation pending.

## Responsibility

Expose separately grantable computer capabilities for a session: bounded file inspection, terminal attachment, command execution when explicitly authorized, and checkpoint operations. It never owns the ACP run journal or provisions a new session.

## Capability granularity

A ComputerHandle binds one session and one generation plus an explicit set of capabilities: readFiles, terminal, executeCommand, checkpoint and restore. File grants include a canonical root and maximum read size. Command grants include an allowlisted command/profile, working directory, environment allowlist, runtime ceiling and output caps. Defaults are deny.

## Operations

- inspectFiles(path, limit) and readTextFile(path, maxBytes): observations, root-bound and path-normalized, with traversal/symlink protections and authorizeObservation.
- startTerminal(): human UI terminal only after user/session authorization; mint a short-lived single-use ticket bound to principal, origin, session and generation.
- runCommand(commandSpec): a side effect; submit for approval unless a narrowly defined policy explicitly permits it. Do not expose arbitrary shell or pass untrusted text to sh -c by default.
- checkpoint/restore: idempotent operations with manifest/checksum and release compatibility checks.
- previewPort(port): future capability, deferred until authenticated ingress and port allowlisting are implemented.

## Safety

Terminal tickets require expiry, nonce/JTI replay prevention, origin binding, principal/session binding and generation fencing. File operations must reject traversal, symlink escapes and oversized/binary payloads. Logs contain action metadata, not secret file contents or environment values.

## Implementation checklist

Follow the Gatekeeper authoring guide. Define src/types.d.ts and generated src/types.txt before implementation and review the public API first. Use canonical action/approval and observation contracts. Test cross-user/session denial, ticket replay/expiry, stale generation, path traversal, symlink escape, command timeout, output truncation, unauthorized ports and checkpoint integrity.


## Authority and terminal boundary

See [ACP_CONTRACTS_V1](../../docs/architecture/ACP_CONTRACTS_V1.md) sections 3 and 7. A terminal PTY with arbitrary input is a privileged human Computer capability; it MUST NOT be treated as a safe command allowlist or inherited from CodingAgents/ACP permission. Enforce short-lived single-use generation-bound ticket claims, nonce consumption, origin/principal/session binding and per-session terminal metadata. Bounded file list/read are observations, while writes and commands are actions requiring reviewed grant/approval. `src/types.d.ts` remains a proposed interface until validated against Cap'n Web and observer/approval requirements.
