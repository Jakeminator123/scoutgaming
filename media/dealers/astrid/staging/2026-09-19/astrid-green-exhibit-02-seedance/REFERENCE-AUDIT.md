# Exact winning references recovered

User requested Seedance and challenged both the rewritten prompt and the changed Astrid likeness. Source of truth is the saved successful submission for `9dc93653-625a-4074-ad0b-f1e8a8fed51e`, which the live backoffice marks `want`.

The winning job used exactly TWO image inputs, with no additional portrait reference:

1. `start_image`: media `43039066-9e6a-4e1d-9628-9e6a7629c194`, `far-left-anchor/motion/ready.jpg`. Astrid faces forward with hands beside the shoe.
2. `end_image`: media `0dc1ddf8-377d-43c4-84da-5188444aa08a`, `box1-trial-spec/endpoint-upload.jpg`. Astrid looks down with her torso turned and a hand extended to the shoe, with the card already landed.

Both uploaded originals were retrieved and verified byte-for-byte against the existing local files on 19 September. Exact hashes are in `winning-reference-verification.json`; the files are copied here as `winning-start.jpg` and `winning-end.jpg`.

The older TRIAL.md prose describes an unchanged ready-pose endpoint, but the actual submitted endpoint does NOT have that pose. Use the verified pixels and submitted media IDs as authoritative.

## Submitted correction and its limits

User explicitly authorized use of Seedance after rejecting the first Kling attempt. The original winning model parameters were copied exactly: Seedance 2.0, 4 seconds, 1080p, std, high bitrate, silent, 16:9. `winning-request.json` preserves the unmodified original request. `prompt-changes.json` lists only environment and card colour substitutions; the action/timing wording is unchanged.

Correction job `175d2d0f-d5b2-4e3b-a0ec-23002a828eae` was submitted before the user flagged the reference likeness. It uses the same two newly generated green studio images as the first Kling attempt. Those images redraw Astrid, frame her closer, and use a forward-facing resting endpoint instead of the winner's turned endpoint. Therefore this job is not a reproduction of the original reference setup and must not be claimed to fix identity or gameplay. No further generation is authorized automatically from this audit; the user is directing the next reference choice.

The job completed and was saved as source.mp4. Twenty sampled frames show physical card carriage by the feeding hand, but no receiving-hand transfer; release occurs near 3.2 seconds rather than the requested 0.9 seconds. Likeness remains that of the rejected green reference. Not accepted or installed. See result.json and motion-sheet.jpg. Do not resubmit.
