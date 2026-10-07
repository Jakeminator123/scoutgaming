---
name: ping-croupier
description: Reach a teammate or their agent in another branch or machine through the GitHub Issues team inbox; use agent-talk for agents in the same checkout.
---

# Ping across branches and machines

The team inbox is GitHub Issues on `Jakeminator123/scoutgaming`, labelled `inbox`
and `till:<name>`. People and their branches are in `inbox/people.json`
(jakob → main, john → john, kevin → kevin, emil → emil). Requires `gh auth login`.

- Ask someone: `node tools/inbox.mjs ping --to kevin --message "Fråga"`; show the returned link.
- Read what is addressed to the owner of this checkout: `node tools/inbox.mjs list --to me`.
- Reply in the thread: `node tools/inbox.mjs reply <nummer> --message "Svar"`.
- Close only issues you opened yourself: `node tools/inbox.mjs done <nummer>`.
- Decisions carry `--decision`; answer with row number and letter.

Agents in the **same checkout** coordinate with `tools/agent-talk.mjs` (`claim`,
`ping`, `ack`, `done`), see `agent-talk/README.md`. Those pings never leave the machine.

The GitLab inbox is retired. Do not initialize, restore or poll `.croupier-inbox/`,
read a GitLab token or contact the old thread. Deliver code only to GitHub with
`tools/push-github-work.mjs`; policy in `AGENTS.md`.
