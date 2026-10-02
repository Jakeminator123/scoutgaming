# Astrid — H3 center Box 3 test 01

The user approved the softer Astrid face ("perfekt hon är bättre"), then
requested a test. Preserve `start.png` as that accepted appearance reference.

- `start.png`: full-scene before, one blue tracking-card back at the shoe.
- `end.png`: full-scene after, one blue tracking-card face at center Box 3.
- `tracking-card-details.png`: front/back close-up of the same tracking prop.
- `scout-cardback.png`: exact existing game artwork from
  `web/public/assets/cardback.png`, copied without regeneration.

The prop is blue with a thin white border. Its face has magenta/yellow/cyan/white
corner dots, clockwise from upper-left. Its back has one white center dot.
The Scout back is intended for the tracked game replacement, not as a second
physical card in the filmed scene. Physical calibration remains 72x103 mm;
the replacement must not inherit size changes from detected source corners.

## Submitted take

MiniMax H3, 4 seconds, 2K, 16:9, one take. Estimated cost: 8 credits.
Job: `d2295b53-09dc-4eb4-bffa-6ce4847a8897`.

The first request with start, end and a card close-up passed cost preflight
but failed backend validation without creating a job. H3 forbids mixing
keyframes with extra reference media. The submitted request therefore uses
only the full-scene START and END frames, with the card details in the prompt.
The close-up was used for endpoint preparation and is kept in the reference
pack. It was uploaded but is NOT a third reference in this video job.

`keyframe-request.json` has the actual request; `submission.json` records the
returned job. The job is terminal FAILED; do not resubmit automatically.
The earlier `request.json` records the rejected mixed-reference request.

`result.json` records the terminal provider response. It included no output
URL and no diagnostic reason. No video exists to review or install, and no
second paid take was submitted. The user was informed of the failure.

## Review boundary

Source motion must show extraction from the actual shoe, physical transfer
and wrist turn, economical slide to center, release, and empty-hand return.
The end card is slightly wider than the placement guide; its center is within
3 pixels of the measured target. Validate rigid size and hand contact before
any gameplay installation. No claim of visual acceptance from completion or
output resolution. Accepted Box 4 v1 and authoritative cards/wallet are unchanged.
