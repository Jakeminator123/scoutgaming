# OpenClaw source index / källindex (checked 2026-09-20)

Keywords + links, not vector search, embeddings, a docs MCP or an autocrawler.
This compact index is bundled offline; the full linked pages are NOT bundled.
Use docs.openclaw.ai and github.com/openclaw/openclaw as authoritative OpenClaw
sources. Check the pinned release before applying newer web examples. Render's
own documentation governs Render, not OpenClaw. With denied tools you can only
use this injected summary and provide links; you cannot fetch pages yourself.

| Keywords / behov | Official source |
| --- | --- |
| overview, översikt | https://docs.openclaw.ai/ |
| missing topic, sök vidare vid behov | https://docs.openclaw.ai/llms.txt |
| install, setup, onboard, Docker | https://docs.openclaw.ai/install ; https://docs.openclaw.ai/install/docker |
| configuration, schema, config validate | https://docs.openclaw.ai/gateway/configuration-reference ; https://docs.openclaw.ai/cli/config |
| dashboard, password, browser pairing | https://docs.openclaw.ai/web/control-ui |
| HTTP, chat completions, agent routing | https://docs.openclaw.ai/gateway/openai-http-api |
| workspace, AGENTS, SOUL, identity | https://docs.openclaw.ai/concepts/agent-workspace |
| tools, deny, permissions | https://docs.openclaw.ai/gateway/config-tools/tool-policy |
| MCP server/client | https://docs.openclaw.ai/cli/mcp |
| exact runtime version | https://github.com/openclaw/openclaw/tree/v2026.9.5 |

llms.txt is a link list: consult only when the task needs an unlisted source.
No background fetching or per-event docs reads. MCP server/client support is
not a documentation-search service; this lab uses HTTP, not MCP. Installing
this index does not configure any MCP server or grant network tools.

Repository index (paths are references, not automatic access):
- open-claw/lab/render.yaml: Render blueprint, services and env references.
- open-claw/lab/deploy/Dockerfile.gateway: pinned image/version.
- open-claw/lab/deploy/gateway-config.mjs: seed, preserved native config, policy.
- open-claw/lab/deploy/start-gateway.mjs: validate/reconcile/start and bundle sync.
- open-claw/lab/deploy/runtime-bundle.mjs: managed AGENTS content, snapshots/backups.
- open-claw/lab/src/social.mjs: isolated Astrid social lab JSON action and validation.
- docs/AI/openclaw/README.md and docs/AI/openclaw/OPENCLAW-DOCS.md: IDE on-demand source routing.
- docs/AI/openclaw/DASHBOARD-SV.md and docs/AI/openclaw/DEPLOYMENT.md: login/network/key roles.
- lab/: local studio; open-claw/lab/: Render Director and Gateway deployment.

Connection: local studio server → Render Director → private OpenClaw Gateway →
model provider. Local LAB_REMOTE_URL points to Director; LAB_REMOTE_TOKEN has
the same value as Director LAB_API_TOKEN. OPENCLAW_API_KEY is Gateway auth;
OPENCLAW_MODEL_API_KEY is the provider credential, not the Gateway password.
Use configured credentials unchanged; never print values. This static package
neither verifies current connectivity nor enables laptop access or player memory.
