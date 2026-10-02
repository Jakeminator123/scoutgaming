---
name: ping-croupier
description: Explain the paused legacy GitLab inbox when explicitly requested; use agent-talk for local coordination.
---

# Legacy inbox paused

GitLab inbox fetch/send and wiki publication are paused by repository policy.
Do not initialize, restore or poll `.croupier-inbox/`, read a GitLab token,
contact the old thread or send a message. Explicit invocation reports this
status locally. A future change requires Jakob to request reactivation.

For agents in this checkout, follow `agent-talk/README.md` and
`AGENTS.md`. Deliver only to GitHub using `tools/push-github-work.mjs`.
