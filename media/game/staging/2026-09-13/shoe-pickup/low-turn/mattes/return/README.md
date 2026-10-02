# Return native segmentation n0–40

Generated41RGB PNGs and41Vision person masks at1920×1080, preserving native frames0–40 only. Every filename and dimension asserted equal. Timestamp assertions:41frames, n/24 within2microseconds,0 through1.666667seconds. Source SHA and selected samples in receipt.json; full per-frame metadata in timestamps.json. Parent .gitignore excludes frames/person.

Commands: ffmpeg -i low-turn/return.mp4 -frames:v41 -fps_mode passthrough mattes/return/frames/%04d.png; swift pipeline/person-mask.swift <frames> <person>; ffprobe full decoded frame list sliced first41 (packet-limited probe rejected due B-frame reordering) with frame best_effort_timestamp_time,width,height. review_return.py regenerates7sample RGB/mask/checkerboard sheet using bundledPython.

Reviewed0,5,12,20,28,36,40. Broad face/hair/suit survives; empty delivery hand visibly returns towardshoe. Raw mask continues to include ghostshoe around resting hand. Disconnected lower-right table-foot alpha appears at0/5/20, and should be removed by actor-component filtering. The stationarycard is mostly absent from personmask in these samples; near initial fingertips stillrequires native review before any broadpaper exclusion. No separateGfingers generated here; no claim of cleanroom/prop masking or speech-readyjoin.

The native masks are ready for source-specific cleanup, not packing directly. Remove disconnected components and measuredshoe context while preserving observedskin. Use0–40input and reviewer-recommended5–36actionsegment without silently changingindexing.
