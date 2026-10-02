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

The Git-connected landing page is [croupier-frontend.vercel.app](https://croupier-frontend.vercel.app/). Vercel project `croupier-frontend` builds this directory from `Jakeminator123/github-work`, branch `main`. `CROUPIER_GAME_URL` is stored for Production and Preview as `https://croupier-v2.onrender.com/blackjack?dealer=astrid`. Both game links open the Render-hosted game. See the [delivery handoff](../../docs/JOHN-HANDOFF.md) for the latest verified deployment and checks.

The old Vercel projects `github-work-vercel-entry`, `croupier-landing-preview-qa` and `modern-landing-page` have been removed. The separate source repository `Jakeminator123/croupier-frontend` was also removed after import; this directory is the maintained source. See the [current cloud map](../../docs/CLOUD-CURRENT-STATE-2026-09-29.md) and [frontend migration contract](../../docs/VERCEL-FRONTEND-MIGRATION.md) before changing deployments or game routing.

Import receipt: this directory came from `Jakeminator123/croupier-frontend`, `main` at commit `2ec2b3f2f7ea11c57f703f58a8fecdb540e5649c`, on 2026-09-29. That repository was previously named `modern-landing-page`.

This is a [Next.js](https://nextjs.org) landing page. `/` shows the imported design and `/demo` links to the server-owned blackjack game. `CROUPIER_GAME_URL` sets the exact target for both game links on `/demo`; without it, the existing `https://croupier-v2.onrender.com/blackjack?dealer=astrid` pilot link is used. This page has no database. The unused client-only `BlackjackGame` component is retained as upstream source but is not routed publicly.

The landing content and game links render directly. On computers, the original
fullscreen retro HTML scene and Astrid avatar intro load after hydration and
play once per full page load. Phones and tablets never import that intro or
request its videos, including iPad desktop mode. Touchscreen laptops remain
computers, and a narrow desktop window still plays the intro. Reduced motion,
restored scroll, hidden pages, browsing gestures and history navigation leave
the page usable without a late overlay. Skip/Escape, media errors and a 30 s
watchdog release the intro; teardown releases videos and WebGL resources.
The server renders a still Astrid poster and working links. Mobile,
touch devices and reduced-motion clients never import the other desktop effects:
no autoplay videos, card stream, parallax, floor, laser or WebGL renderer.
The optional desktop bundle loads only while the page is visible at >=1024px
with a fine hovering pointer, no touch points and motion allowed. Hiding the
page or losing those capabilities unmounts all effects; an in-flight import
cannot reactivate them after a resize or navigation. The floor renderer also
retains its own visibility gate. Original media remain untouched.

## Isolated Preview

The former standalone landing QA project has been removed. Use this project's Preview workflow for future design previews, explicitly configuring `CROUPIER_GAME_URL` to an isolated game target before gameplay QA: the current Preview value still points to production Render. The separate `croupier-player-preview-qa` remains because it holds the private Blob and Neon connections. Its game proxy targets `croupier-vercel-preview-qa` on Render, whose separate disk and empty SQLite test database are currently suspended. The connected Neon resources are not yet runtime databases.

For a reviewable local build, use `pnpm install --frozen-lockfile`, `pnpm exec tsc --noEmit`, and `pnpm build` from this directory. The local Croupier server session guard still applies to any interactive product run.

`npm test` runs the landing SSR and decorative-playback lifecycle regressions.
The normal build script runs these tests before `next build`; type checking
is also required separately because Next's build currently skips type errors.

Any future design changes from a separate repository need a deliberate import here with a new source commit receipt. The old Vercel project behind the original v0 integration has been deleted; do not treat that old connection as an active deployment target.
