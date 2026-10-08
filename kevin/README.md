# Kevin's work

## croupier-scoutgg/

The blackjack game that runs at https://croupier.scoutgg.dev, as of release `1bd31c6` (8 October 2026).
It is a separate codebase from the rest of this repository: Emil's Astrid demo with Kevin's dealers on top.
Nothing in this folder is imported by the repository's apps, lanes or tests.

| | |
|---|---|
| Source | GitLab `croupier-lang-game`, branch `claude/dragge-on-live`, commit `1bd31c6` |
| Live | https://croupier.scoutgg.dev (password protected), server `scout-hel1`, service `astrid-scout-demo` |
| Dealers | Astrid (Emil's filmed default), Dragge (H3's improved Dragan, KLARA plates of 7 October), Paow (new, text chat only) |

What is in it:

- `public/dealers.js`: dealer registry. Dragge and Paow are ready-pose dealers: rest (VILA), hand on the card in the shoe (REDO), one short take per card, back to rest. Each take ships in four run variants (`take`, `-i`, `-u`, `-iu`) and `readyVariant()` picks one from the neighbouring plan steps.
- `public/dealer-layer.js`: live WebGL keying of the green-screen dealer above the game cards.
- `public/media/dealers/dragge/v2`, `public/media/dealers/paow/v2`: the baked variants, landing frames and card tracks (`meta.json`).
- `public/media/dealers/rooms-v2`: four rooms with the shoe where the KLARA plates draw from.
- `public/media/dealers/dragge/repliker`: Dragge's 132 lip-synced lines (Swedish and English) on avatar `dragan_vila2x`.
- `server/`: game server, shared table, Dragge/Paow chat with guardrails and memory (`dealer-chat.mjs`), Dragge's live voice and lip-sync (`dragge-voice.mjs`, RunPod endpoint `fxwf3rgwme748i`).

Run it locally (no AI keys needed for the cards, clips, rooms and UI):

```sh
cd kevin/croupier-scoutgg
npm install
RUNPOD_API_KEY=local-qa-disabled RUNPOD_ENDPOINT_ID=local CARTESIA_API_KEY=local GEMINI_API_KEY=local npm start
# then open http://localhost:8600/?dealer=dragge or ?dealer=paow
```

Tests: `node --test test/*.test.mjs` inside the folder.

The media build scripts (green-screen keying, run variants, rooms, lip-sync) live outside this repository in
`croupier-dealer-dragge/` (`build_ready_dealer.py`, `rooms_v2.py`, `lipsync_lines.py`).

## deploy/: push to `kevin` = live on croupier.scoutgg.dev

Once `kevin/deploy/install.sh` has run on Kevin's Mac, every push to branch `kevin` that changes
`kevin/croupier-scoutgg/` goes live within a few minutes. Pushes that only touch other folders deploy nothing.

- `autodeploy.sh` (launchd job on the Mac, every 60 s): fetches `kevin` into its own blob-less clone, sends only
  the changed files to scout-hel1 and drives the server half. Log: `~/Library/Logs/croupier-autodeploy.log`.
- `server-release.sh` (scout-hel1, `/opt/astrid-scout-demo/bin/release-from-github.sh`): builds the release
  next to the live one (`/opt/astrid-scout-demo/releases/gh-<commit>`), runs `node --test`, waits for a table
  without a round in play, switches, health-checks and rolls back if the new release is unhealthy.
- Failed tests or a rollback leave the previous release live and reach Kevin as a Mac notification and a Slack DM.
- The Mac does the watching because the repository has no deploy key or Actions secret for scout-hel1. It has
  to be awake; a push made while it sleeps goes live when it wakes. A read-only deploy key from Jakob would let
  the server watch by itself.
- Live release: `cat /opt/astrid-scout-demo/current/.github-release` on scout-hel1 (commit, tree, time).
- Stop: `launchctl bootout gui/$(id -u)/dev.scoutgg.croupier-autodeploy`.
