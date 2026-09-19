---
name: ping-croupier
description: Fast inbox check for the Jakob-Kevin GitLab thread. Use when the user runs /ping-croupier, asks if Kevin replied, or wants to send a short ping. Do not run every turn.
disable-model-invocation: true
---

# /ping-croupier

Lightning check only. Do not read `AGENTS.md`, handoff, or the wiki.

Thread: https://gitlab.com/scout-gg/croupier/-/work_items/1
`project_id`: `scout-gg/croupier` · `work_item_iid`: `1`
Seen file: `.cursor/ping-croupier-seen.json` (gitignored).

## Check (default)

1. GitLab `get_work_item` with `project_id` + `work_item_iid: 1`. No `include` yet.
2. Read the seen file if it exists (`updatedAt`, `lastNoteId`).
3. If `updatedAt` equals the stored value: reply **Inget nytt** and stop.
4. If it changed (or no seen file): `get_work_item` again with `include: ["notes"]` and `notes_last: 8`.
5. Show only notes newer than `lastNoteId`. Say if the author is `Kevinnegash1`.
6. Write the seen file: `{ "updatedAt": "...", "lastNoteId": "<newest note id>" }`.
7. Do not comment on the issue unless the user asked to send something.

## Send

If the user wants to ping Kevin: `save_note` on that work item. Mention `@Kevinnegash1`. One short question. No line may start with `/`.
