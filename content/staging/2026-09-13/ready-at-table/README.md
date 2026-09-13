# Natural ready-at-table motion

This work follows the user's live review of the Evolution reference. The intended change is attentive motion between decisions, with low separate hands ready near the shoe, rather than repeatedly resetting to folded arms. Preserve Astrid's identity, camera, body proportions, exposure and paired recorded speech.

## Source iterations

1. `source.mp4`, Seedance job `cdc7cc10-28da-4f48-8577-8fea94ebb51b`, completed and **rejected**. Starting from existing source pose 34 retained its damaged card pixels. The generated clip also invented a horizontal table edge and changed the initial hand pose. It is not installed. `review.py`, `motion-sheet.jpg` and `review.json` retain the evidence.
2. `clean-hands.png`, GPT Image job `364ab5bc-011b-46e3-9c59-eb9f54696a81`, completed. Visually inspected candidate: paper removed, empty separated hands. This is an anchor image only, not repaired dealing footage. Check registration and identity against the original before using it as a gameplay endpoint.
3. `clean-motion-request.json`, Seedance job `3dc65a6d-e345-4870-b1f9-ece2b70d2dcb`, animates the clean anchor with subtle breathing, blink and gaze. Completed as `clean-source.mp4`. Twelve chronological samples show empty separate hands, a brief upward glance and breathing, without the first attempt's card or invented bar. `clean-review.json` records candidate status. It is 24 fps source footage, not an installed 60 fps gameplay loop. All three jobs are terminal; no job is pending.

## Integration requirements

- A moving loop must preserve empty hands, anatomy, natural face and exposure at every inspected moment. Source endpoints must be compatible; do not hide a jump with a dissolve or stretch.
- The image generator's 4:3 output and the earlier 930×675 actor crop are not interchangeable. Remove aspect padding with uniform scaling; never squeeze the body to fit.
- Ready motion needs explicit action-to-ready, ready-to-action and ready-to-speech handoffs. Source positions 3, 21, 34 and 47 have different hand poses. A valid transition for one is not approval for the others.
- The speech bank still uses a folded-arm body. Do not play it behind a ready overlay, paste mouths, or mismatch its audio/video. Keep gameplay controls responsive while the dealer waits, and cancel/release all actor resources on interruption.
- Do not implement a waiting state by holding a still frame or repeating the dealing action with phantom cards. Do not declare this experiment delivered until it works through an actual round and speech transitions.

Public gameplay is unchanged by these source experiments. The first candidate failed before installation; source preparation is not visual acceptance or completion of CAC-4. No third-party dealer footage is installed in the game.
