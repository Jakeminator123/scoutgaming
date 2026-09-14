# Astrid browser playback measurement

Current staging `/camera60` uses the exact reconstructed actor/card ledger. These measurements are actual foreground browser runs, not encoded frame-count claims. Source master contains303 frames at60fps. Each JSON records frame callbacks, media times, visibility, paint duration and browser video quality deltas.

| Candidate | Unique observed frames | Decoder-reported dropped frames | Total video frame delta |
| --- | ---: | ---: | ---: |
| Original1920x2160 video,1920x1080 canvas |279|24|299|
| Repaired1280x1440 video,1920x1080 canvas |258|45|299|
| Same, warm replay |279|24|299|
| Repaired1280x1440 video,1280x720 canvas |297|6|303|
| Same, warm replay |291|12|299|

Runs completed in5011–5044ms. Counts include a separately painted first frame; callback count is not interchangeable with decoder counters, whose baseline follows the initial seek. Missing initial callbacks and startup frames can therefore differ. Foreground visibility was recorded in every sample; previous hidden-tab169-frame run is not a comparable benchmark.

Reducing canvas workload improves these observations, but neither variant proves reliable displayed60fps. Keep the1080 master. `?variant=720&output=720` is an explicit review option, not a public quality downgrade. Repaired video changes native102–109 knuckle alpha, so this is a practical candidate comparison, not a strictly identical-pixel codec experiment.

The full121-native diagnostic still contains fifth-card source fragments beyond109 and must not become gameplay or a loop. The joined cutoff/return timeline is being built separately. Allseven reaches and speech transitions remain unapproved.
