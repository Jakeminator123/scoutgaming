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

## Bridge batch and concrete blocker

`bridges-request.json` contains the exact five-request batch. Pose 3 job `19260b8c-af4f-4985-9922-e7f47fc942a4` and pose 47 job `8409448f-bf01-4a96-a24c-042dfdec38df` completed and were downloaded. Both are **rejected** after chronological source inspection: pose 3 invents repeated empty-hand sweeps and damaged card shapes; pose 47 visibly dissolves between double images around frame 52. Their contact sheets and review JSON preserve the failures. None is a usable gameplay bridge. Pose 21, pose 34 and speech-idle requests were rejected before submission for insufficient credits: no jobs exist. Team balance verified at 2.03 credits, no unlimited allowance. Do not retry this batch or spend on the same endpoint prompting method without resolving its failure.

`build-ready.py` packs the clean ready source into the game's 1920×1080 camera with lower-half alpha, using native-duration 60 fps optical-flow interpolation. It crops aspect padding uniformly and uses the person matte bounded by the photographed silhouette. The output remains staged. It does not repair the rejected bridges, add source detail, or prove gameplay integration. No ready-state feature is enabled: all entry, exit and speech transitions require acceptable continuous motion first.

### Packed preview verification

`ready-packed60.mp4` contains 241 frames at 60 fps, 1920×2160 packed RGB/alpha, no B frames. `ready-preview60.mp4` unpacks the alpha onto a neutral inspection background; `preview.html` loops it in the browser. The preview was observed playing across repeated loops with empty hands and a stable silhouette. This is not an actual full-round or frame-by-frame seam approval. Deep dealer media audit and the complete pre-commit suite passed. Public playback and speech assets were not changed; their previous gameplay acceptance boundaries remain unchanged.

Remaining work requires a different continuous-motion source method: the generated bridges violated the no-dissolve/direct-movement contract. All five pose connections still need valid footage, including replacements for the two rejected outputs. More credits alone do not resolve this quality failure.
