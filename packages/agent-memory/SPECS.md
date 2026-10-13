# Workspace structured facts and learning — limited new capability

**Status:** PROVISIONAL spec; no code; must pass the Context-reuse design gate before separate storage is approved.
**Related implementation:** `gatekeeper-context` already owns documents/skills, account-private/domain-public collections, search and management writes. Its existing agent API is read-oriented.

## Why this may be different

The PDR requires **workspace ACL-scoped**, structured, attributed fact revisions, source provenance, per-agent optional subject, and *human-reviewed* learning proposals. Existing Context collections use account-private or domain-public visibility, not automatically a Workspace audience. Storing an agent's shared work memory inside an account-private Context collection would incorrectly hide it from collaborators; storing it in a domain-public collection could leak it across workspaces. Do not bypass the Context observer contract or assume all documents are safe to publish.

**Decision gate:** before building `agent-memory`, test whether a reviewed extension of `gatekeeper-context` can introduce the required workspace-granular visibility and versioned fact/review contract without breaking private/public ownership or existing agent read semantics. If it can, implement there and **delete this package proposal**. Independent storage is allowed only after evidence that this would dangerously entangle Context sharing/management.

## Scope / explicit non-ownership

Own **WorkspaceFact/FactRevision**, `LearningProposal` and a structured evidence/source-reference index, scoped to verified Workshop workspace, only if reuse gate fails. Does NOT own ContextDocument, SKILL.md, general-purpose full-text document search, Context collections, native chat compaction, ACC events or Control Plane continuity. Results are untrusted attributed content, never privileged system instructions.

Candidate public tools: `memory.search` (`WorkspaceFact` and optional separate Context authorized resource projection), `memory.get`, `memory.create`, `memory.revise`, `learning.propose`, `learning.list`. `learning.review` and trusted publication are human-only, using existing authenticated Workshop approval/governance path. Never create a new general approval queue.

## Storage and authorization

Workspace-scoped fact revisions have monotonic versions, bounded tags, sourceRefs and creator, optional agent subject; compare-and-set edits, archive/revisions rather than hard overwrite. Learning starts PROPOSED and cannot become trusted without distinct human review. Context documents may be referenced or fetched through existing observation-authorized session; no raw storage access, secret copies or automatic widening of Context scopes. A promoted fact stays within its approved sharing scope.

Events are translated into existing ACC; privacy-safe operational metrics use Observability. The fact store, if implemented, owns a local idempotency/outbox for its own writes, not a second audit stream.

## Required tests

Proof of Context reuse decision, tenant isolation for every read/page/resource, per-agent scope, revoke, version conflict, proposed learning not trusted until review, no self-approval or unsafe auto-promotion, private Context reference not readable by others, malicious prompt-injection text marked untrusted, restore and provenance integrity. AC09–AC10 / T15–T16.
