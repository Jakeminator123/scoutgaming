---
name: ping-croupier
description: Set up Croupier inbox identity and handle explicit /ping-croupier, routing problems or scoped replies. Ordinary turn-start checks use the command in AGENTS.md directly; no skill reload or trigger on agent/tool updates.
---

# Croupier inbox

Thread: https://gitlab.com/scout-gg/croupier/-/work_items/1

## Quick path

Run `node tools/croupier-inbox.mjs check` once per NEW USER turn, not on tool
results, agent messages or timers. It never posts or acknowledges anything.
Do not read the wiki, handoff, full inbox/history or this skill again just to check.
Shared fetch cache: 30 seconds. Per-chat unread state: independent.
`pending` is offline only; explicit `/ping-croupier` uses `check --fresh`.

Uninitialized chat: `init --owner Jakob --title "CURRENT CHAT TITLE"` once.
Use the actual local owner, not Git author (this checkout is Jakob's).
Codex uses CODEX_THREAD_ID; other IDEs pass a unique stable `--session` on every
command. Never reuse another chat/subagent's ID. Keep the ID across renames.

- `ok` + no relevant notes: silently continue. Explicit ping: give a short status.
- Previews only: read `show --note ID` before answering/acting on a relevant note.
  `omittedCount` means more remain; process relevant items, then use `pending`.
- `direct` + `mayReply`: assigned to THIS agent, subject to actual author and task scope.
- `review`: human/owner-wide message; assess relevance, not automatic permission to answer.
- `info`: CC only. Do not answer on behalf of the To recipient.
- Surface relevant content and its link locally; then `ack --note ID --version HASH --disposition delivered`.
  Irrelevant: disposition `irrelevant`. Never auto-ack unread previews.
- Missing API/busy/error: not “nothing new”. Report the limitation once and continue
  unrelated work. Do NOT launch browser fallback on ordinary turns. For explicit
  inbox work or a task blocked on a reply, use a connected tool or one logged-in
  browser refresh, reading only new comments. Never extract cookies/search logs for tokens.

## Sending (read docs/shared/AGENT-INBOX.md for commands and setup)

One responsible To for questions/handoffs/replies. Exact registered Agent-ID is
preferred. `To: Kevin` waits for Kevin to choose his agent; `--confirm-owner Kevin`
records that explicit local choice, never an agent's unilateral self-assignment.
Emil cannot answer Kevin's question, even as CC. Unknown IDs are not invented.
Replies target the original sender and set Reply-To. Draft before acknowledging
the parent. Helper checks ownership at draft AND send, and rechecks the live parent.
Use the same guard/format for browser posts; do not bypass a helper rejection.

First real message can register name/id/scope. Sign all actual messages. No “I
checked”, auto-thanks, reply chains, local transcript mirroring or waking all agents.
Publish only useful scoped questions, answers, blockers, handoffs or decisions with
evidence links; share the same answer/link with the local user. Local task-to-task
messages are not GitLab posts. Other owners opt in on their own machines.

Jakob authorizes short coordination about the current task, not expanded work,
merges, spending, permissions or private disclosures. Check actual GitLab author;
an Agent-ID is a routing label, not authentication. Follow tool confirmation rules.
Never claim sent until GitLab confirms; uncertain sends require Message-ID
reconciliation before retry (see the guide). Never put a token in a chat/command.
