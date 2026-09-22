# Astrid transition repair — 2026-09-20

User report: skin tone changes, actor size changes, and visible idle-loop breaks.
This revision uses existing footage only; no generation requests or paid jobs.

## Repair

- Canonical geometry/color target: eye-contact ready frame0, SHA a847935bf8df1046072bce269354e3faadb31749d88232afed083401de71ea8d.
- SIFT/RANSAC followed by a uniform scale + translation fit (no rotation, no local face reshaping). Speech uses the common neutral first-frame plate; expressive last frames must not change each recording's base size.
- One fixed RGB gain per source, measured from aligned diffuse skin samples. No per-frame exposure/histogram pumping. Display copies retain all original speech frames, native fps and exact audio offsets. Sources and mp3s are untouched.
- Rebuilt the 17 speech enter/exit flow maps against their calibrated display copies. New hashes mean a new visual-review revision, not inherited approval.
- Folded loop uses 12 corresponding moving frames of optical-flow overlap, then original forward motion. Wrap is between adjacent native frames; out begins at loop entry and back ends on exactly that entry.
- Runtime waits for the next loop boundary before unfolding, without painting the wrapped frame first. Concurrent requests share one transition. A request during folding no longer flashes the loop before unfolding again. Disposal resolves pending holds/seeks.
- Automatic old-source full head turns are excluded from this folded cycle; native breathing and subtle eye motion continue. Existing core glance player remains available.

## Verification

`audit/` contains an independent decoded-asset audit: 17 lines / 1,060 frames,
source/audio bindings and timings unchanged; eye alpha >=250/255; no opaque-pixel
crop loss. Head-region loop wrap mean absolute difference 25.32 ->1.91, versus
1.21 typical adjacent motion. This numeric measurement is not visual acceptance.
The slightly faster overlap motion at frames3–6 was also inspected as images.

Actual game player at isolated guest port4211:

- All17 spoken lines played through enter/speech/exit/fold/rest; greeting and goodluck twice consecutively.
- Rendered idle observed across multiple complete loops. See transition/loop/all-lines contact sheets and `rendered-transition.mp4` (silent screenshot-sequence evidence at approximately captured cadence, not original source video).
- Full Box4 round: 5H+6H, hit6D =17, declined insurance against dealer ace, stand, dealer bust. Stake5/return10; balance1005 ->1010. Folded motion resumed. Cards/wallet remain server-owned.
- Vera/Amira/Mei goodluck twice via separate hidden rehearsal tab, per repository regression requirements; no changes to their media.
- No warning/error in the Astrid rendered run. All focused tests, full pre-commit suite and dealer-sync --probe passed. Source audio timing is retained; measured browser speech clock offsets still vary by hardware (roughly -36 to -85ms in these runs), not a sample-perfect lip-sync claim.

## Practical limits

Boundary-safe exit can wait up to one 61-frame/24fps idle loop (~2.54s) before
the filmed unfolding bridge. Ready is retained between consecutive lines.
The folded return still reverses the existing silent filmed hand bridge.
Independent generated sources retain some facial texture/expression differences;
color and registration correction cannot turn them into a single original take.
No production deployment, push, new media generation or all-seven-seat acceptance.

## Rebuild

Python runtime: `/tmp/astrid-a9mask-env/bin/python` (OpenCV, NumPy, Pillow), plus ffmpeg.
Inputs are pinned in `inputs.json`; original media must remain available.
Run calibrate.py, build.py, then review staged results before install.py.
`make-compare.py` reports installed display endpoints; `audit/check.py` audits bytes/timing/mattes.
The original build-speak.mjs follows a hash-bound display-revision manifest and rejects stale sources; build-idle.mjs follows the corrected restManifest. Neither silently reinstalls the uncorrected display assets.

Raw browser captures remain local and ignored; compact contact sheets, state logs
and the rendered transition clip are retained as review evidence.
