# Agent Memory and Learning — SPECS

**Kind:** proposed workspace-scoped domain package; implementation pending.
**Traceability:** F09–F10, provenance, knowledge review.

## Mission and boundaries

Own structured, revisioned **multiagent workspace memory** and explicit learning proposals. This does not replace `gatekeeper-context`, which already provides context documents and skill collections; any Context Library integration is read/approved-write through its existing capabilities, never direct storage writes. Memory/learning claims are not system or developer instructions. Knowledge returned to agents must be marked as untrusted attributed content.

## Tool/API surface

Read: `memory.search` (bounded textual query + filters + cursor), `memory.get` (current revision/provenance), `learning.list` (authorized review queue).
Write: `memory.create` (kind, scope, body, refs, key), `memory.revise` (expectedRevision, patch, provenance), `learning.propose` (statement, source refs, confidence, key).

Learning review `learning.review` is a **human-authorized Workshop operation in v1**, not a broadly agent-callable tool. Approval may promote a proposal to a new memory revision with explicit linkage and provenance. It must not silently rewrite an existing memory or publish an instruction. Rejection retains audit history.

## Data model and invariants

`Memory {memoryId,workspaceId,scope,category,body,provenanceRefs[],status,revision,createdBy,updatedAt}` and append-only `MemoryRevision` with author/source/diff. `LearningProposal {learningId,workspaceId,statement,sourceRefs[],confidence,status,reviewedBy?,revision}`. Scope is at least `workspace` or `agent`; optional project-specific selection needs explicit policy and tested index. No implicit cross-workspace sharing.

- Mutable memory uses compare-and-set `expectedRevision`; archival/superseding does not erase audit.
- A learning is PROPOSED until reviewed; a self-review, ungrounded evidence or arbitrary high confidence score does not grant trusted status.
- Semantic/vector search is optional P1; MVP must implement explainable indexed text search and authorization per result.
- Preserve references to source event/task/artifact and sensitivity metadata; avoid copying secrets, full private conversations or unapproved data into a wider scope.

## Security and acceptance

Every returned memory body is a protected observation. Updates require `memory:write` on that exact scope. Workspace owner/reviewer policy is checked server-side. Test revision races, version history, no secret exposure in audit, self-approval denial, missing source, malicious Markdown/prompt injection in memory, workspace/agent scope isolation, search pagination and revocation visibility.
