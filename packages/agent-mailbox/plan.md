# Agent Mailbox — ordered implementation plan (NOT STARTED)

Reference [SPEC](./SPECS.md), [ownership review](../../docs/architecture/MULTIAGENT_RESPONSIBILITY_AUDIT.md), [PDR mapping](../../docs/architecture/MULTIAGENT_MCP_IMPLEMENTATION_PLAN.md).

- [ ] M01: inspect existing Overseer `chats`, `pendingAgentCalls`, ExternalMessageGateway and notifications in source and tests; prove offline channel/recipient/receipt gap with concrete fixtures.
- [ ] M02: review workspace-scoped mailbox API, participant permissions, storage shard/DO choice and how RPC capabilities are minted; do not add an auth issuer.
- [ ] M03: define JSON schema/TS types, source event dedupe, retention, migration and versioning consistent with ACC.
- [ ] M04: build channel membership and transactional message/receipt/sequence persistence with idempotent `message.send`.
- [ ] M05: build recipient-only `message.pull`/`ack` and channel `list` with bounded cursors, revocation and ACL.
- [ ] M06: integrate with Control Plane **WorkItem** assignment outbox using consumer `eventId` uniqueness, retry/backoff/dead letter; record committed-vs-delivered distinctly.
- [ ] M07: publish scoped `message.*` descriptors through existing `agent-tool-registry` and export via `agent-tool-gateway`; parity with Workshop RPC.
- [ ] M08: add existing Agent Sessions UI inbox; optionally integrate existing notification templates only after UX/security review.
- [ ] M09: DO interleaving/crash/after-ACK fault suite; cross-tenant/recipient negative tests; offline/reconnect browser and two MCP clients E2E.
- [ ] M10: staging migrations, backup/restore drill, quotas, monitoring and rollback. Only then deploy.

**No status upgrade** until tests/staging links, owner approvals and deployed code are recorded. This plan does not authorize a second chat gateway.
