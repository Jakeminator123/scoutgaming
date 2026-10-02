# Astrid speech mask and transition review — 2026-09-20

Source clarification: use the post-reset elevated Creatify Aurora takes, specifically
`take-goodluck-creatify-aurora.mp4`, not the pre-reset frontal Higgsfield bank.
The user confirmed the camera angle. No generation, camera change or old-bank restore.

All 16 remaining speech masks now use the greeting's opaque enclosed head interior
repair. 944 frames, 13,760 repaired alpha pixels. Source RGB, registration, audio,
crop and frame count retained. Encoded repaired alpha is >=250 in every affected
pixel; dealerbust/farewell/placebets/sidebet need CRF0 to avoid alpha codec ringing.
`all-lines-report.json` and the four all-lines QA sheets record the checks.

Each of the 17 original recordings now has an entrance and exit motion map.
Bidirectional DIS flow, bounded to 60 source pixels, bridges the ~20px head and
6–10px hand pose difference over 220ms using premultiplied RGB/alpha interpolation.
The entry captures the currently held ready idle; exit seeks and paints idle frame0
before revealing it. Recorded speaking frames and paired mp3 are unchanged.
Flow maps are measured against idle frame0; small breathing/blink differences in
other held frames remain possible. This is an interpolated join, not newly filmed
motion or a blanket visual acceptance of every source's face/quality.

Runtime review used isolated guest port4211, with the actual rehearsal voice.say
path. All17 lines played twice and returned to idle. Contact sheets inspected
source/matte eyes and all entry/exit face intermediates. Runtime screenshots and
logs are under hardware-review/joins. Goodluck frame series includes entrance,
speech, exit and resumed idle. A CUA clipped capture returned one black thumbnail;
subsequent full-viewport screenshots were used for per-line review.

A repeated resume/play race found during QA was fixed. Greeting/goodluck/bust were
rerun twice afterward without new warnings/errors. The first gesture's automatic
greeting no longer silently drops a selected review, and the rehearsal caption
now uses the exact green take's text instead of the old bank description.

A real server-owned demo round: $5 on zero-based Box4; J-heart + 6-spade, hit
4-club =20; dealer20; push, $5 returned, balance1000, idle moving afterward.
Goodluck and push ran through the same new joins. Existing Box4 motion, dealer
cards, chips/table, wallet and server logic were not edited. One idle watchdog
recovery was observed during the multi-tab session; later idle motion was verified.
Shared rehearsal UI regression: Vera/Amira/Mei goodluck twice, no bank changes.

Six focused speak checks, full pre-commit suite and dealer-sync --probe passed.
These checks do not establish perceptual lip-sync approval. Measured settled
clock deltas in the runs ranged roughly -35 to -127ms; this task does not claim
sample-perfect playback sync or native source quality beyond the supplied takes.
User's existing localhost4190/Amira session and live database were left alone.
