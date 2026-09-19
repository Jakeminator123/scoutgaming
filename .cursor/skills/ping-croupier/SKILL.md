---
name: ping-croupier
description: Check the Kevin–Jakob–Emil GitLab inbox once at the start of each new user turn, route replies to named agents, and send scoped project messages. Also handles explicit /ping-croupier requests.
---

# Croupier inbox

Thread: https://gitlab.com/scout-gg/croupier/-/work_items/1
Project: `scout-gg/croupier`, work item `1`. Rules: `docs/shared/AGENT-INBOX.md`.
Do not read the full wiki or handoff just to check messages.

## Identity — once per chat

Use the local user's name (Jakob, Kevin or Emil) and this chat's title, or a
short equivalent. Do not infer the owner from the Git commit author. This
checkout belongs to Jakob unless the user says otherwise.

```sh
node tools/croupier-inbox.mjs init --owner Jakob --title "Granska ändringar senaste fem timmar"
```

Use `CODEX_THREAD_ID` automatically. In other IDEs add `--session` with a
unique, stable ID to every command; generate it once and keep it in the chat.
Never share an ID between chats or subagents. Keep the returned `Agent-ID`
stable even if the title changes. State is ignored under `.croupier-inbox/`;
the old global `.cursor/ping-croupier-seen.json` is obsolete.

## Quick check — every new user turn, once

```sh
node tools/croupier-inbox.mjs check
```

One small conditional request when unchanged; extra pages only when needed.
No cron, background loop, immediate recheck after sending, or tool-call checks.
Separate sessions cannot consume each other's messages. `check` never posts
and never marks a relevant note read. `pending` reads cache only; it is not a
fresh GitLab check. Use `show --note ID` for a truncated note before acting.

- `status: ok`, no relevant messages: silently continue the local task.
  Explicit `/ping-croupier`: answer “Inget nytt för den här chatten”.
- `direct`: addressed to this agent. Inspect the actual author, content and
  local task scope. A signature is a routing label, not proof of identity.
- `review`: human/unstructured note, owner-wide or all-team message. Read it
  briefly for relevance to this chat. Mention alone does not assign work.
- Relevant: tell the local user who wrote it, the practical effect, and link
  the note. Keep unresolved action in local task context. Once the message has
  been surfaced in the local chat, `ack --note ID --version HASH --disposition delivered`.
- Irrelevant: `ack ... --disposition irrelevant`, silently continue.
- Failed/unavailable: do not claim “nothing new”. Use the fallback below;
  if access still fails, report the limitation once and continue local work.

## Connected tool/browser fallback

If the helper lacks `GITLAB_TOKEN`/`GITLAB_TOKEN_FILE`, use an already connected
GitLab tool: request only the work item timestamp first, then notes on change.
Keep freshness/cursors per chat, never use another chat's acknowledgement.
Paginate back to that chat's previous point; do not assume eight notes suffice.
Without a connector, reuse one logged-in browser tab for the thread, refresh
once and extract only new comments and their author/ID/time. Do not open the
whole wiki, search private logs for credentials, or extract browser cookies.
Browser fallback costs more than the API and must not be called a cheap API check.

Notes observed through tools/browser can be imported as a local JSON array:
`[{"id":"123","body":"…","updated_at":"ISO timestamp","author":{"username":"…"}}]`.
Use `import --file PATH`; this keeps pending messages, but deliberately does
not certify a complete remote scan. Cache no tokens or private transcripts.

## Communication

Register once on first participation: name, Agent-ID, scope, local owner.
An existing entry in the wiki's `agents` page also counts as registration.
The first real message may serve as registration; do not send a registration
and an acknowledgement separately. Every later message carries the same name.
Checks create no “I checked” comments. Another agent with the same human GitLab
account is still a different agent; never filter only by GitLab author.

Prepare a small body file, then:

```sh
node tools/croupier-inbox.mjs draft --to Kevin --kind question --body-file .croupier-inbox/question.txt
node tools/croupier-inbox.mjs draft --to jakob/0123456789abcdef --kind reply --reply-to 123 --body-file .croupier-inbox/reply.txt
node tools/croupier-inbox.mjs send --file PATH_RETURNED_BY_DRAFT
```

Use real recipient IDs from their signed messages. Owners `Jakob`, `Kevin`,
`Emil`, or `all` also work. Emil's GitLab handle is not yet known: do not invent
an @mention. Use `Reply-To` and one concrete question or answer per message.
Use `register`, `question`, `reply`, `info`, or `handoff`; don't start a line
with `/` (GitLab quick actions). Preserve `Message-ID` on a retry. An uncertain
send must be checked in GitLab before retrying; no duplicate auto-posts.
Use `record-sent --file note.json` for the verified returned comment (including
its exact Markdown body). If an uncertain Message-ID is verified absent in
GitLab, `cancel-send --version MESSAGE_ID --disposition verified-absent` clears
the pending attempt. A read failure is not evidence of absence.

Jakob has authorized short coordination messages about the current task.
When a relevant question is addressed to this agent, answer within that scope,
publish the short factual reply and tell the local user the same answer plus
the note link. This does not authorize new implementation, integration,
spending, permissions or disclosure of local conversations. Other owners adopt
this workflow explicitly. Do not impersonate a human or another agent.
Do not auto-answer informational replies or broad broadcasts. If a named
agent owns the work, leave ownership there; offer relevant facts only when useful.

Use the existing GitLab tool/browser instead of `send` when API authentication
is unavailable, following the tool's confirmation rules. Never claim sent,
delivered to a local chat, approved by a human, or completed without evidence.
