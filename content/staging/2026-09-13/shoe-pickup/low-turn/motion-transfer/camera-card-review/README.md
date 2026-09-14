# Camera-locked source: independent card review

**Actor motion is potentially reusable, but baked cards fail face continuity.** All five draws visibly emerge from the generated source shoe; four settle on the felt and the fifth remains held at the end. No spontaneous extra card or disappearance of a settled card was observed. This does not approve current-game shoe registration.

Source `camera-locked.mp4` SHA256 **c4e46c9cbde5383dacf87d22910a9a15eefb2c2b7e408785931795ac46d53664**;1920×1080,24 fps,121 native frames,5.041667 s. Reviewed n0–119 in four every-frame contact sheets; n120 is the same unfinished fifth-transfer endpoint in the overview. Frame event ranges acknowledge fingertip overlap.

| Card | Emerges from shoe | Supported transfer | Empty-hand release | Result |
| --- | --- | --- | --- | --- |
|1|n4–12|n16–22|n35–36|First/rightmost card; held diamonds become landed hearts by29–35.|
|2|n32–38|n40–46|n60–62|One place inward; held single central diamond becomes multipip diamonds.|
|3|n57–64|n65–72|n87–89|Next inward; held red diamond becomes black spades by78–87.|
|4|n85–91|n92–97|n110–112|Next inward/left of centre; held diamond becomes hearts by102–110.|
|5|n108–115|n116–120|Not present|Still held at endpoint; no fifth settled card.|

The first held face n18 visibly has multiple diamonds, while the first settled face n35 has hearts. This is not hidden by the fingers. Card3 n67 has a red central diamond and card3 n83 has black spades: particularly decisive suit/color continuity failure. Card4 repeats this failure. Card2's pip-count change is also visible but its upper area is partly hand-occluded, so this is a lower-confidence additional mismatch. **At least3 clear suit changes**; one additional suspected pip-count change. `card-face-comparison.jpg` enlarges the first/third examples.

All cards emerge with white faces/red pips visible, including n7–12 and n58–64. That differs from the supplied reference's back-up extraction before a short supported turn. A card's two sides cannot both carry different faces. Masking and an independent authoritative card with consistent face/back orientation are required; recolouring one settled frame cannot fix this.

The mouth-adjacent exposed paper also bows/curls, clearest n8–12 and n35–38. Mild physical card flex is possible, so this is not automatically an extra-card failure. However it is not a verified rigid plane, and a simple four-corner replacement must be tested against those curved edges. Fast edge-on windows n23–26,47–50,73–77,97–101 are blurred/occluded; their rigid shape cannot be certified from stills.

Four settled cards persist through the endpoint; no clear texture change after each has settled. Four progressive right-to-left destinations are visible, not seven-seat coverage. Straight looping to n0 would erase the four cards and held fifth: endpoint must not be used as a clean ready loop.

## Reusable matte pipeline proposal — not executed

Use the existing `pipeline/person-mask.swift` native Vision segmentation against freshly decoded camera-locked frames0–120 in a **new staging directory**. Existing low-turn source masks cannot be reused because this has different pixels and hand paths. Assert121 matched RGB/mask files,1920×1080,n/24 timestamps and source SHA. Keep rawframes/masks ignored; retain receipts/scripts and review sheets.

Build actorR from the large connected torso/arms component, removing room/table, ghost shoe, and **all five moving plus four accumulated source papers**. The paper exclusions must follow this clip's actual paths; old pickup/slide polygon coordinates do not apply. Build fingerG from observed connected hand pixels, not a broad warm-color mask: red suit artwork and reflected warm paper can leak into G. Preserve fingers along card edges; do not invent missing skin or paste hands.

Review critical samples4/8/12/18/23/35/42/58/67/73/87/94/98/110/118. Particularly remove visible white paper beside the hand at the shoe, preserve the index/thumb during upright transfer, and exclude stationary cards after35/61/88/111. Root's new tracked authoritative card must use a consistent back/face plane and the same time mapping as RGB/R/G. If that cannot cover the curved paper behind the real fingers, reject the affected motion rather than hiding it with a mask hole.

Native actor segmentation is a reasonable next staged experiment after parent review. It is not acceptance of card motion, shoe contact, seven reaches, or end-state integration. No segmentation, generation, upload, or public edit was performed for this review.

## Follow-up: rigid replacement viability, separate from baked face identity

The projected card silhouette **does narrow toward edge-on and broaden again during the wrist turn**. This is not only a texture swap on an unchanged broad rectangle. Aspect-preserving closeups `turn18-29.jpg` and `later-turns.jpg` show:

- First:22 tilted broad→23–24 narrow/mostly hand-occluded→25–29 broadening.
- Second:46 tilted→47–48 narrow→49 onward broadening.
- Third:73 tilted→74–75 narrow→76 onward broadening.
- Fourth:96 tilted→97–98 narrow→99 onward broadening.

Therefore the actor source is a plausible candidate for rendering the first generated face as the game's **card back**, crossing the narrow phase with one continuous rigid plane, and showing the authoritative face afterward. The baked suit changes alone do not disqualify that intended independent-prop path. The white/pip material visible earlier must be completely removed from R/G around the fingers and replaced from extraction onward.

Exact corners through these edge-on/occluded intervals remain unmeasurable from the image: the broad dark area below the hand includes shadow, not necessarily exposed paper. Do not fit a broad fake card to that shadow or infer a literal zero-width plane from the lack of white. Fit a continuous rigid plane using visible boundaries before and after, then verify that its trajectory stays supported by the actual fingers. This is the next staged geometry/matte acceptance test, not yet performed.

### Early extraction-to-upright check (requested separately)

`early9-25-native.jpg` inspects every native frame9–25 at original aspect ratio. **There is no observed edge-on crossing in9–21, including13–18.** A broad card remains visible below/beside the feeding fingers while rising into the upright grip; it is not entirely hidden. Thus an intended back-flat→front-upright switch before the upright midpoint is **not supported** by these outlines. The first clear narrowing is later22→23–24.

This limits the prior replacement proposal: rendering back until the later23–24 crossing could be tested as a different choreography, but do not claim the early reference-style turn has been captured or switch the card material in13–18 without a physical crossing. A full rigid-prop fit must reconcile the observed lifted plane, later crossing and finger contacts, not just hide the baked identity mismatch.
