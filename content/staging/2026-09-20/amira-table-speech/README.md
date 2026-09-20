# Amira existing speech prepared for Blender-table review

The user supplied 17 completed, unmasked Amira speech recordings in
`content/staging/2026-09-19/amira-green/speak-elevenlabs/`. No generation was
submitted, no existing source file was changed, and this folder does not
install runtime assets by itself. The parent has now mounted the prepared bank
under `web/public/review/amira-green-speak/` through the shared keyed player.

## Source and quality boundary

These recordings were generated from the earlier plate job **023e8f80**,
now preserved as `plate-1k-rejected-023e8f80.png`. They were already complete
before the newer 2K plate job **72100f4f** was created. They must not be
described as speech generated from that newer plate. The parent reviewed the
native greeting mask and approved preparing the remaining recordings for
gameplay review; this is not final gameplay or lip-sync acceptance.

## Outputs

- `media/<line>.mp4`: native RGB crop above a straight grayscale alpha crop,
  H264 CRF15, no audio track. The runtime plays each exact existing paired MP3.
- `media/rest.png`: the greeting's first ready frame, masked. This is explicitly
  a fallback still. The supplied waiting job 5f2929a3 now supplies continuous idle.
- `speak.json`: version-2 review manifest, dealer `amira`, exact bank captions,
  audio hashes, source and packed-media hashes, crop, camera and measured lag.
- `audit.json`: exported-video frame count, interior face/namebadge alpha and
  audio comparisons for every line.
- `bank-contact.jpg` and `<line>/qa/`: mask inspection evidence.
- `registration.json`: approximate measured source table/hand/shoe landmarks.

## Method

All original native 1280×704 frames remain at 25 fps. No frame interpolation,
face repainting, RGB recolouring or RGB spatial resampling occurs. The fixed
native crop is `[420,0,470,464]`, measured to contain the actor across all
recordings. Display placement is a uniform 1.5× transform into 1920×1080,
offset `(0,12)`, with shared framingScale `.85`.

The existing source-chroma/Apple Vision matte pipeline supplies the outer
silhouette. Enclosed head interior at least four pixels inside the silhouette
is kept opaque when person confidence is at least 250, protecting eyes and
mouth. The known central face rectangle `[605,55,665,125]` also restores a
single low-confidence tooth point in dealerbust frame 36. The reflective
namebadge is restored inside its measured enclosed
rectangle `[662,248,718,275]`: Vision itself incorrectly assigns its interior
low confidence in several clips. This does not alter the original RGB.
Green table, shoe, prop card and marker dots are excluded.

The packed export, not only intermediate masks, is checked across every frame.
Native source and paired MP3 are decoded to mono 44.1 kHz and cross-correlated.
The manifest audio offset is the negative of embedded-audio lag. An offset
measurement is not proof of accurate generated mouth movement.

Rebuild with `/tmp/astrid-a9mask-env/bin/python build.py <line> ...`, then
`/tmp/astrid-a9mask-env/bin/python finalize.py`. Intermediate frames, Vision
masks and alpha PNGs are ignored by Git; they are reproducible from the
unchanged raw clips using `pipeline/person-mask`.

Final exported audit: **17 lines, 1,123 native frames**, minimum encoded face
alpha **253/255**, namebadge alpha at least **250/255**, and **0 ms** measured
audio lag for every line (minimum waveform correlation **0.999694**). The
17 packed clips plus ready-frame PNG total **6,467,683 bytes**. Encoded contact
sheet inspection found the eyes, mouth, hands and namebadge intact.

## Remaining review

All17 exact lines completed in the actual isolated guest4211 rehearsal; greeting,
goodluck twice, dealing, hits and settlement were exercised. These are playback
and mask checks, not final mouth/audio acceptance for every phrase. The newer
waiting source is sharper and warmer, with a different left-hand pose; that
speech boundary remains visibly imperfect. See `../dealer-table-review/`.
Fine source hair edges and native 720p facial detail retain the limitations of
the supplied footage. No new camera or identity is invented by this pipeline.
