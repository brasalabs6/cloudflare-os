# Agent Mailbox — SPECS

**Kind:** proposed stateful domain package, Mailbox Durable Object; implementation pending.
**Traceability:** F07–F08, offline communication, delivery/read receipts.

## Mission

Provide durable agent↔agent and human↔agent communication by scoped channels and recipient inboxes. Sending a message means a durable write, not an ACP prompt, push notification or remote agent wake. The sender, participants and workspace are validated through Workshop-origin authenticated context.

## Domain API and MCP projections

- `message.send`: exactly one of `channelId` or `toPrincipal`, plus bounded `body`, `kind`, optional `taskId` and `idempotencyKey`; channel/recipient membership checked before persistence.
- `message.pull`: recipient's workspace inbox with opaque cursor, bounded limit, stable message IDs and receipt status.
- `message.ack`: only recipient's receipts, idempotent, no implied task completion.
- `message.list`: channel history for authorized participants, per-channel sequence pagination.
- Internal `deliverTaskAssignment(event)`: idempotent consumer of Task outbox. Never accept an unverified sender or an event claiming authority from arbitrary MCP JSON.

## Data and consistency

`Channel {channelId,workspaceId,kind,createdAt,nextSequence}`, `ChannelMember`, `Message {messageId,channelId,channelSequence,senderPrincipalId,kind,body,taskId?,createdAt}`, `RecipientReceipt {messageId,recipientPrincipalId,deliveredAt?,ackedAt?}` and `ConsumedEvent {sourceModule,eventId}`.

A single Mailbox-owner transaction assigns `channelSequence`, persists message/receipts and durable audit/outbox/dedupe. Total order exists **per channel**, not across channels. Direct channels are canonically resolved from workspace + sorted participant IDs to avoid accidental duplicates. Message body is **untrusted content** and must never be treated as a privileged instruction by bridge code. Do not disclose membership or content to unauthorized observers.

Task-to-mailbox cross-module flow is at-least-once; `ConsumedEvent` prevents duplicate notifications. Delivery of a downstream message must not mutate authoritative task state. Offline agents can retrieve unread backlog on next authenticated request; bounded retention/soft-deletion policy must preserve minimum delivery guarantees and audit metadata.

## Security and acceptance

Require `message:read`/`message:send` and membership on every read/write (including search and cursor continuation), applying `authorizeObservation` to protected reads in any Gatekeeper-facing adapter. Enforce message size, rate and fanout limits; guard against HTML/Markdown spoofing, notification storms, guessed channels, reused cursor across workspaces, receipt forgery and sender impersonation.

Tests: message+receipts atomic, duplicate send idempotent, per-channel monotonic seq under concurrency, offline pull after reconnect, ack repeat, task outbox replay, workspace/channel isolation, receipt restricted to recipient, redacted logs, long retention and paging.
