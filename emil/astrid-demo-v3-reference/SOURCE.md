# Astrid demo V3 — reference copy

Source: [`EmaCodeHero/astrid-demo-v3`](https://gitlab.com/EmaCodeHero/astrid-demo-v3), commit `91aed7e8b99100a7b09198b3d704bd0ebde62a85` (2026-09-26).

This is a separate, unmodified copy of the upstream `public/` directory plus its `README.md` and `INTEGRATION.md`. It is **reference material**, not an enabled Croupier media pack. The active Lissabon lane still uses its existing Emil clips and shared four-dealer playback path.

The copy contains 217 MP4 files: 8 deal clips, 4 idle clips, 1 reaction, and 51 recorded speech clips each in English, Spanish, French, and Mandarin. `public/media/manifest.json` lists the clips and event mapping; the language-specific `bank.json` files preserve exact lines. `public/media/deal/` also includes card positions and masks, and `public/media/startbild.png` is the source plate. `public/app.js` and `public/kort.js` show how the standalone demo uses these assets. The upstream integration guide describes the speech service, but it is not a Croupier integration specification or proof that the claimed timings hold here.

Before using a clip in the product, compare it visually with the current take, verify exact text/audio/video/frame-index correspondence, calibrate its contact and card geometry, record acceptance per line, and test the actual player. Do not replace existing calibrated assets by copying from this folder. The standalone demo's room, chat, and card logic are not authoritative for Croupier gameplay, wallet, or payouts.
