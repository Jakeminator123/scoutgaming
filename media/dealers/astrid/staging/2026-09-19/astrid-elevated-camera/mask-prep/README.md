# Elevated-camera matte preparation

This is isolated preparation for the user-approved elevated-camera reference `../start.png` (job `269f8943`). It does not reuse or install the rejected frontal-camera take. No provider generation is submitted by these scripts.

The 2688×1520 reference has actor alpha bounds `[921,29,1827,943]`. Its torso terminates at the straight green rear rail around normalized **y0.500**; the rail extends to about **y0.522**. At 1080 height this is approximately y540–564. Register this lower torso edge behind the actual table rear rail, while preserving forearms/hands above felt. Do not lower the actor until arms appear to sit inside the rail.

The provisional crop is `[560,0,960,760]` at 1920×1080, covering actor, hands, all of the shoe and the dealer-card work area. This is **not final video geometry**: every future source frame and tracked card quad must fit before using it. The key works in full source coordinates first. Crop matrices are saved in receipts/manifests; RGB is above grayscale alpha in the packed atlas. Native video frame rate and count are read from the source, never assumed to be 24 or 60.

Basic chroma alone leaves speckled dark-green chair/shadow pixels at the torso sides and viewer-right cuff. The prepared hybrid uses the existing **local** Apple Vision person mask as a coarse actor silhouette, then source chroma for the exact green background, shoe/card removal and hair/finger boundary. Black tailoring is restored only inside the high-confidence actor region. The magenta key uses a normalized work area starting at y0.28, keeping face/lips excluded at this camera angle. This replaces the rejected frontal key's hardcoded y530 region. Original RGB is never recoloured.

`start-frame/grounds.jpg` records the insufficient pure chroma pass. `start-hybrid/grounds.jpg` shows the improved reference matte on dark/light/felt backgrounds. The reference hand/face and both cuff edges were visually inspected. Future source movement and mask temporal stability remain unverified.

When the actual elevated video is saved, build its isolated candidate:

```sh
/tmp/astrid-a9mask-env/bin/python build-video.py --source /absolute/new-source.mp4
```

The script extracts every native frame, computes local person masks, keys all frames, fails if any actor point exceeds the requested crop, and writes native alpha/RGBA, all-frame QA sheets, `actor-packed.mp4` and `manifest.json` under `video/`. It does not copy anything into public assets or install gameplay. Root owns those later decisions.

## Completed elevated source matte

The new Seedance source `de1f90a9` is now processed in `video/`: 1920×1080, 97 frames at 24 fps, source SHA `dfaeea2b4dae3cad918a2a3af9114d261131939ea636cf2e3427172b3b33402b`. Final crop is `[560,0,960,760]`, packed output **960×1520**, about 1.7MB. The crop-to-source translation is +560 in x, 0 in y; it never rescales Astrid. Native actor union bounds are `[656,22,1306,678]`. `actor-transparent.webm` provides a 960×760 transparent preview (~1.0MB); native RGBA and alpha PNGs remain the editable intermediates.

All 97 matte frames were visually reviewed in `video/qa/all-frames-*.jpg`; decoded dark/light/checker samples are `video/qa/decoded-grounds.jpg`. Face, hands and fingers persist without wholesale holes or clipping. A small lower-left triangle in native0–4 was inspected at 5× (`chair-native0.png`): it is the source blazer's side behind the arm, and is retained. The table rear rail should occlude the source's flat lower torso edge at y542. Source motion blur and slight green spill can remain on some gripping-edge pixels; no RGB despill or face colour manipulation was applied.

`verify-video.py` passes all native-frame checks: 0 RGB changes before encoding, no visible bright magenta prop pixels, face interior alpha255, zero alpha in tested unoccluded background/table/shoe regions; packed output decodes all97 frames at24fps without B frames. Ordinary H264 encoding causes sampled face RGB mean absolute differences about1.8–2.1 out of255. These checks do not establish gameplay visual acceptance.

Motion boundary: native0 already has Astrid reaching across and touching the shoe card. It does **not** match the approved ready-pose reference. The card is taken, transferred/turned around16–28, placed centrally by~34, retained under the hand until~54–58, and followed by an empty return toward the shoe-side ready position by~72. Frames72–96 maintain that rest with small movement. Her gaze remains toward the camera. Source frame96 and0 do not form a seamless idle/dealing loop. Root owns how this source is introduced and whether its motion is acceptable; this mask makes no such claim.
