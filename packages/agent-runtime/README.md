# Phase 1 Grok — staging deployment and completion evidence

**Status: incomplete, draft PR #6.** Phase 1 is only complete after real Cloudflare Container E2E. This README is a deployment runbook, not a deployment receipt.

## Scope

The sole new package is `packages/agent-runtime`, containing one WorkerEntrypoint, one per-chat Durable Object, the Grok Linux Container and private trusted inference bridge. The existing Workshop backend + frontend remain the only chat API and history store. No MCP server/client or external tool registry was introduced.

## Required operator configuration

- A Cloudflare account with Workers, Containers and a compatible paid plan/permissions, configured for Wrangler. Deploy the **agent-runtime** worker and its pinned Container image before deploying/binding the **workshop-backend** Worker.
- Set the private `GROK_PROXY_API_KEY` Worker secret in the agent-runtime environment (use `wrangler secret put GROK_PROXY_API_KEY --config packages/agent-runtime/wrangler.jsonc` or equivalent CI secret injection, never commit the value). Verify that the key is scoped to the approved inference proxy.
- Confirm that the deployed inference endpoint `https://cf-ai-rate-proxy.brasaimainstream.workers.dev/v1/chat/completions` is controlled by the organization, available, and permits the model `@cf/qwen/qwen3.8-27b`. These are Grokbot staging references, not evidence that the endpoint is currently healthy. Replace with policy-reviewed current profile where necessary.
- The Workshop deployment must have private service binding `GROK_RUNTIME` pointing to `agent-runtime`; no HTTP/Workers.dev route is allowed to control sessions. The Docker image needs Grok CLI pinned v1.0.50, correct ACP version negotiation, no production `--always-approve` and no standalone internet access.
- Existing customer release manifests deliberately **exclude** experimental image-backed runtime and its binding because `scripts/release` cannot yet build/distribute Docker Container images. That is a deployment blocker for default customer installs; do not interpret normal release CI as Cloudflare image-deploy proof.

## End-to-end acceptance (not yet checked)

- [ ] Container image actually builds and launches under Cloudflare, Grok CLI handshake `initialize(protocolVersion:1)` responds, `session/new(mcpServers:[])` works.
- [ ] A real user signs into Workshop, selects **Grok Build (Cloudflare Sandbox)** in the existing ChatInterface, and sends a text prompt.
- [ ] Grok receives it through private Worker/DO, makes provider inference over intercepted HTTPS with Worker-held secret only, and returns ACP updates to Workshop.
- [ ] Answer appears progressively, then persists as a normal assistant message in Overseer chat history. Refresh/reconnect returns same transcript, no duplicated turn.
- [ ] Unprivileged/use-only collaborator cannot invoke newGrokChat/sendGrokMessage; cross-workspace chat/session scope rejected.
- [ ] Native pi-agent-core chats and AgentSpawner continue functioning unchanged (regression suite).
- [ ] Cancellation, malformed ACP, model/key failure, reboot/disconnect and concurrent duplicate prompt return explicit safe errors/UNKNOWN, not a silent retry.
- [ ] Collect staging commit, container digest, Worker deployment URL (without secret-bearing query), CI test links and rollback procedure in PR.

## CI evidence

Use [GitHub Actions](https://github.com/brasalabs6/cloudflare-os/actions?query=branch%3Afeat%2Fphase1-grok-cloudflare-chat). CI validates workspace TypeScript, lint, generated configuration and local tests. **CI green alone cannot certify Cloudflare Container startup or remote model inference.**

Existing `.github/workflows/preview.yml` requires `github.repository_owner == 'cloudflare'`; preview is SKIPPED for `brasalabs6`. Do NOT remove this security guard solely to gain access to privileged Cloudflare secrets. Create a separately reviewed staging credential/workflow if Cloudflare integration testing is required from this fork.

## Rollback

Because Fase 1 is opt-in, do not enable Grok as a supported engine on a customer release lacking `GROK_RUNTIME` and the secret. If staging deployment fails, roll back the Workshop backend/UI to the preceding release and stop the dedicated agent-runtime Worker/Container. Preserve existing native chat history, and mark interrupted Grok operations as outcome unknown if the provider may have received them.
