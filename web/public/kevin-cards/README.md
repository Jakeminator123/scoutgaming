# Recorded-card renderer provenance

Imported selectively from `scout-gg/croupier`, branch `codex/astrid-languages`,
commit `0d12b7a559d328a333598b7e583b980e88d7925c` (Kevin review delivery).

- `card-table-layout.js`, `card-face-projection.js`, `card-face-tracks.js`,
  `dealer-hand-occlusion.js`, `dealer-hand-tracks.js`: unchanged source files
  from `public/`. Includes unused hole/flip measurements for provenance;
  the adapter does **not** activate those tracks without their exact media.
- `game-cards.js`: source `public/game-cards.js`; only helper imports and back
  asset URL adapted. `back-scout.png` is the source `public/media/cards/` image.
- `renderer-support.js`: minimal product DOM/color/display-total adapters.
  No game engine, wallet, provider, login or server code imported.
- `calibration.mjs`: source manifest positions/dimensions plus the eight
  standard local MP4 SHA-256 hashes. Their Git blobs matched the source films;
  `test/local-card-overlay.mjs` also checks actual bytes and the adapted
  source renderer regression cases.

The product adapter is `../local-card-overlay.mjs`; it uses server snapshots
and `requestVideoFrameCallback` media time from the existing PerformancePlayer.
Unknown hashes, seat mismatches and face-down deals use a static completion
fallback. These must not be reported as calibrated hand contact. No filmed
collection/pickup or hole-flip integration is claimed. Four dealer routing
and existing media are retained. Visual approval requires browser review;
passing these tests alone does not establish that approval.
