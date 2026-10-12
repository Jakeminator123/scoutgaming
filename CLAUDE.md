# Jakob · Croupier V2

Deliver from a feature branch matching `jakob/*`, `codex/*` or `cursor/*` in `Jakeminator123/scoutgaming` (repository ID `1380630440`; `github-work` redirects here) and open a pull request to `main`. `tools/repository-policy.json` lists those patterns. The pre-push hook allows new and fast-forward updates of those branches and of `main`, and rejects deletion, force-push, tags and any other repository. Direct push to `main` remains only as an explicit admin emergency path (`node tools/push-github-work.mjs --admin-main`). Ordinary delivery is `node tools/push-github-work.mjs`: it pushes the current feature branch and prints the `gh pr create` command without creating the pull request. `tools/push-work-mirrors.mjs` is the GitHub-only compatibility entry point. Never force-push. GitHub ruleset 24642403 ("main: pull requests only") requires a pull request into `main`.

Public site: https://www.scoutgaming.tech. Apex `scoutgaming.tech` is a 308 to www.
Vercel project name: `scoutgaming`. Game engine: Render service `croupier-v2`.

- Nivå 1, internal staff: `/control`. Four groups: Studio (Dealers & klipp `/control/clips`, Bord & bakgrunder `/control/library`, Sammansättningar `/control/compositions`), Spelbolag (Bolag & team `/control/companies`, Spelrum & publicering `/control/rooms`), Drift (operations and finance administration), System (accounts, integrations, agent models and internal chat). Provspelning & logg `/control/rehearsal` is contextual to dealer/room. `/control/preview`, `/control/lanes` and `/control/activity` redirect to the canonical pages.
- Nivå 2, operator: `/partner`, `/partner/login` and `/partner/{operatorSlug}`. Menu: Översikt, Spelrum (`/partner/{slug}/rooms`), Team & behörigheter, Integration. Operators, roles and memberships are created from Bolag & team on `/control/companies`. Not done: players, transactions and reports (N2.4), chips (L4) and partner password reset.
- Nivå 3, player: `/play`, `/play/profil`, `/play/historik` and `/play/blackjack` (editable profile: display name and language; lobby shows Spelar hos from `?operator=`; Render `/blackjack?operator=` and Vercel `/play/blackjack?operator=` limit lane and dealer to the package; media acceptance in rehearsal `?dealer=<name>&rehearsal=1`).
- `/studio` is the lab service basePath, not a fourth product and not the UI name.
- Long-lived branches: `main` (pull request required), `kevin` (separate app), `john`, and `emil` (contained in `main`). `jakob-export` stays until its purpose is known. Delivery branches match `jakob/*`, `codex/*` and `cursor/*`. `test-video-jakob` was deleted 2026-10-08; its layer preview media live in `test-videoeditor/preview/site`.
- v1 checkpoint: tag `Jakobs-v1`, commit `600093e`.
- Current guide: `lab/docs/README.md`.
- Current runtime: `docs/LOCAL-PRESENTATION-RUNTIME.md`.
- Drift och leverans: `docs/CLOUD-MIGRATION.md`.
- Keep at most five Markdown files in `docs/`; update in place, no new reports.
- Preserve the server-owned game engine, wallet and media acceptance rules.
- Preserve other agents' uncommitted changes and local saved profiles/settings.
