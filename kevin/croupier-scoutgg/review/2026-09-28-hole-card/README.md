# Filmed hole card and flip

Source: EmaCodeHero/astrid-demo-v3, 24d809fd47bf89c359c4e6d80ffdcbe15d45118c, leverans-kevin/2026-09-28_dolt-kort.

hole.mp4 SHA-256 a7f2629f471cbab914faef8ddcb59a3f788f4dc688db1a4cd946462b10b49c58
flip.mp4 SHA-256 40f478e650da84a8f2ca30da7b65c5ebea208ef2a543307d64aaad2dae140341

Original bytes, 1080x1920/24fps. No re-encode. build-tracks.py appends only the two new source-frame tracks and preserves all eight existing tracks. Full metrics remain in the hand-occlusion measurements.json. Source contours are calibration evidence, not independent rendered approval.

Rendered local checks used public/review/card-contact.html with the actual game renderer, plus full shared-engine desktop/mobile rounds. Hole at frames 33 and 45: old upcard slides to x474, the filmed hand stays in front, and opaque back matches the source prop. Flip at frames 29 and 31: no drawn back covers the lifted prop, rank appears when flat, upcard remains stationary. Unit tests cover no extra draw, hidden rank exclusion and ordinary/immediate-blackjack plans.
