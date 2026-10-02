# Amira live composite correction

Scope: improve supplied keyed Amira speech and waiting against the existing
Blender table and clear golden room. No regeneration, credits, re-keying, source
media replacement, camera/actor scale change, or audio recalibration.

Runtime constants: `web/public/review/amira-composite/profile.json`.
Contact data: sibling `contacts.json` (four source-tracked anchors, all 1,123
speech frames and 121 waiting frames, hash-bound to the actual packed media).
Minimum template confidence exceeds .966. A three-frame median removes tracker
jitter; it does not edit the performer.

## Applied order and limits

- The Amira table key is now soft/frontal/above, with VSM shadows. Source direction
  is visually inferred, not a photometric reconstruction; `light-direction.svg`
  records that distinction. PlateCam and geometry are unchanged.
- Existing matte cleanup remains; profile uses one-pixel erosion, two-pixel
  feather and a 2.5-pixel warm room/felt rim. RGB is not blurred. No new alpha key.
  Follow-up hair request adds a localized3.4px feather at75% strength and19%
  wrap, scaled to identical display width across speech/waiting. Dark pixels in
  the head/hair region only; no face/eye RGB blur. The source matte is unchanged.
- Fixed source-family luminance curves precede saturation and RGB gains. The
  forehead/cheek ROI speech-to-waiting median-luma gap falls from .069273 to
  .012310. This is an ROI measurement, not proof every highlight matches. We
  preserve material differences rather than clipping all skin to dark felt.
- Native-frame hand/forearm contact shadows and a softened lower-actor cast
  silhouette follow playback. Cast uses nine Gaussian-weighted alpha samples,
  fades away from contact, and is restricted to the table surface.
- Subtle forearm/collar burn, lower-edge spill, and common 1.5% grain, tone and
  vignette finish. Actor/shadows use WebGL; shared scene tone uses a GPU browser
  backdrop filter plus overlay (not a full-scene WebGL postprocessing target).
- No fabricated source detail. The older 1K speech remains softer than the 2K
  waiting source. Source pose differences need the separate silent joins in
  `../amira-transitions/`; grading alone does not remove that cut.

## Evidence

`before-greeting.png` and `after-greeting.png` are the same native source frame 0
at 1280x720, rendered by the real actor and table modules. Individual hair,
shoulders and hands crops are included, plus `before-after-crops.png`. Evidence
enlargement is nearest-neighbour only. `scene-samples.json` records room/felt
sampling and `grade-measurements.json` the ROI calculation.
`hair-softening-comparison.png` isolates the final hair-edge follow-up. Browser
captures are JPEG bytes despite the PNG filename; tiny interior pixel differences
are not a lossless shader measurement. Native source pixels remain unchanged.

`all-lines-runtime.json`: all17 lines played, greeting/goodluck repeated; no
shader/playback error. `after-live-speaking.png` shows speech frame3 and matching
contact frame3. Actual guest round: center 3H/KC (13), Hit, bust, settlement
stake5/return0, balance995; returned to bets. `settlement.png` records the result.
Vera, Mei and Astrid consecutive-goodluck regression evidence is included.

Measured waiting frame pacing: median16.7ms/p9518.0ms over330 post-warmup browser
animation frames; mean actor CPU submission approximately1.11ms. This is one
machine/sample, not a universal60fps guarantee or a change to native24/25fps.
Final shared-player joins were retested separately in `../amira-transitions/`.

Full pre-commit, dealer-sync `--probe`, and focused source/grade/contact checks
passed. Probe baseline still lists legacy missing takes; it is not lip-sync
acceptance. Local isolated guest4211 only; no live database or production change.
