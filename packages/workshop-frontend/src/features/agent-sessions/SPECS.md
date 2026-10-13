# Workshop Agent Sessions UI — SPECS

**Kind:** feature specification inside the existing Workshop frontend.  
**Status:** specification; implementation pending.

## User goals

Create and manage persistent CLI agent sessions from the Workshop without replacing existing Code Mode, Gadgets or the current model-provider chat. A session can be attached to a workspace and optionally associated with a chat, but session identity is independent from chat identity.

## First-release screens and states

- Session list with owner/workspace, harness, pinned release, current status, last activity and error indicator.
- Create-session flow with harness, approved runtime profile, workspace/repository target and permission policy.
- Session chat showing user prompts, normalized assistant/tool events, tool permission requests and explicit run status.
- Approval dialog with bounded command/tool summary, requested scope, expiry and decision history.
- Terminal panel connected to a real PTY using a short-lived ticket.
- Read-only file explorer scoped to the granted root.
- Checkpoint/restore and stop controls with progress and clear failure state.
- Release/experiment metadata for authorized operators.

## Streaming and reconnection

The backend/DO is authoritative. On mount or reconnect, fetch status and replay events after the last sequence cursor. Deduplicate by session ID and sequence. A browser disconnect never cancels a run. Show OUTCOME_UNKNOWN distinctly and provide a reconciliation action rather than claiming success or failure without evidence.

Use the existing Workshop transport patterns wherever possible. Terminal transport is specialized and separately ticketed; do not expose the runtime's private control endpoint directly to the browser.

## UX/security requirements

- Do not show model or mode controls unsupported by the live ACP handshake.
- Render tool output as untrusted content; escape HTML and avoid automatic execution of links/commands.
- Keep credentials and raw runtime secrets out of client state.
- Distinguish pending approval, running, failed, cancelled and recovered sessions.
- File browsing is read-only for the first release; write operations occur through the harness/tool authorization path.
- Provide accessible keyboard controls, loading/empty/error states and responsive layout.

## Acceptance

Browser E2E covers create, prompt, streaming, approval round-trip, terminal attachment, file inspection, refresh/replay, cancellation, session stop, denied access and a recoverable runtime failure for each supported harness. Mock UI tests do not replace real Cloudflare staging E2E.
