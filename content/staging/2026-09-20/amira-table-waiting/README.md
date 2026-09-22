# Amira native waiting loop 5f2929a3

Prepared only the source explicitly supplied by the user:
`content/staging/2026-09-19/amira-green/waiting/source.mp4`, job
`5f2929a3-384e-4632-862c-96b1a3f6bfb1`, source SHA256
`2b36e7ad47595f20cb98431fa7613da525f7513729a7a23e7667a7acb67957cf`.
No generation, source change or folded-pose substitution. The parent installed
the reviewed loop in `web/public/review/amira-green-waiting/`.

`idle.json` uses the shared player's explicit `mode: "loop"`. The runtime uses
the packed movie, manifest and ready crop. Staging also includes the actual
masked full-frame ready image
`media/rest-full.png`, as well as ready crops from native frames 0 and 120.

All **121 native 1920×1080 frames at 24 fps** are retained. Packed RGB-over-alpha
media is **706×1392**, crop `[630,12,706,696]`, 1,438,035 bytes. Native RGB has
not been retimed, recoloured, interpolated, scaled or repainted. The display
uses the existing 1920×1080 virtual camera with `.85` framing and a uniform
**(+11,+1) native-pixel translation**, aligning the head with the older speech
recordings. Camera crop placement is therefore `(641,13)`, scale 1.

The head and namebadge interior guards preserve opaque eyes, mouth and badge.
Every exported frame passed the minimum-alpha check at 250/255 or higher in
the measured interior regions. Green table, shoe and prop card are excluded.

`qa/contact.jpg` shows the full motion sampled every ten frames. Amira breathes,
blinks, looks to her left and returns to the same ready pose. First/last native
head displacement measured below 0.6 pixels. The encoded composite last→first
mean RGB absolute difference is 1.204/255, versus maximum ordinary adjacent
frame difference 1.409/255. This is a close source loop, not a claim of invisible
gameplay transitions. No crossfade or synthesized bridge was added.

**Speech boundary remains imperfect.** This waiting source uses the newer 2K
plate; the 17 supplied speech recordings use the earlier 1K plate. The newer
source is sharper and warmer, and jacket/left-hand poses differ. Independent
gradient correlation measures waiting minus speech face/hair `(-11,-1)`,
jacket `(-5,-16)`, left hand `(+9,-25)` and right hand `(+2,-3)` native pixels.
Only the face alignment translation is applied. It cannot eliminate the
remaining pose, detail and colour differences. See
`qa/registration-and-seam.jpg`, `uniform-translation-fit.json` and
`registration-measurements.json` (the latter includes low-confidence phase
correlations that must not be treated as a precise camera fit).

The parent owns the loop-boundary speech hold, integration, rendered motion
review and user-visible acceptance. `build.py` reproduces the matte using
existing `frames/` and `vision/` extracted from the exact source with FFmpeg
and `pipeline/person-mask`. Intermediate frames/masks are ignored by Git.

Rendered guest4211 verification: eight loop wraps, greeting and consecutive
goodluck plays, a complete center-seat round with hit/bust/settlement and return
to moving idle. Speech waits for the matching forward-facing loop endpoint;
this can add up to5.04s before a spoken line. That delay and the source-quality
difference above remain limitations, not invisible-transition acceptance.
