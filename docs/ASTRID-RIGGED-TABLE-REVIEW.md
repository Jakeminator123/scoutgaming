# Astrid: editable 3D table and in-game contact review

The dated browser recordings, screenshots and QA receipts were removed from
the checkout on 29 September 2026. They remain in the
[Git snapshot](https://github.com/Jakeminator123/github-work/tree/f31b219e4d0f751a81caa2db75c9d824be8e8926/assets/blackjack-3d/review).
The editable projects and runtime models remain in the checkout.

This is an experimental rendering path inside the existing blackjack game. It is **not the accepted photographic Astrid milestone**. The default filmed dealers remain available. Use `?dealer=astrid&scene=rigged-review` on a locally running Croupier server to inspect this candidate.

The newer `&face=anatomical` candidate adds a corrected anatomical head, facial controls and measured source-clock speech. Read [ASTRID-FACE-IN-GAME-REVIEW.md](ASTRID-FACE-IN-GAME-REVIEW.md) for the updated editable project, exact evidence and remaining likeness failures. The original baseline limitations below remain historical context for the route without this option.

## Delivered files

| File or directory | Contents |
| --- | --- |
| `assets/blackjack-3d/blackjack-table-detailed.blend` | Editable detailed table, felt, leather, rail, pedestals, acrylic shoe, separate pack, pusher, cut marker, discard holder, chip tray, independent chip/card templates and room |
| `assets/blackjack-3d/blackjack-table-optimized.blend` | Reduced bevel resolution for the runtime export |
| `assets/blackjack-3d/blackjack-table.glb` | Engine table/props export with embedded materials and textures |
| `assets/blackjack-3d/blackjack-room.glb` | Continuous room geometry, independent of the actor |
| `assets/blackjack-3d/editable-project/astrid-blackjack-editable.blend` | Combined table and actual skinned dealer; marked twelve-action NLA review timeline with separately animated card helper |
| `assets/astrid-3d/` | Original generated dealer, rigged and animated source/export files maintained by the collaborating dealer task |
| `assets/blackjack-3d/reference/` | Higgsfield table reference and provenance |
| `web/public/rigged-table-scene.mjs` | Actual game renderer consuming the existing server-backed card DOM |

The card helper in the editable timeline is a blank modelling aid. Runtime card rank, suit, hole-card visibility, shoe counts, legal actions, wallet and settlement continue to come from the existing backend. The new renderer has no game or wallet API.

## Coordinate and playback contract

Engine coordinates are metres: X right, Y up, Z towards the player. Blender maps `(x,y,z)` to `(x,-z,y)`. Felt height is 0.910 m; the first card centre is 0.91055 m. The shoe outlet is `[0.56,0.935,0.11]`. `profile.json` stores seven distinct card destinations and the dealer destination. Game seat zero maps to asset destination seven because the two lists run in opposite directions.

The live scene uses `dealer-rig.mjs` for the same body, wrist and finger controls used to bake the editable studies. Card attachment, release and pickup/landing sound cues advance on one animation clock. A delivery promise resolves only after the action returns. Hidden tabs pause presentation. Card reveal waits for the hand turn; collection completes before the UI offers another bet. Split hands retain individual backend/card DOM identities. Their fans use up to two columns and two rows, with separate totals, an active-hand marker and a rank/suit readout beside the legal actions. Existing cards slide into their new positions during resplits.

`blackjack-asset-state.mjs` maps public shoe snapshots to pack depth, pusher position and cut marker. It validates the snapshot and does not draw cards. Template cards/chips are hidden in the runtime scene, preventing additional generated cards from appearing next to server cards.

`rigged-discard-state.mjs` derives previous discards from the server shoe and current round. The burn is included; unrevealed hole cards stay in the current round. During collection each physical landing moves one card into the pile once. The pile persists after the UI clears and restores on refresh; a new shoe resets it. The current session retains the last actually collected card on top. On refresh the public server does not return prior card identities, so the restored pile uses an anonymous card-back cover rather than inventing its face.

## Verification and its limits

- Actual isolated game: seven stakes, fourteen player cards and two dealer cards at separate targets; refresh retained the exact cards and balance. Stake 35 changed 1000 to 965; settlement returned 10 and left 975; the table cleared for another round.
- Subsequent centre-seat rounds exercised own-card dealing, hole-card reveal, hit, declining insurance, stand, settlement and collection. A later complete recorded round with the corrected skin contact staked 5 from 965, returned 10 and left 970; all card elements cleared.
- Four-hand split follow-up: the isolated server's undealt shoe was arranged between rounds while preserving the full card multiset and balance. All actions still used the ordinary backend. Three resplits produced separate hands of 12, 13, 10 and 11, with 20 total stake and a balance of 950 from 970. Refresh preserved all eight player cards, the current hand and the exact balance. Dealer reveal/draw/collection completed; 40 was returned and the final balance was 990. Evidence and a silent dealer-turn recording are in `review/split-hands/`. This is a controlled fixture, not a claim about random results.
- Discard follow-up in the actual far-seat game: the restored pile contained 45 cards with balance 990. A 5 stake dealt A-spades/7-hearts to box 1; insurance was declined, the player stood, and the dealer's hand pushed. The pile stayed at 45 while four cards were in play, then grew to 49 during collection. All live card elements cleared, 367 remained in the shoe and balance returned to 990. Refresh preserved those counts and balance. Evidence and a silent recording are in `review/discard/`. Unit checks cover duplicate landings, paid-round refresh, hidden hole cards, hits/splits and new-shoe reset. An independent skin/reach sweep also checks collection against a pile of up to 415 cards.
- Layout tests cover all seven seats with 1–4 hands and up to 21 cards, including neighboring players with different split counts. Oriented card rectangles stay on the felt and separate from other hands. An independent Three skin sweep verifies reach and fingertip height for the outer split targets. Actual four-hand visual proof is from the centre box at 1091×837; physical mobile and all outer split combinations still need visual acceptance.
- The saved browser recordings are **silent visual evidence**, not proof of audio quality. The baseline evidence is split into initial-deal and decision/settlement segments. `game-skin-contact-round-silent.webm` contains the later complete corrected-contact round. Waiting between user actions is retained.
- Existing isolated HTTP harness passed eight server scenarios, including natural cut-card depletion/replacement after 59 rounds. This proves backend rules, not the appearance of every corresponding action.
- Table asset validation: 79,214 indexed triangles, 4,656,368-byte GLB, seven destination sockets, required separate movable components and embedded textures.
- Shared playback regression: two consecutive greeting plays are checked in the actual rehearsal path for Vera, Astrid, Amira and Mei. This checks sequencing and termination; it does not newly approve lip sync on all recorded lines.
- Native Blender collision evidence: the first pass was withdrawn because a body-control parenting bug placed the source dealer below the table. After correcting that source bug, the first correctly positioned candidate failed 19 of 84 sampled poses, with up to 28.09 mm penetration near release. That failure is retained as before evidence. The revised solver uses actual skinned fingertip vertices, separate thumb leveling and shallow curl. The final native check passes **all 626 authored frames** with zero deep apron intersections. This check does not certify all shoe/card/skin contacts or the professional appearance of the motion. The collision script now checks native head registration against the runtime samples and exits unsuccessfully on penetration; it cannot silently pass an incorrectly positioned dealer.

CPU pose sampling on Apple M2 averaged 1.98 ms (p95 4.24 ms; max 7.31 ms) across 357 samples. This excludes WebGL, UI and scheduling. Tray chips are rendered as six instanced groups while their separate editable source objects are retained.

Physical iPhone Safari, Android Chrome and desktop Safari have not been tested for this candidate. Narrow desktop browser presentation was inspected. No default switch, production deployment or full CAC closure is implied by these checks.

## Open acceptance failures

The generated head is not yet a photographic match to Astrid. The imported mesh uses a shared 2K body atlas, moulded hair, a closed mouth and no independently rigged eyes, eyelids or lip surfaces. Material cleanup alone does not resolve these limitations. Face-reference projection is being reviewed separately; failed likeness projections must remain staged. Do not paste or animate an unrelated mouth over this model.

Greeting and accepting-bets studies exist in the editable rig but are not yet connected to game events. Chip handling and a physical shoe-change performance are not delivered animations. The latest opt-in runtime gathers a single packet along a continuous surface sweep; its professional appearance remains under review. The earlier editable collection study moves individual cards and remains preserved. Outer-seat split-hand appearance, skin/shoe collision, card readability and natural transitions still require visual review. The split-layout tests and centre-box game proof narrow those gaps; they do not certify a photographic dealer.

Keep CAC-2 and CAC-4 in development until their full expected results are demonstrated. The original imported face has no speech animation. The opt-in anatomical follow-up now has measured speech, with visual acceptance still pending as documented above. Existing photographic dealer assets and their known gaps are documented separately.

## Higgsfield and source provenance

Higgsfield MCP generated the completed table/prop reference recorded in `reference/provenance.json`. The separate scene-reference request was rejected with an out-of-credits response in the shared workspace. The available Jutsu project-creation route failed; no editable Jutsu project was created. Real table geometry and the combined editable project were authored with Blender locally. The collaborating task retains the generated dealer's original source and generation provenance.

## Rebuild

Use the existing Blender Python runtime with `pipeline/build-blackjack-table.py`. After a verified dealer bake is present in `assets/astrid-3d`, run `pipeline/assemble-blackjack-project.py` and `pipeline/check-dealer-table-collision.py`. Inspect the combined source render and animation timeline after rebuilding; a successful export is not visual acceptance.

Run `node --test test/dealer-skin-contact.mjs`, `node test/blackjack-asset-state.mjs`, `node test/table-http.mjs`, `node --test test/dealer-motion.mjs`, `node pipeline/audit-dealer-sync.mjs --probe` and `.githooks/pre-commit`. Also use the actual browser rehearsal and full-round path described above. Test with a separate host and isolated database; do not edit real user balances for QA.
