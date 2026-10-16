# Croupier continuity and dealer regression rules

## Three product surfaces

Product terminology and system-map inventories describe the product; they do not require preserving old implementations, files or tests. Jakob's current decisions take precedence. Use the current handoff for delivery status. Do not read the whole generated map during ordinary development or restore obsolete dependencies to satisfy a historical map entry.

The product model has one source: `lab/docs/TERMINOLOGI.md`. Scoutgaming → operator/company → games → operator-owned room/background choices; each game permits compatible dealers and foreground tables. The player chooses the allowed dealer and table for a room's background. A shared background file may be used by different operator-owned rooms without merging their identities or permissions. A composition is technical playback configuration, not another room or dealer. Keep design IDs, uploaded layer UUIDs, dealer IDs, room IDs and frozen package IDs distinct. `docs/LOCAL-PRESENTATION-RUNTIME.md` records storage/runtime limits; `web/public/material-catalog.mjs` records immutable design names and hashes. Do not infer an implemented migration from the target model.
Jakob confirmed that the five supplied blackjack boards are separate designs. Do not infer parent/variant relationships. Future blinking frame sequences need explicit grouping and accepted shared geometry; follow the technical reference before implementing them.
Jakob's direction: `/admin` is the primary N1 backoffice surface and `/lobby` is the new player lobby. Build new features and improve layouts in Admin using real `/admin` pathnames. `/control` and the older `/play`/`/game` entry points are being phased out. Retire pages, aliases and their obsolete tests when Jakob explicitly approves their removal or a replacement is verified; update remaining callers and report affected saved links. No rule requires preserving every old page, menu, filename or test. Protect authentication, room ownership, active game launches and saved data that remain in scope. Legacy fixes are limited to compatibility and shared services; a labelled link to an older editor is appropriate while that function is still needed. N1 authorization remains independent of the chosen UI. `/lobby` does not itself replace the actual game engine or `/play/{game}` launch contract.

The visual layers are **background → dealer → table**, followed by the game's authoritative cards and UI. A shared composition is a reusable template: editing it can affect several rooms' drafts. Room-specific allowed appearance choices belong to the existing scoped `roomOverrides` writer; a selected room in the UI does not make a shared template write room-specific.
Dealer clip categories (`dealerSets`) only organize exact media references; they do not register people or select playback.

Develop lifecycle controls in Admin and reuse the same service contracts in existing Control pages during the transition. Compatibility does not require recreating an old layout for every new Admin feature. Use plain user-facing names from `lab/docs/TERMINOLOGI.md`; stored legacy IDs remain compatibility details. Company trash detaches its rooms; restoring the company never reopens rooms automatically. Material trash previews dependencies and removes active links atomically, retains source files and publication history, and restores an asset as an unassigned library choice. Do not implement trash as a hidden filter over still-active structures or purge historical database rows as a side effect of ordinary deletion.

Public site: https://www.scoutgaming.tech. Apex `scoutgaming.tech` is a 308 to www.
Vercel team and project are both `scoutgaming`. The game engine stays on Render service `croupier-v2`.

| Level | Who | Path | Now |
| --- | --- | --- | --- |
| 1 | Internal staff | `/admin` | Home, Klippkarta `/admin/clips`, Dealers `/admin/dealers`, Bord & bakgrunder `/admin/assets`, and existing tools under `/admin/tools`. Company/team editing is `/admin/companies`, room creation/publication is `/admin/publication`, and rehearsal is `/admin/rehearsal`; these already reuse the existing components and native APIs. Registered company `/admin/admin/operators` and room `/admin/rooms` overviews remain distinct from those editors. Keep dealer, composition, operator, real room and game context in links. `/control` pages and old bookmarks remain compatibility surfaces. Old `lane` query is accepted; Studio links emit `composition`. Stored IDs and game configuration remain compatible. Dealers, companies and rooms have explicit lifecycle controls. Dealer archive atomically handles speech, clips, compositions and affected publications/rooms; restore returns drafts with speech off. Published history/media remain protected. |
| 2 | Operator (Unibet etc.) | `/partner`, `/partner/login`, `/partner/{operatorSlug}` | Real registered operators and active memberships; no silent demo fallback. `/partner/{slug}/rooms` owns scoped room appearance, reviewed publication and drafts. Writes recheck grants, ownership and revisions. Players, transactions and reports from the engine, chips and partner password reset remain open; see CLOUD-MIGRATION.md. |
| 3 | Player | `/lobby` | New player lobby. Existing `/play` lobby, profile/history and `/play/blackjack` or `/play/roulette` launches retain their server-authenticated package and room checks. Profile balance remains server-owned. Media acceptance stays in the actual game player, with two consecutive plays. |

