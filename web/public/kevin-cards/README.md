# Recorded-card renderer provenance

Imported selectively from `scout-gg/croupier`, branch `codex/astrid-languages`,
commit `0d12b7a559d328a333598b7e583b980e88d7925c` (Kevin review delivery).

- `card-table-layout.js`, `card-face-projection.js`, `card-face-tracks.js`,
  `dealer-hand-occlusion.js`, `dealer-hand-tracks.js`: unchanged source files
  from `public/`. Includes hole/flip measurements, now activated with their exact source media.
- `game-cards.js`: source `public/game-cards.js`; only helper imports and back
  asset URL adapted. `back-scout.png` is the source `public/media/cards/` image.
- `renderer-support.js`: minimal product DOM/color/display-total adapters.
  No game engine, wallet, provider, login or server code imported.
- `calibration.mjs`: source manifest positions/dimensions plus the ten
  standard local MP4 SHA-256 hashes. Their Git blobs matched the source films;
  `test/local-card-overlay.mjs` also checks actual bytes and the adapted
  source renderer regression cases.

The product adapter is `../local-card-overlay.mjs`; it uses server snapshots
and `requestVideoFrameCallback` media time from the existing PerformancePlayer.
Unknown hashes, seat mismatches and unmeasured variants use a static completion
fallback. These must not be reported as calibrated hand contact. No filmed
collection/pickup integration is claimed. Four dealer routing
and existing media are retained. Visual approval requires browser review;
passing these tests alone does not establish that approval.

## Hole/flip and preparation — 2026-09-29

Source `public/media/deal/hole.mp4` and `flip.mp4` copied byte-for-byte into
`emil/dealklipp-v1/deal/deal_hole` and `deal_flip`. Both 1080×1920, 24 fps;
67 and 56 frames. Full hashes are in `calibration.mjs` and the generated
manifest. The card cursor uses first-visible frame 45 for hole and 31 for flip.
Only a committed server reveal can select the flip; client rank/suit are ignored.

`verified-video-buffer.mjs` and PerformancePlayer adapt the ideas from source
`video-buffer.js` / `video-preloader.js`: LRU cache and one inactive decoder.
The implementation retains SHA-256 checks, independent abort ownership, pinned
URLs, 15-second fetch timeout and one-clip lookahead. 96 MiB cache target;
currently playing/prepared clips are pinned until released. Preloading is
limited to standard films for the already committed opening sequence; it does
not call selectors, models or game commands. A different selected variant
replaces the preparation. No iOS verification bypass is imported.

See `docs/JOHN-HANDOFF.md` for browser evidence and remaining limits.
