# Croupier landing page

This directory is a reviewed copy of [`Jakeminator123/croupier-frontend`](https://github.com/Jakeminator123/croupier-frontend) `main` at commit `2ec2b3f2f7ea11c57f703f58a8fecdb540e5649c`, imported into the Croupier product repository on 2026-09-29. The source repository remains available for v0 design work; changes there do not automatically update this copy.

This is a [Next.js](https://nextjs.org) landing page. `/` shows the imported design and `/demo` links to the server-owned blackjack game. `CROUPIER_GAME_URL` sets the exact target for both game links on `/demo`; without it, the existing `https://croupier-v2.onrender.com/blackjack?dealer=astrid` pilot link is used. This page has no database. The unused client-only `BlackjackGame` component is retained as upstream source but is not routed publicly.

## Isolated Preview

The separate Vercel project `croupier-landing-preview-qa` uses this directory as its root and the Next.js framework preset. Its Preview deployment is linked at build time to the separate `croupier-player-preview-qa` game Preview through `CROUPIER_GAME_URL`; the game Preview proxies only selected player paths to `croupier-vercel-preview-qa` on Render. The Render test service has its own hostname, disk and empty SQLite database. The Neon Preview resource is connected to the game Preview project but is not yet the game's database. Both test projects remain isolated from Production. The imported app also serves the existing `github-work-vercel-entry.vercel.app` Production landing; its `/demo` links to the unchanged `croupier-v2` Render pilot. That Vercel project is currently deployed manually from this directory and has no Git integration.

For a reviewable local build, use `pnpm install --frozen-lockfile`, `pnpm exec tsc --noEmit`, and `pnpm build` from this directory. The local Croupier server session guard still applies to any interactive product run.

Design changes made through [the original v0 project](https://v0.app/chat/projects/prj_3zsY4c8kKQMp9CeHuwHVgy1tFLAs) still land in the source repository. Import those changes here deliberately with a new source commit receipt; they do not flow into the monorepo automatically.
