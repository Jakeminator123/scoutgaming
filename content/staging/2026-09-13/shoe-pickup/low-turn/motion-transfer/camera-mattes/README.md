# Camera-locked raw actor masks

Raw native Apple Vision accurate person segmentation only. No manually cleaned R/G, card replacement, interpolation, public edits, generation or upload. Source paper is not game authority.

`build.sh` records exact local commands. `frames/0000.png`–`0120.png` contain native decoded RGB; `person/` has the matching raw grayscale masks at1920×1080. Both large directories are ignored by local.gitignore. `verify.py` asserts exact121 filenames/dimensions and native timestamp n/24; receipts retain source/script/frame SHA256 and probes.

Intended geometry experiment: card BACK through first upright22, observed narrow phase23–24, authoritative FRONT25 onward. This raw mask does not implement that material mapping. Contact-fit agent owns prop geometry. Raw Vision is only an actor starting mask: source paper/shoe inclusion and finger leakage require a separate reviewed cleanup stage.

## Verified result and raw-mask defects

All121 RGB and121 person masks passed exact filename and1920×1080 dimension assertions. All121 native presentation timestamps equal n/24 within2 microseconds. Source SHA256c4e46c9cbde5383dacf87d22910a9a15eefb2c2b7e408785931795ac46d53664. Source/Swift-script SHA and coverage per frame are in receipt.json; every RGB/person file hash is in frame-shas.json.

Viewed14 whole-actor samples and native-size hand crops8/18/23/67/98/118. Head, shoulders and sleeves remain connected in those samples, with soft raw segmentation boundaries; this is not temporal edge acceptance. Hands are broadly present but finger separation is not independently segmented and fine contact edges remain blended into held paper.

Held source cards are included as actor at8/18/67/118. Ghost shoe returns at23/98 and other samples; table text/shadow leaks beside the delivery hand at23/98. Small disconnected table-foot fragments appear late87/110/118. These must be removed in clip-specific cleanup. The mask also captures portions of a just-landed card near35/58, so cropping only the shoe would not suffice. Do not send rawR to gameplay or derive fingerG by simply copying it.
