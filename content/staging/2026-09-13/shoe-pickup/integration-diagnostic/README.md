# Shoe registration and genuine contact import

Staging diagnostic only. No public code, metadata or source assets changed. No source is approved. Inspection: fast.mp4 frame 0 and frame 10 at native resolution plus the existing chronological sheet. The source does visibly extract paper, but still lifts it and delivers face down.

## Camera result

**fast.mp4 is 1924 × 1076, not 1920 × 1080.** Fit it uniformly: scale 0.997920998, x offset 0, y offset 3.118503119 into 1920 × 1080. Do not stretch its body to fill. For a new candidate, probe its actual dimensions instead of copying this transform.

`measure.py` reproduces the fixed staged model's outlet projection from `table-scene.mjs` and `shoe-model.mjs`: normalized **[0.635937431, 0.598854100]**, i.e. **[1221.000, 646.762]** in the 1920 × 1080 logical canvas. This is analytic code inspection, not a fresh browser read. The runtime `tableScene.registration()`/`shoeOutlet()` remains the final source of truth.

The old smooth60 manifest says **[1214.7, 595.2]**, approximately **51.95 pixels away** from the modeled outlet. Do not copy its `camera.shoeOutlet` into replacement takes. The player's `origin` argument is currently received but unused, so this mismatch is not prevented at playback.

The new source's exposed card/lip center is approximately [1226, 634] native pixels, **±12 pixels manual uncertainty**, mapped to [1223.45, 635.80]. Its distance to the modeled outlet is about 11.23 pixels, within that rough uncertainty. This is promising camera proximity, not measured grip/contact approval or a reason to translate the entire actor. `registration-overlay.jpg` labels these three different points. Source SHA and full calculations are in `measurements.json`.

## Integration path

1. Use an accepted low turn-and-slide source. Keep the existing server card and deck authoritative. Source paper is only the motion reference; never show its generated rank as the game result.
2. Extract every native frame from first exposed card through landing. Mark the four **actual visible card corners** in consistent material order, face-up state, the actual touching finger and extraction/release/landing/rest frame indices. Record uncertainty and occlusion. If a corner is hidden, mark it occluded; a tracked rectangle centered on a hand is not a measured card. Partially exposed card geometry needs a separate visibility/occlusion matte, because a full floating quad over the shoe will appear too early.
3. Uniformly transform actor RGB, measured corners, shoe point and masks by the same source-to-canvas transform. Establish camera agreement by observing the actual runtime outlet. Do not fix hand alignment by stretching the torso or shifting only the generated card.
4. Remove baked source card pixels from the actor layer, including the source card left on the felt after release. Person segmentation alone is insufficient where a card overlaps sleeve/hand. Preserve finger pixels with a dedicated G foreground matte; remove source shoe/table from the actor matte. During extraction, the shoe lip must occlude the card's still-inside region. Existing renderer layers actor/card/fingers only: a lip occlusion layer or measured card visibility mask is required for honest partial extraction.
5. Review native action first. If resampling, RGB and both masks must use the same warp and source-time mapping; source indices cannot be copied into a 60 fps manifest. Reinspect visible corners on resampled frames around extraction, turnover and release. Interpolation is not recovered native motion.
6. Pack RGB-over-R-actor/G-finger masks, bind source/packed media hashes and calibration hash. Build direct matching entry/return footage, avoiding the old multi-second preparation. Keep status review until rendered extraction, grip, release, empty return, identity and no duplicate cards are verified.
7. Existing player changes are needed for partial card visibility and for physical per-seat endpoints. Current post-release code moves the card from source release to whichever seat was requested; a seven-seat functional test is not seven filmed reaches. Do not reuse one source as if it reaches all seven destinations.

## Observation schema and importer

`import-observations.py observations.json draft.json` takes native-pixel notes and produces a **non-playable draft**, deliberately omitting `contact.measured:true`, media and calibration approval. It refuses changed source bytes, malformed events and guessed/hidden fingers; unmeasurable delivery frames remain explicit gaps. It does not interpolate or silently fill them. Use the following shape, with real measured values, not the illustrative placeholders:

```json
{
  "sourcePath": "/absolute/path/to/accepted-candidate.mp4",
  "sourceSha256": "actual source SHA-256",
  "nativeDimensions": [1924, 1076],
  "canvasDimensions": [1920, 1080],
  "frames": 73,
  "observer": "name",
  "date": "ISO date",
  "shoeOutletNative": [0, 0],
  "events": {"pickup": 1, "release": 60, "land": 63, "rest": 72},
  "observations": [{
    "frame": 1,
    "visibility": "occluded",
    "method": "manual-visible-card-corners",
    "cornersNative": [],
    "faceUp": false,
    "fingerVisible": false
  }]
}
```

These sample coordinates/events are schema placeholders only. For a fully measurable frame use `visibility: fully-measurable`, four actual `cornersNative` points, and a visible `fingerNative` point through release. Tracking hidden corners requires a separately disclosed reconstruction method and cannot be imported as visibly measured evidence.

Validation performed: diagnostic calculation and image output ran successfully; importer syntax compiled. No gameplay test claimed because no gameplay changed.