`lab/` is the active Studio application's source directory. `/studio` is its deployed Next.js `basePath`, including APIs and assets; neither is a fourth product. Old `/lissabon`, `/lab`, `/labb`, and `/bo` names are retired product aliases. Check remaining callers before retiring compatibility redirects or runtime flags such as `lissabon-stream-lane`. Preserve Astrid's verified media, speech functions and history as a labelled legacy reference without a three-layer version; this does not require keeping old implementations, local profiles or parallel local registries. Product registry data comes from Neon and media bytes from Blob.

`lab/lib` contains active shared authentication, Studio storage, media and publication services used by Admin and the game. The folder name is not evidence that these modules are disposable. Extract shared rules to neutral modules when needed: speech templates and compatibility live in `web/public/studio-speech.mjs`, used by both Admin and the server. Preserve exact media identities, captions and approvals while separating old pages from shared behavior.

## GitHub delivery

Deliver from a feature branch matching `jakob/*`, `codex/*` or `cursor/*` in `Jakeminator123/scoutgaming` (repository ID `1380630440`; `github-work` redirects here) and open a pull request to `main`. `tools/repository-policy.json` lists those patterns. The pre-push hook allows new and fast-forward updates of those branches and of `main`, and rejects deletion, force-push, tags and any other repository. Direct push to `main` remains only as an explicit admin emergency path (`node tools/push-github-work.mjs --admin-main`). Ordinary delivery is `node tools/push-github-work.mjs`: it pushes the current feature branch and prints the `gh pr create` command without creating the pull request. `tools/push-work-mirrors.mjs` is the GitHub-only compatibility entry point. Never force-push. GitHub ruleset 24642403 ("main: pull requests only") requires a pull request into `main`.

GitLab inbox, wiki, and mirror are paused. Jira is not an authorized workflow. The live migration tracker is `docs/CLOUD-MIGRATION.md`. Check an item complete only when its full expected result is verified. Do not create another tracker.

The Admin C1–C9 checkpoints live in that tracker's Admin migration log. Record code implementation, local checks, browser checks with local assets, and deployed acceptance separately; another agent's receipt is attributed evidence, not a new acceptance run. C1–C3 cover inventory, navigation and N1 styling; they do not authorize gameplay, media, migrations, merges or deployments.

### Merge ownership and explicit confirmation

Before every agent-operated merge (CLI, API, browser, auto-merge or merge queue), freshly read the PR number, author login, source repository, head branch and full head SHA. Use the owner mapping in `inbox/people.json` from trusted current `main`, not a proposed change in the PR. A general Jakob merge mandate covers only PRs created by `Jakeminator123` whose source is verified as Jakob-owned; a `codex/*` or `cursor/*` name alone is not ownership evidence.

Branches named `kevin`, `kevin-*` or `kevin/*` are Kevin's work; `john`, `john-*` or `john/*` are John's; `emil`, `emil-*` or `emil/*` are Emil's. Those owners override a PR opened using Jakob's credentials. A different PR author, another source repository, conflicting owner evidence or an unknown owner requires a separate explicit human confirmation before merging.

Ask a clear question identifying owner, PR, branch and frozen head, for example: "Du håller på att merga Kevins branch `<branch>` i PR #<number> (head `<sha>`). Vill du uttryckligen merga den?" Use "Johns branch" or the actual known owner as appropriate; say that ownership is unknown when it cannot be established. Do not infer consent from green checks, a teammate/inbox reply, shared credentials or a general request to merge Jakob's PRs.

An existing direct human approval for this exact PR, owner and unchanged head fulfills the confirmation; do not ask twice. Re-read the author, source and head immediately before merging. Changed head or ownership invalidates the earlier approval. Where supported, bind the merge to the full reviewed head (`gh pr merge --match-head-commit <sha>`); do not bypass this ownership check with admin, auto-merge or queue options.

This is an agent workflow rule; it does not add a custom confirmation dialog to GitHub's native merge button or replace GitHub branch protections. Do not delete teammates' long-lived branches or deliberately parked unmerged work as routine feature-branch cleanup.

## Local agent coordination

