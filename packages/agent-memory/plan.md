# Workspace structured memory — decision-first implementation plan

**State:** NOT STARTED, conditional. Read [SPECS](./SPECS.md), [Context Gatekeeper](../gatekeeper-context/SPECS.md), [ownership review](../../docs/architecture/MULTIAGENT_RESPONSIBILITY_AUDIT.md).

- [ ] ME01: test existing `ContextLibrary.search/list/read`, `ContextApiImpl` document CRUD, `ContextCollectionDurableObject` and observer protection. Prove account-private/domain-public visibility cannot safely satisfy workspace-scoped shared facts without a reviewed new scope type.
- [ ] ME02: security/architecture decision: **extend Context** if possible (in that case remove this package and move this plan into Context); otherwise explicitly justify separate scoped DO and owner.
- [ ] ME03: define fact/revision/learning immutable provenance schema + migrations, classifications, review policy and sourceRefs as permission-checked references.
- [ ] ME04: implement server-side revision CAS, source authorization, workspace redaction and search limited to structured facts; do not clone a document/skills repository.
- [ ] ME05: integrate human-only learning review with existing Workshop authorization; no agent writable trust flag; test staged/rejected suggestions.
- [ ] ME06: publish only approved, least-privilege tool manifests in existing Tool Registry/Gateway and native bindings.
- [ ] ME07: add one Memory/Learning panel in existing Agent Sessions UI, including provenance/revision/conflicts.
- [ ] ME08: cross-workspace and Context observer negative suite, concurrency/revoke/crash recovery, no secret/prompt leakage.
- [ ] ME09: migration, R2/DO export/restore, staging E2E and explicit no-go/roll-back checkpoints.

Until ME01/ME02 pass, **do not** create Worker/DO resources, write runtime code, or claim the separate memory package is approved.
