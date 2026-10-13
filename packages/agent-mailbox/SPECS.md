# Agent Mailbox — bounded offline communication capability

**Status:** specification only; no Worker/DO implementation. **Kind:** potential independently stored workspace communication module.
**Normative:** [Unified Agent Platform v2](../../docs/architecture/AGENT_PLATFORM_UNIFIED_V2.md), [responsibility audit](../../docs/architecture/MULTIAGENT_RESPONSIBILITY_AUDIT.md), [coordination contracts](../../docs/architecture/MULTIAGENT_MCP_CONTRACTS_V1.md).

## Mission: own what existing chats do not

Provide authenticated human↔agent and agent↔agent workspace **channel messages**, recipient inbox, per-channel ordering and ack/read receipts, including recipients temporarily offline. Unlike `workshop-backend/src/external-message-gateway.ts` it does NOT trust an external gateway `callerEmail` or route a prompt into a Gadget workspace. Unlike Overseer `chats` and `pendingAgentCalls` it is NOT a model transcript, callable RPC queue or implicit engine wake.

Before writing storage code, implement a test probe demonstrating the actual gap against existing Overseer callbacks and ExternalMessageGateway. If an existing safe primitive satisfies every inbox/receipt/ordering/isolation invariant, reuse it instead of introducing a DO. Do not alter external-message gateway authority.

## Entities, ownership and operations

`Channel` (workspace-scoped, direct/workspace, canonical membership), `ChannelMember`, `MailMessage` (source principal, kind, bounded body, optional `workItemId`, per-channel `channelSequence`), `MailReceipt` (recipient-specific delivery/ack timestamps) and consumer dedupe records. Match the proposed delta contracts. The mailbox must not mint identities or decide workspace membership; receive trusted Workshop-verified actor context and verify channel membership/role at every operation.

`message.send`: validate exactly one channel or recipient selector, sender scope, recipient scope, size, dedupe key; transactionally commit message, sequence, receipts and source outbox. `message.list`: authorized channel page. `message.pull`: recipient's mailbox, stable cursor. `message.ack`: only caller's receipts, idempotent. The read path never assumes an external client is connected or starts any runner.

Control Plane WorkItem assignment produces an **internal outbox event**. Consumer atomically saves a single `task_notice` with event dedupe; a failed Mailbox does not roll back a committed assignment. Acknowledgment proves receipt only, not processing, approval or task success. ACC is the only normalized cross-engine event projection, not a second public DomainEvent schema.

## Security/limits

One workspace; exact channel membership and recipient check; no caller-supplied actor identity; secrets/body redaction; untrusted content for prompt/Markdown; quotas, bounded pagination and retention. Gatekeeper-mediated protected reads use its observation contract. Device push may be requested only through existing Workshop notification service after reviewed template and permission changes — no new notification token/provider infrastructure.

## Acceptance

T13/T14/T20/T26/T27: offline recipient connects and reads once; per-channel strict sequence; concurrent sends; ack idempotent; no cross-workspace/cursor/recipient leakage; task assignment outbox after-consumer-crash redelivery exactly one **stored** message; no implicit native/ACP run; revocation, retention and restore.