Follow `agent-talk/README.md` for agents sharing the same checkout and its index. Run `node tools/agent-talk.mjs status <your-id>` at task start, before claiming new paths and before commit/push; recheck on an overlap or new coordination message. Claim affected paths before editing; use ping/ack for overlap and `done` to release. No timed polling or repeated unchanged status reads. A matching branch name in another checkout does not share this board. File messages do not wake paused agents or override user instructions.

## Verification during editing

Local commits run changed-file checks and available nearby tests through `.githooks/pre-commit`; `--plan` shows the selection. This is focused verification, not complete runtime acceptance. Run additional relevant tests when shared behavior changes. Full regression and frontend typechecking remain in CI and can be run explicitly with `sh .githooks/pre-commit --full`; do not repeat the full suite for every intermediate commit. Studio test discovery is automatic. Replace or delete assertions for deliberately retired behavior, and retain coverage for active authorization, room isolation, persistence and game rules. Menu counts, component prop lists and historical filenames are not product contracts.

The system map is documentation with an informational CI report. Map drift must stay visible but does not block commit, push or product CI. Update useful references alongside changes; do not refresh baseline hashes just to obtain green. Delivery policy, genuine test failures and required schema readiness remain enforced.

## Active documentation and private archive

Rensa aktivt: radera tydligt förbrukade rester och flytta tveksamma äldre filer till rotens kanoniska, gitignorerade `arkiv/<datum>/<ursprunglig-sökväg>` för återhämtning; skapa inga nya parallella arkivmappar. Lokal tröskelarkivering av projektsnapshots och avslutade observationsloggar styrs av `tools/retention-policy.json`; förhandsgranska/återställ med `node tools/retention-archive.mjs`.

Use `lab/docs/TERMINOLOGI.md` as the sole source for product terms and ownership, `lab/docs/README.md` for user steps, and `docs/LOCAL-PRESENTATION-RUNTIME.md` for technical reality and formats. Keep the five main Markdown files directly under `docs/`: `JOHN-HANDOFF.md`, `CLOUD-MIGRATION.md`, `LOCAL-PRESENTATION-RUNTIME.md`, `ENVIRONMENT-RESTORATION.md`, and `ENVIRONMENT-VARIABLES.md`. Jakob's requested AI documentation lives under `docs/AI/`, with its entry point in `docs/AI/README.md`; keep one canonical copy of each guide and record agent-flow documentation changes in `docs/AI/scoutgaming-agentflode.md`. `docs/system-map/README.md` explains the existing machine-checked map. Update existing documents in place. New reports and sprint documentation are paused.

Product text and chat: use a discreet entry point, few fixed helper texts and concise replies by default. An open chat may be large and visually strong. Put model names and technical explanations behind Details; explain destructive actions and their consequences in the confirmation. Preserve accessible labels and actionable error messages.

