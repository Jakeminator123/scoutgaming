# Croupier landing page

## Lab entry points

The main site exposes operator shortcuts: `/labb` opens the existing Render
Lab at `/studio/`, `/labb/filmer` opens its video bank, `/labb/zoner` opens
background zones, and `/labb/guide` opens the guide. These temporary HTTP 307
redirects keep Render's existing login and upload handling. They do not host
the Lab on Vercel or migrate its files to Blob. These links target the live
Lab, including if this directory is manually deployed as a design preview;
they are not links to an isolated Lab test environment.

## Current deployment — 2026-09-29

The Git-connected landing page is [croupier-frontend.vercel.app](https://croupier-frontend.vercel.app/). Vercel project `croupier-frontend` builds this directory from `Jakeminator123/github-work`, branch `jakemanator123-github-work`. The first deployment from `d78eb4cb` was READY, and `/` and `/demo` were checked. `CROUPIER_GAME_URL` is stored for Production and Preview as `https://croupier-v2.onrender.com/blackjack?dealer=astrid`; a later push (`d8d4b707`) automatically produced READY deployment `dpl_9GcmrpbHQ91oTJwnBYUuvV5DzxDZ`. Both game links still open the Render-hosted game.

The older [github-work-vercel-entry.vercel.app](https://github-work-vercel-entry.vercel.app/) also serves the imported landing page, but its Vercel project is deployed manually and has no Git connection. The separate Vercel project `modern-landing-page` was deleted on 2026-09-29 after Jakob's explicit confirmation; a CLI lookup then confirmed that the project no longer exists. Its former address was `modern-landing-page-kohl-xi.vercel.app`. The source GitHub repository was not deleted. See the [current cloud map](../../docs/CLOUD-CURRENT-STATE-2026-09-29.md) and [frontend migration contract](../../docs/VERCEL-FRONTEND-MIGRATION.md) before changing deployments or game routing.

This directory was imported on 2026-09-29 from [`Jakeminator123/croupier-frontend`](https://github.com/Jakeminator123/croupier-frontend), `main` at commit `2ec2b3f2f7ea11c57f703f58a8fecdb540e5649c`. That source repository was previously named `modern-landing-page`. This commit is the import receipt; changes to the separate source do not automatically update this copy.

This is a [Next.js](https://nextjs.org) landing page. `/` shows the imported design and `/demo` links to the server-owned blackjack game. `CROUPIER_GAME_URL` sets the exact target for both game links on `/demo`; without it, the existing `https://croupier-v2.onrender.com/blackjack?dealer=astrid` pilot link is used. This page has no database. The unused client-only `BlackjackGame` component is retained as upstream source but is not routed publicly.

## Isolated Preview

The separate Vercel project `croupier-landing-preview-qa` received a manual Preview deployment of this directory using the Next.js preset. That deployment was linked at build time to the separate `croupier-player-preview-qa` game Preview through `CROUPIER_GAME_URL`. On 2026-09-29 this URL was also saved in the QA landing project's Production/Preview/Development settings and read back with an exact match; future builds will use it. The game Preview proxies only selected player paths to `croupier-vercel-preview-qa` on Render. The Render test service has its own hostname, disk and empty SQLite database and is currently manually suspended. The Neon Preview resource is connected to the game Preview project but is not yet the game's database. Both test projects remain isolated from Production and have no Git connection.

For a reviewable local build, use `pnpm install --frozen-lockfile`, `pnpm exec tsc --noEmit`, and `pnpm build` from this directory. The local Croupier server session guard still applies to any interactive product run.

Any future design changes from a separate repository need a deliberate import here with a new source commit receipt. The old Vercel project behind the original v0 integration has been deleted; do not treat that old connection as an active deployment target.
