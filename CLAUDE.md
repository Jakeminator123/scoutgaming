# Jakob · Croupier V2

Work only on `main` in `Jakeminator123/scoutgaming`. The 2026-10-06 rename
preserves repository ID `1380630440`; `github-work` redirects to this repository.
Follow `AGENTS.md` and deliver with `node tools/push-github-work.mjs`.
No force-push and no pushes to other branches. Do not create another branch
or worktree unless Jakob explicitly requests it.

Public site: https://www.scoutgaming.tech. Apex `scoutgaming.tech` is a 308 to www.
Vercel project name: `scoutgaming`. Game engine: Render service `croupier-v2`.

- Nivå 1, internal staff: `/control` (Översikt, Dealers & klipp, Klippbibliotek, Bakgrundszoner, Händelser, Förhandsvisning, Lanes, OpenClaw, Administration, Uppspelning, Probe, Guide & hjälp; `/control/tree` redirects to Händelser)
- Nivå 2, operator: `/partner`, `/partner/login` and `/partner/{operatorSlug}` (scoped snapshot; operators, roles and memberships from the Bolag card on `/control/lanes` with e-mail activation; company appearance (`branding`, table colour) read and written within the lane by `presentations.configure`; not done: players/transactions/reports (N2.4), journal table, chips, partner password reset)
- Nivå 3, player: `/play`, `/play/profil`, `/play/historik` and `/play/blackjack` (editable profile: display name and language; lobby shows Spelar hos from `?operator=`; Render `/blackjack?operator=` and Vercel `/play/blackjack?operator=` limit lane and dealer to the package; media acceptance in rehearsal `?dealer=<name>&rehearsal=1`)
- `/studio` is the lab service basePath, not a fourth product and not the UI name.
- Branches on GitHub: `main`, `kevin`, `john`, `emil` only. `test-video-jakob` was deleted 2026-10-08; its layer preview media live in `test-videoeditor/preview/site`.
- v1 checkpoint: tag `Jakobs-v1`, commit `600093e`.
- Current guide: `lab/docs/README.md`.
- Current runtime: `docs/LOCAL-PRESENTATION-RUNTIME.md`.
- Drift och leverans: `docs/CLOUD-MIGRATION.md`.
- Keep at most five Markdown files in `docs/`; update in place, no new reports.
- Preserve the server-owned game engine, wallet and media acceptance rules.
- Preserve other agents' uncommitted changes and local saved profiles/settings.
