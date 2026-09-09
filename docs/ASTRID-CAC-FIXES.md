# Astrid CAC fixes — 9 September 2026

The four reports in CAC refer to Astrid, including the report named Vera. These changes are in the existing `/?dealer=astrid&performance=staged&rehearsal=1` game. Guest access remains enabled. This checkpoint does not promote the entire realistic-table milestone to the default route or deploy production.

| Report | Change and evidence | Acceptance boundary |
|---|---|---|
| [CAC-1](https://scoutgaming.atlassian.net/browse/CAC-1): speech background breaks | Twenty original streams have full actor mattes. Both native speech videos carry their matching matte and unchanged embedded audio. One empty room plate replaces the overlapping room windows. Native speech hides the underlying idle actor and hands. The reported lose line ran twice; 13 other lines completed in sequence, and goodluck ran twice. | The rectangular background patch is removed in the staged path. Source poses still differ at some joins; segmentation edges and exposure need further visual refinement. |
| [CAC-2](https://scoutgaming.atlassian.net/browse/CAC-2): only centre delivery | New left and right actions join the centre and dealer actions. All four retain exactly the same first 72 pickup frames, including the front outlet. A real three-seat round recorded all four directions, including the face-down dealer card. | Three player direction variants serve seven seats. Some destinations still require a visible corrective slide after release. This is not seven independently captured exact seat deliveries. |
| [CAC-3](https://scoutgaming.atlassian.net/browse/CAC-3): controls hide totals | Controls use actual rendered card/total/wallet bounds and one action panel. Totals sit beside the chips, split totals remain separate, and portrait right/dealer totals stay inside the viewport. Actual seven-seat, split and 390×844 checks passed for unobstructed controls. | Browser viewport checks are not physical iPhone/Android acceptance. A desktop hand with outer-seat wagers still has hidden outer seats in portrait. |
| [CAC-4](https://scoutgaming.atlassian.net/browse/CAC-4): slow dealing | Silent movement plays at calibrated 1.75× after media loading; pickup, card transforms and sound cues still follow presented source frames. Own-card draws measured about four seconds each, down from seven. Speech remains at 1×. | Faster pacing does not remove generated motion blur or make the remaining pose changes seamless. No claim of complete professional-dealer realism. |

## Watch the actual game

- [Three-seat initial deal](../web/public/dealers/astrid/performance/cac-three-seat-deal.mp4): left, centre, right, own upcard and hole card. Also available through **Watch updated three-seat deal** in the game's rehearsal panel.
- [Left-seat hit](../web/public/dealers/astrid/performance/cac-left-hit.mp4).
- [Right contact](../web/public/dealers/astrid/performance/cac-deal-right-contact.png), [left release](../web/public/dealers/astrid/performance/cac-deal-left-release.png), [own card](../web/public/dealers/astrid/performance/cac-deal-dealer-contact.png), [phone split](../web/public/dealers/astrid/performance/cac-phone-split.png).

Recordings are timestamped browser frame captures of the actual game, encoded without changing their elapsed timing. They are silent and therefore do not prove sound output. Speech/cue logs and runtime mute checks supplement them.

Against the [Scout reference video](https://scoutgaminggroup.com/ai-casino), this checkpoint now has a continuous photographic room and genuine directional hand motion. It remains behind the reference in natural pose continuity, source sharpness during motion, precise release-to-card-fan alignment and material consistency between the moving card and settled DOM card. No floating-card-only animation is presented as completed performance capture.

## Runtime and regression results

- Fresh QA server on **127.0.0.1:4178**, isolated temporary SQLite database. Existing 4173/4175/4176 player data was not reset or seeded.
- Seven-seat hand: initial deal, insurance declined, centre split, left hit, stand, two own-card draws, settlement and collection. Split cost $5 once; closing balance $972.50.
- Three-seat round: initial $15 bet, eight presented deliveries, refresh preserved the same J♦/5♣, A♥/3♥, 9♥/5♥, dealer 3♠/hole and $957.50 balance. Right double drew 5♠ and cost another $5; two stands completed settlement at $952.50. No second deduction on refresh.
- A further live split/double check verified $15 total and a $10 right-seat chip after splitting; doubling one split hand produced $20 total, a $15 right-seat chip and $932.50 balance without refreshing.
- Found a separate display issue during the split/double checks: the chip/total display used the original betting draft. It now reads server-returned hand stakes, including split hands, doubles and insurance. Backend game/wallet logic is unchanged.
- All four dealers' goodluck lines completed twice consecutively through the shared player. Astrid lose repeated twice. Greeting, placebets, insurance, peek, blackjack, bust, dealerbust, win, push, dealerblackjack, sidebet, farewell and double completed in sequence. Small talk remains disabled in gameplay. Full phoneme/voice-likeness approval is still pending.
- Native mute removed both speech canvases and restored the idle actor; no lingering speech layer. Exact matte/source hashes and frame counts protect every Astrid stream. Both native audio packet hashes match their original source.
- Deep 90-stream roster audit, four performance media probes, actor/audio audit, 36 hook tests, 197 shoe/service checks, 77 split checks and 50,000-round invariant sweep passed. Existing missing-take warnings for Vera/Amira/Mei remain unchanged.

## Assets and reproduction

`web/public/dealers/astrid/actor/provenance.json` pins the original speech, matte, native packed media and room plate. `pipeline/build-astrid-actor-mattes.py <staging-root>` reconstructs mattes without changing original RGB, script or audio. Native speech audio is copied, not re-encoded. `pipeline/audit-astrid-actor.mjs --probe` verifies the pairs and original embedded audio.

`performance/cac-generation.json` records the generation inputs, result URLs and source hashes. The first right candidate was rejected because it returned to the centre. The corrected right continuation uses a far-right final reference. Left/right combined source films and packed masks are saved in the performance directory. Original raw continuations, reference images, recipes and measurements are retained in the private checkpoint; do not publish private conversation or credential files.

For a continuation: preserve the shared 72-frame extraction, use four-digit numbered frames, prepare full person/finger masks and measured corners, then run `build-contact-review.mjs` in a separate public staging root. Current events: left pickup69/release128/land136/rest153; right pickup69/release116/land123/rest145; 169 frames at24fps, silent playback1.75. A different source, mask, camera, rate or tracking invalidates its visual review.

## Screenshot reporting repair

The CAC reports did not contain saved Expected Results/Steps in custom fields, and their original local sidecars did not preserve those answers. Historical missing text cannot be recovered from these tickets. The current `~/bin/bugshot.sh` now saves exact answers in `.report.json` and Markdown before posting, and includes them in Jira's description for every project. SV2's configured custom fields remain populated; dropping rejected fields no longer drops the description's answers. The current script is also saved as `tools/bugshot.sh`; the pure payload test runs without UI, credentials or Jira writes. Concurrent additions for expected-result images are preserved.

No CAC issue was marked closed or commented on automatically. Code verification, visual acceptance and release authorization remain separate. Filmed hole reveal, collection, shoe change and real Safari/iPhone/Android checks are still outside this checkpoint's completed work.
