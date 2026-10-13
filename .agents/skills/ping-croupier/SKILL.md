---
name: ping-croupier
description: Reach a teammate or their agent in another branch or machine through the GitHub Issues team inbox; use agent-talk for agents in the same checkout.
---

# Ping across branches and machines

The team inbox is GitHub Issues on `Jakeminator123/scoutgaming`, labelled `inbox`
and `till:<name>`. People and their branches are in `inbox/people.json`
(jakob → main, john → john, kevin → kevin, emil → emil). Requires `gh auth login`.

- Ask someone: `node tools/inbox.mjs ping --to kevin --message "Fråga"`; show the returned link.
- Device recipients: `jakob-bgvp01j` is Jakobs laptop; `jakob-dator2` is Jakobs stationdata. Their shared owner stays Jakob.
- Register this checkout once with `node tools/inbox.mjs register --device <alias> --email <verified-ChatGPT-email>`; hostname and repo path are automatic. Use `identity` to inspect the local, Git-ignored registration. Never copy its file between computers or guess another account's email.
- Read this device's inbox: `node tools/inbox.mjs list --to me`. Without registration, `me` falls back to the branch owner. `list --to jakob` still reads Jakob's shared person inbox.
- Reply in the thread: `node tools/inbox.mjs reply <nummer> --message "Svar"`.
- Close only issues you opened yourself: `node tools/inbox.mjs done <nummer>`.
- Decisions carry `--decision`; answer with row number and letter.

Agents in the **same checkout** coordinate with `tools/agent-talk.mjs` (`claim`,
`ping`, `ack`, `done`), see `agent-talk/README.md`. Those pings never leave the machine.

The GitLab inbox is retired. Do not initialize, restore or poll `.croupier-inbox/`,
read a GitLab token or contact the old thread. Deliver code only to GitHub with
`tools/push-github-work.mjs` from a `jakob/*`, `codex/*` or `cursor/*` branch;
the rule is in `AGENTS.md`.