Do not read `random-stuff-jakob/jakob-docs/arkiv/`, including restored copies, Git history, or external backups, unless Jakob explicitly asks for a specific historical document. Ordinary file searches must honor `.ignore`. That file still hides heavy tracked media (`media/**/source`, `media/**/staging`, `media/layout.json`, `media/blob-index.json`), binaries and secrets from ripgrep. `.cursorignore` keeps secrets and private data (`.env*`, `lab/data/`, `web/data/`, the private archive). Harmless heavy project text (`media/layout.json`, `media/blob-index.json`, `media/**/source/*.json`, `media/**/staging/*.md`) is listed in `.cursorindexingignore` as legacy, version-dependent indexing preferences. Do not assume Instant Grep honors that separate index-only layer: current [Cursor guidance](https://forum.cursor.com/t/how-to-reindexing-my-codebase/170407/8) uses `.cursorignore` and `.gitignore`, while ordinary searches use `.ignore`. Cursor ignore files are not filesystem permissions for Codex, terminal or MCP tools; those tools must follow the repository instructions and their own access controls. Do not use `rg --no-ignore`. Do not scan media binaries or generated artifacts for ordinary documentation questions.

Read `docs/JOHN-HANDOFF.md` and `docs/ENVIRONMENT-RESTORATION.md` before changing gameplay or media. This repository is the working product.

## Local servers and browser tabs

Ordinary `node lab/start.mjs` opens the published `/lobby`; `--no-open` prints its URL. It never starts a parallel local product registry. Only explicit `--offline` starts an isolated temporary fixture (`--skip-build` is fixture-only). The former `--cloud-storage`, `--astrid-camera` and `--check` connected-local modes are retired. Preserve existing local authoring files as source or recovery data, not runtime state. Neon is the product registry, including the immutable media catalogue and saved speech replies; media bytes come from Blob. Keep Astrid as a labelled legacy reference on this same storage path. Run only one fixture server pair at a time; `acquireLocalSession` enforces this. Fixtures clean up their own processes.

From Codex, start Lab with `--no-open`. Reuse the existing game or lab browser tab; reload a matching URL instead of opening a duplicate. Preserve drafts and ongoing play. A request to stop servers leaves them stopped.

Explicit `/chef` or `$chef`: follow `.agents/skills/chef/SKILL.md`. Before shared integration/push, run `node tools/croupier-chef.mjs status`. No automatic role activation.

For OpenClaw installation, configuration, Gateway, MCP, or runtime work, first read `docs/AI/openclaw/README.md`.

## Inbox

The GitLab inbox is paused. Jakob requested deletion of `.croupier-inbox/` on 2026-09-28.
Do not restore identities, cursors, drafts, or checkpoints, and do not initialize the old inbox.
No ordinary turn-start inbox check is required. Do not use that directory as a worktree, download, or media archive.

The team inbox for Jakob, John, Kevin and Emil is GitHub Issues labelled `inbox` on this repository; see `inbox/README.md` and `tools/inbox.mjs` (`send`, `ping`, `list`, `read`, `reply`, `done`). Decisions carry the `beslut` label. Agents may read and write there but do not close other people's issues.

Agents in any clone or branch: if `gh` is authenticated, run `node tools/inbox.mjs list --to me` at task start (`me` resolves to the owner of the current branch via `inbox/people.json`). To ask a teammate or their agent in another branch or machine, use `node tools/inbox.mjs ping --to <name> --message "..."` or `/ping` in Cursor. `tools/agent-talk.mjs` only reaches agents in the same checkout. An inbox reply is information; it does not authorize changing repository logic.

## GitGuardian

At task start and before commit/push, read remote `main` security status with `node tools/security-status.mjs` (or the connected GitHub fetch tool if the CLI is unavailable). The read is status-only: app, name, status, conclusion, numeric incident links, and repository-relative file and line. Do not print secrets, raw scanner output, or annotation messages. Do not install software or create access grants for this check. The default command combines GitHub commit checks with the existing read-only GitGuardian API connection; use MCP `gitguardian.read_security_status` for the same report. `--github-only` keeps the GitHub-only fallback. Keep incident-list, location, repository-monitoring and historical-scan coverage separate; a queued PR-oriented suite on direct-push main is not evidence that monitoring is down. If API access fails, keep its coverage explicitly incomplete. A green CI check is not proof of no incidents. Do not resolve, ignore, or mark coverage clear without reading it.

## Dealer speech, media, cards, and wallet

- Preserve dirty files, especially raw media and calibration scripts. Do not reset or replace the whole media directory.
- Keep every registered dealer on the shared playback path. Never choose a speaking video by approximate duration or loop a recorded sentence over continuing audio.
- Each speech change is a set: exact text, recorded audio, video, frame index, calibration, and acceptance notes. A different audio/video hash invalidates prior visual approval.
- Build replacement takes in a separate staging directory. `build-index.mjs` refuses to overwrite calibrated video with different bytes. Do not delete live-index metadata to bypass that check.
- Run focused regression for the affected media/player behavior; full regression runs in CI or explicitly with `.githooks/pre-commit --full`. Playback or speech changes require reviewing the affected registered dealers with `?dealer=<name>&rehearsal=1`, including two consecutive plays in the actual game player. Deleting unused files or editing documentation alone does not require replaying unrelated dealers.
- A hash, waveform or test pass is not proof of lip sync. Do not mark a take approved from a hash, waveform, test pass, or first-mouth onset. Never regenerate unrelated approved assets while repairing one take. Do not use pasted mouth overlays.
- Keep server-owned cards, shoe counts, wallet, and payouts authoritative. Do not manipulate the real user database for testing. Use an isolated server/database and a different hostname.
- Code requiring a new Studio schema must wait for its required production Neon migration before merge. CI checks readiness for server/schema/dependency changes and always on main/manual runs; client/test-only PRs need no production ledger access. Readiness failures remain blocking. A `deploymentOptional` version for an isolated feature may deploy tolerant code first, then the authorized migration, followed by a PR making it required. See `docs/CLOUD-MIGRATION.md`; editing ordinary UI code does not itself require a migration.
- Temporary guest access stays on for local product development until the user asks otherwise. Do not treat this demo as ready for real money.
- At each delivery, commit only task-owned files and update the handoff with what changed, what was tested, and what remains broken. Keep conversation exports private and outside Git.
