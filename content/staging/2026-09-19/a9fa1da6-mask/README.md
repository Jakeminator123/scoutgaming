# User-selected a9fa1da6 mask

The user explicitly selected the existing 3-second 16:9 clip a9fa1da6 and asked to mask it, then chose **keep Astrid and the card**. No generation jobs or provider calls were submitted. The old autonomous goal and overnight automation remain paused.

Source: `../../2026-09-17/seven-seat-reach/box2-reach.mp4`, matched by job-box2.json and the saved generation-bank ID. Native 1280×720, 73 frames at 24 fps (3.041667 seconds), silent. Source RGB, framing, pacing and the existing generated card are preserved. The card is intentionally baked into this version; do not treat it as a server-card replacement or automatically assign it to gameplay.

Outputs are under `web/public/review/astrid-a9fa1da6/`: real-alpha WebM, RGB-over-grayscale-mask MP4, editable 73-frame alpha PNG archive, checkerboard MP4 preview and a browser viewer with switchable backgrounds. The packed MP4 requires its alpha to be applied; the WebM has real transparency. No BO assignment or gameplay route was changed.

Reproduce with Python 3 + numpy, pillow and opencv-python-headless, FFmpeg, and the existing compiled pipeline/person-mask (Apple Vision). Extract all 73 native frames to frames/%04d.png; run pipeline/person-mask on frames/ to vision/; run build.py then sh encode.sh then verify.py. card-reference.json preserves the existing source card trajectory; source-observed crossing polygons and edge exclusions are in build.py. Only masks are edited. Intermediate decoded RGB and review sheets stay local; delivered alpha masks are saved in the archive.

Dense visual review covers every source frame, including extraction, two-hand transfer, the card crossing in front of the shoe, long reach, release and empty return. This is a masked version of the selected source, not a repair or approval of the underlying generated dealing mechanics. The source does not end at its exact opening pose, so looping still has its original reset cut.
