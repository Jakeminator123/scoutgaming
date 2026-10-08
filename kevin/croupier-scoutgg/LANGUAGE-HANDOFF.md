# Dealer languages handoff

This work belongs to the original Astrid task (01a089d2-0743-7fa2-8827-24888c70a8a2).
It is isolated on `codex/astrid-languages`, based on connector commit `7c5be4a`.
The other active task, `hej` (01a0dad5-b32d-79d1-9581-1a1ee00700ea), owns BO integration. Kevin authorized this task to publish the game and GitLab branch on September 28. Coordinate releases; do not implement the language engine a second time.

## Included

- Settings > Dealer language: 🇬🇧 English, 🇪🇸 Español, 🇫🇷 Français, 🇨🇳 中文. Interface labels remain English.
- Language belongs to the shared table, persists in SQLite, and can be changed by a seated player before any bets. Locked during betting/rounds so all viewers share the same clip duration and card clock.
- Game announcements use the matching recorded language and exact canonical variant (including sidebet_2). Preloading follows the selected language. Plan/audit metadata includes language.
- Cartesia receives the table's language. The existing guarded model response IDs remain canonical; fixed translations happen after validation. Arbitrary model text still cannot become spoken output.
- No changes to dealer geometry, card size, contact/occlusion calibration, hole/flip assets, John layout or BO branding behavior.
- 153 original ES/FR/ZH files copied byte-for-byte from `EmaCodeHero/astrid-demo-v3` commit `24d809fd47bf89c359c4e6d80ffdcbe15d45118c`. There are 51 clips per language, including the 51 English clips already present. Runtime retains the existing 11 permitted game events per language; unused variants remain in the media registry as legacy/training.

## Evidence

- `node --test test/*.test.mjs`: 112 passing, 0 failing.
- Language tests cover all four banks, same variants, localized preload, persisted shared state, invalid/spectator/round changes, clip-duration clocks, hole/reveal preservation and TTS calls with mocked providers.
- `review/2026-09-28-languages/media-verification.json`: hashes, audio/video streams and durations for all 153 imported clips. Five videos end ~83ms before their audio; the original manifest includes that tail correctly. Zero missing audio/duration errors.
- Browser: joined by selecting box 4 on the felt, switched FR -> ZH -> ES, buffering completed each time. Completed a Spanish round, stood on 15, dealer revealed and reached 21, receipt returned $0 against a $5 demo stake. Returned to idle with no media errors.
- Live TTS/lipsync has NOT been exercised. Providers are disabled locally. No generation credits were used for this validation. Deployment is a separate checkpoint from these local checks.
- Integrated Emil's `133f2e4` update from `origin/main`, preserving removal of the blink idle clip. All 112 tests pass after integration.

## Local preview

`http://127.0.0.1:8640/?session=language-review`
Server uses this worktree and `/tmp/astrid-language-qa.sqlite`, with RUNPOD/CARTESIA/GEMINI keys set to `local-qa-disabled`. Existing production and other development ports are untouched.

## Follow-up owned by the other task

- Add the same selector to the BO clip preview, reusing `repliker_sprak` and the registry's `language`/`baseId` fields. Deal/idle files are language-neutral.
- Reuse this branch before further language edits; do not replace the whole manifest with V3's older dealing manifest.
- Keep reviewed response selection and privacy restrictions. Fixed translations are in `server/dealer-responses-localized.mjs`; UI labels such as Demo information remain English intentionally.
- Verify the deployed language clips and any authorized paid live voice test separately.

## Emil: merge to main after Kevin's review

Repository: `EmaCodeHero/astrid-lipsync-demo-2`. Source: `codex/astrid-languages`. Target: `main`.
The corresponding branch in `scout-gg/croupier` is a delivery copy, not the target for this merge.

1. Open the merge request from `codex/astrid-languages` to `main`. Assignee: `EmaCodeHero`. Reviewer: `Kevinnegash1` (Kevin Negash).
2. Review the whole diff: it includes the existing shared game, John UI, hole/flip integration and the new language banks. It is broader than just a language selector.
3. If `main` has advanced, merge it into the source branch, resolve conflicts there, then run `node --test test/*.test.mjs` and `git diff --check` again. Push to the source branch, never directly to `main`.
4. Kevin reviews the browser experience and changes. Keep the MR draft until he explicitly approves the current revision. If GitLab prevents author self-approval, record Kevin's review in a comment; do not describe it as an enforced approval rule.
5. After approval, mark ready, check the latest pipeline/test evidence, then use GitLab's Merge button. Do not enable automatic merging before review.
6. Deployment and merge are separate: preserve production data and environment configuration. Do not run `drift/deploy.sh` against the Scout service; it targets a different installation. Follow `SCOUT-DEPLOYMENT.md` and coordinate with the BO owner.
