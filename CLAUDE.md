# Jakob · Croupier V2

Deliver from a feature branch matching `jakob/*`, `codex/*` or `cursor/*` in `Jakeminator123/scoutgaming` (repository ID `1380630440`; `github-work` redirects here) and open a pull request to `main`. `tools/repository-policy.json` lists those patterns. The pre-push hook allows new and fast-forward updates of those branches and of `main`, and rejects deletion, force-push, tags and any other repository. Direct push to `main` remains only as an explicit admin emergency path (`node tools/push-github-work.mjs --admin-main`). Ordinary delivery is `node tools/push-github-work.mjs`: it pushes the current feature branch and prints the `gh pr create` command without creating the pull request. `tools/push-work-mirrors.mjs` is the GitHub-only compatibility entry point. Never force-push. GitHub ruleset 24642403 ("main: pull requests only") requires a pull request into `main`.

Public site: https://www.scoutgaming.tech. Apex `scoutgaming.tech` is a 308 to www.
Vercel team and project: `scoutgaming`. Game engine: Render service `croupier-v2`.

- Read `AGENTS.md` for the shared development rules and authority boundaries.
- Nivå 1, internal staff: `/admin`. Nivå 2, operator: `/partner`. Nivå 3, player lobby: `/lobby`. Continue new UI work on those surfaces; working `/control`, `/play` and game-launch routes remain compatible during the transition.
- Product model source: `lab/docs/TERMINOLOGI.md`. Operator → games → operator-owned room/background choices, with compatible allowed tables and dealers. Current stored rooms bind one game. Dealer clip categories organize media; they do not identify people or choose runtime playback.
- Visual layers: background → dealer → table, followed by server-owned game overlays. Shared composition edits and room-specific appearance writes have different scopes.
- `lab/` is active source, `/studio` is its deployed technical basePath, and `lissabon-stream-lane` remains required compatibility configuration. Preserve Astrid speech/media and saved data when simplifying old names.
- Long-lived branches: `main` (pull request required), `kevin` (separate app), `john`, and `emil` (contained in `main`). `jakob-export` stays until its purpose is known. Delivery branches match `jakob/*`, `codex/*` and `cursor/*`. `test-video-jakob` was deleted 2026-10-08; its layer preview media live in `packages/presentation/preview/site`.
- v1 checkpoint: tag `Jakobs-v1`, commit `600093e`.
- Current guide: `lab/docs/README.md`.
- Current runtime: `docs/LOCAL-PRESENTATION-RUNTIME.md`.
- Drift och leverans: `docs/CLOUD-MIGRATION.md`.
- Keep the five main Markdown files directly in `docs/`; Jakob's requested AI documentation is collected under `docs/AI/README.md`; record changes in `docs/AI/scoutgaming-agentflode.md`. `docs/system-map/README.md` explains the existing map. Update in place, no new reports.
- Keep chat discreet, with few fixed helper texts and concise replies. Put technical details behind Details; show destructive-action consequences in the confirmation.
- Preserve the server-owned game engine, wallet and media acceptance rules.
- Preserve other agents' uncommitted changes and local saved profiles/settings.
