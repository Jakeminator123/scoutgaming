# Jakob · Croupier V2

Work only on `main` in `Jakeminator123/scoutgaming`. The 2026-10-06 rename
preserves repository ID `1380630440`; `github-work` redirects to this repository.
Follow `AGENTS.md` and deliver with `node tools/push-github-work.mjs`.
No force-push and no pushes to other branches. Do not create another branch
or worktree unless Jakob explicitly requests it.

Public site: https://www.scoutgaming.tech. Apex `scoutgaming.tech` is a 308 to www.
Vercel project name: `scoutgaming`. Game engine: Render service `croupier-v2`.

- Nivå 1, internal staff: `/control`
- Nivå 2, operator: `/partner` and `/partner/{operatorSlug}`
- Nivå 3, player: `/play` and `/play/blackjack`
- `/studio` is the lab service basePath, not a fourth product and not the UI name.
- v1 checkpoint: tag `Jakobs-v1`, commit `600093e`.
- Current guide: `lab/docs/README.md`.
- Current runtime: `docs/LOCAL-PRESENTATION-RUNTIME.md`.
- Drift och leverans: `docs/CLOUD-MIGRATION.md`.
- Keep at most five Markdown files in `docs/`; update in place, no new reports.
- Preserve the server-owned game engine, wallet and media acceptance rules.
- Preserve other agents' uncommitted changes and local saved profiles/settings.
