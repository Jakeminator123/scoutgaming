# Independent native-frame motion review

Zero-based native frame numbers, all three candidate sources 24 fps / 73 frames. Reviewed every frame as chronological cropped sheets. These are visual contact judgments, not tracked hand calibration. No public asset changes or generation.

| Source | Native frames | Observation |
| --- | --- | --- |
| fast | 0–6 | Empty receiving hand, feeding fingers at outlet; useful start. |
| fast | 7–19 | One red-backed card visibly emerges at the shoe mouth; receiving hand approaches. |
| fast | 20–31 | Hands meet at outlet and receiving hand removes the card. Best extraction/transfer subset. |
| fast | 32–46 | Card rises upright into presentation; no face turnover. Cannot remove this interval with a cut without breaking motion. |
| fast | 47–62 | Card lowered and pushed under fingers across felt, still red-back-up. |
| fast | 63–72 | Hand separates and returns empty; face-down card remains. |
| turn | 0–16 | Feeding fingers prepare at outlet; single card becomes visible. |
| turn | 17–24 | Card extracted upward and handed across. Already excessive lift. |
| turn | 25–38 | Both hands hold upright red card; no turnover. |
| turn | 39–60 | Card lowered and slid face down. |
| turn | 61–72 | Empty return after face-down release. |
| bound | 0–24 | Extraction followed by upright transfer/presentation. |
| bound | 25–36 | Both hands continue holding card upright above felt. |
| bound | 37–48 | Face-up card appears as fingers release; card travels toward player with hands behind it, visibly unsupported. |
| bound | 49–72 | Terminal face-up card and reset satisfy endpoint only. |

**No subset contains a complete acceptable player turnover.** Fast 0–31 can inform a new pickup segment, but cross-cutting it to bound's face-up endpoint would conceal missing physical action. A face-texture replacement alone also does not demonstrate turnover.

## Denser cached reference comparison

Reinspected cached YouTube source (1280×720, encoded 60 fps) n240–360 every third native frame, 4.00–6.00 seconds. Inspection sheets remain local in /tmp/astrid-native-ref-0.jpg and -1.jpg; third-party source is not shipped. Timing uncertainty up to 3 native frames (0.05 seconds), and encoded frame rate is not proof of independent captured frames.

- n279–288 (4.65–4.80): one card leaves outlet and reaches receiving hand.
- n291–306 (4.85–5.10): small wrist rotation near shoe, then outward travel. Card stays near felt; no chest-height or upright display pause.
- n309–330 (5.15–5.50): face-up card carried/slid under receiving fingers to right position.
- n333–342 (5.55–5.70): empty receiving hand returns; feeding hand is already preparing next card.
- n345–360 (5.75–6.00): next transfer/outward motion follows immediately.

This shows why simply speeding the candidate is insufficient: real turnover happens during transfer, rather than being a separate display gesture.

## Concrete GPT Image anchor requirements

Use the accepted Astrid camera/identity/table/shoe image, not the reference dealer's likeness. Create an intermediate **low face-up hand-contact** pose immediately beside the shoe: dealer's right receiving hand (viewer-left arm crossing to the shoe) holds one face-up card at its trailing short edge, thumb opposite two fingertips, card nearly parallel to and just above the felt; left feeding hand remains empty at the outlet. Elbows remain low, gaze follows the card, shoulder width and shoe position unchanged. This is the missing constraint in prior start/end images.

Then a release-contact anchor should show the same card flat on felt under the receiving fingertips at the target, before fingers lift. A separate empty-return end should preserve both hands and the one stationary card. Reject anchors with card already detached from fingers, multiple cards, hand anatomy merging into paper, upright display, or altered shoe/camera. Inspect each image before using it in a motion job. Native video must still prove continuous extraction/turn/release; stills do not establish acceptance.

## New GPT Image transfer anchor review

Inspected `../transfer-anchor.png` (job 7d9a23ca-67c7-45eb-908b-2146a2be973c), including enlarged hand crop. Conditional usable boundary for **low slide start**, not evidence of a pinched handoff. In 1344×768 coordinates card corners are approximately [630,391], [666,391], [670,425], [630,426]; fingertips overlap its upper-left face. An opposing thumb below the card is not visible. Card appears near-flat against felt and can plausibly be pushed forward under the fingers. Card centre [650,409] is about 200 pixels left of shoe mouth [853,439], farther from shoe than requested.

Use as an extraction/turn segment endpoint only if the generated native frames visibly perform the low turnover before arriving here. Follow with a supported forward slide and empty return. Do not treat this pose as proof that the intervening turn exists, and do not accept an unsupported drop into it. No obvious gross finger merge was seen in the crop; exact contact remains a motion QA gate.
