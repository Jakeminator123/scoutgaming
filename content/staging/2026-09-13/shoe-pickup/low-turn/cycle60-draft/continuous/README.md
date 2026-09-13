# Continuous packed60 decoder candidate

`cycle-shared60-packed-420.mp4`:181frames,60fps,3840×1080,High5.2 yuv420p. Concatenated existing packed PNGs with no additional optical flow, interpolation, seam frames or fades. Phase PNG hashes are recorded for everyglobal frame.

Global pickup0–74; slide75–140; return141–180. `manifest.json` maps eachglobal frame to clip/local/sourcePosition plus input hashes. `build.py` reproduces the same encode. Every decoded PTS is strictly increasing with maxroundedtimestamp error0.333microseconds against globalFrame/60. Duration181/60=3.016667s.

Boundary verification decodedall181frames and compared inputPNG versus decodedframe at0,73,74,75,76,139,140,141,142,180. MinimumG threshold128 IoU 0.996864; maximumactor-interior RGBMAE 1.899/255. These are lossy420 encoding differences, not exactpixel equality. `boundary-check.json` stores measurements; boundary JPEGs show originalRGB/decodedRGB/originalRG/decodedRG.

Phasefiles retained. This changes decoder lifecycle only; prior source/matte/seam limitations remain. Rootbrowser must verify actualframe delivery and renderedcontact before acceptance.
