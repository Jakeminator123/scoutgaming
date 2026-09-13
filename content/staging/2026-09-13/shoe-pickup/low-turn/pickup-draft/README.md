# Pickup masks — staging draft, not approved

Native source n0–66, 1920×1080. `pickup-rg/0000.png` … `0066.png`: R actor alpha, G connected visible hand skin, B zero. Original RGB is unmodified. `build-pickup.py` reproduces outputs from `mattes/source`; `SHA256.json` fingerprints mask bytes and script.

Source-specific removal regions separate red-back / blurred edge / face-up card from the hands. The shoe is removed and real connected RGB skin restored. Thin pink border bridges are opened locally in the skin candidate, then detached components removed. No absent fingers or occluded anatomy are filled. A source-specific rail exclusion handles the background bar exposed while hands lift.

`observations.json` gives removal regions for every frame and labels interpolated bounds. These are deliberately broad visible-vicinity estimates, not four card corners. `dense-turn-boundaries.json` gives approximate visible distal corners at n36–39/n43–45 and visible line estimates at n40–42, with 8px uncertainty. Hidden corners remain null. Do not use these as measured rigid-card tracking or contact calibration.

All 67 source/cleaned native-frame crops reviewed in review-0 through review-5. First draft retained pink card borders across n13–37; subsequent passes remove thin bridges and disconnected fragments. Source shoe/table lettering are absent in reviewed hand crops. The dense n36–45 transition preserves the visible hands, but n40–42 has original motion blur mixing fingers and edge; no exact anatomical boundary is asserted.

Remaining risks: pale fingertip / card-border fragments can remain adjacent to contact; conservative skin classification can omit shadow/highlight boundary pixels. The torso cutoff and sleeve edge still depend on RawVision confidence. This task provides candidate masks only, not final compositing, game-colour match, continuous playback acceptance or a full-round test. Staging packaging permitted for inspection; no public integration approval.
