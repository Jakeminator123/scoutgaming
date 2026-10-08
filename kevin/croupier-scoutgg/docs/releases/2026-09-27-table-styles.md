# Current Astrid table styles

The current shared-game UI has Byt bord with Privé, Emerald Club, Midnight, Burgundy and a custom felt colour. These are local visual themes of the same table; they do not navigate to the retired 3D application, create a different multiplayer room or modify game state. Selection persists in localStorage.

A GPU overlay samples the already decoded visible video and masks the dark felt, preserving the rail, bright lettering, cards, skin and upper scene. No duplicate video or network media request. Canvas width is capped at 720 pixels; video-frame callbacks drive uploads, with a fallback for older browsers. Original mode is off with no animation loop. Hidden tabs stop updates. Missing WebGL/context loss falls back to the original picture. This colour-key mask is matched to the current Astrid media; a new dealer or a new camera requires mask review.

Validation: 94 tests passed. Mobile 393x852 browser verified joined demo player, $5 bet and active dealing with Emerald colour; hand/skin and card faces visibly preserved. Theme selection persists across reload. Desktop and mobile selector rendered, source video remained the current shared-game clip. This is desktop browser responsive verification, not a physical iPhone performance acceptance result.

Deploy only public/index.html, public/table-style.js, public/table-style.css to existing 5b07f6a runtime. The separate local OpenClaw backend changes are not part of this deployment. Backup directory: /opt/astrid-scout-demo/table-style-backup-20260927. No restart, database or media mutation.

## Variant B shape option

Added separate Original / Variant B shape control. Variant B is rendered from the user-confirmed original Blender scene, preserving its camera and table geometry. Removed baked actor, circles, rule text and shoe from the plate; the current video foreground supplies hands, sleeves, shoe and text, and the game retains its existing cards and betting targets. Colour choices remain independent and shape persists. Camera-frame coordinates are mapped to the current video. Source/render hashes are in public/media/table-styles/variant-b.json; tools/render-rounded-table.py reproduces the plate from the original blend.

Local mobile browser: joined isolated rounded-qa session, $5 bet, full initial deal and dealer reveal, preserved hand/card rendering and no console errors. Original/rounded control and Emerald theme verified. All 94 tests passed. This is not physical iPhone performance acceptance. Deployment adds only the plate/metadata and updates the two style files; backups under /opt/astrid-scout-demo/rounded-table-backup-20260927.

## Extended felt option

Added “Långt · Utan kanter” as a third shape. The shader samples the clean central felt from the existing Variant B plate, extending it across the lower frame so the front and side rails are outside the view. Dealer, foreground mask and game overlays retain their original coordinates. All colour options and saved shape selection remain available, without another asset download or video decoder.

Verified the rendered option at desktop and 393x852 mobile viewport, neutral and Emerald felt, persisted selection after reload, and no browser warnings/errors. JavaScript syntax check passed. This scoped verification does not claim another full dealing sequence or physical iPhone test. Deployment updates only table-style.js and table-style.css, with a separate extended-table backup.
