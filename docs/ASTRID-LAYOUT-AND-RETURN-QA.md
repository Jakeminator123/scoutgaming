# Astrid layout acceptance and return review — 10 September 2026

## Jira

The live CAC workflow was used during development. CAC-3 went back to In Dev when narrow-phone testing exposed the stake-tier selector overlap and stale action position after closing rehearsal. It returned through Ready for QA and In Testing after the fixes. **CAC-3 and CAC-6 are now Done for their reported overlaps.** CAC-2 and CAC-4 remain In Dev. CAC-1, CAC-5 and CAC-7 remain Ready for QA.

All reports were read with description and available custom fields. CAC-6 explicitly requires totals below side bets and actions lower than totals. CAC-3 requires separate visible totals at left, centre and right. Neither closure claims full Astrid delivery acceptance or a production deployment.

## Layout changes and actual QA

Action placement now considers the stake-tier selector. On narrow screens the selector is hidden during a hand, when changing stakes is already disabled; it returns during betting. Closing or opening the optional rehearsal panel recomputes action placement. The existing total clearance and legal action logic are preserved.

All play used isolated 127.0.0.1:4180. A seven-pair fixture reordered only undealt cards while preserving the shoe multiset. The wallet and cards were still issued by the existing server. Initial seven $5 bets changed $1,090 to $1,055. Legal splits at right, centre and left changed the balance to $1,040 and stake to $50. Ten visible player totals remained separate. Standing all hands settled to $1,040 with no remaining stake or cards.

Measured card/total/side-bet/action rectangles and screenshots cover desktop 1280x720, portrait 390x844 and 360x780. Every seat was advanced through the normal controls; left, centre and right splits were inspected. Final checks found no total collisions or action-panel collision with totals, wallet or selector. Refresh restored the same split cards and balance. Public evidence is `dealers/astrid/performance/layout-acceptance.json`, `layout-left-split-phone360-accepted.png` and `layout-three-split-groups-desktop-final.png`. Full traces are private under `content/staging/2026-09-10/layout-acceptance/`.

These are browser viewport checks, not physical iPhone/Safari/Android acceptance. Arbitrary four-way resplits and every browser remain broader milestone checks.

## Left return candidate

The candidate remains inside the actual Astrid game at `/?dealer=astrid&performance=staged&rehearsal=1&continuity=review`. Only known continuing deliveries select it. Final deliveries keep the original resting tail. Ordinary staged/default behavior is unchanged.

Original left frames 0–138, including pickup69, release128 and land136, are unchanged. They are followed by generated empty-hand return frames19–55. The result has176 frames at24fps, native1080 RGB plus aligned masks in one packed file. The next compatible card starts at the existing registered frame55, before pickup69. No wallet/game API or speech asset changed.

The first trial used bridge frame1 and visibly jumped back toward the player after landing. Actual-game frames caught this; it was rejected and the entry was trimmed to frame19. Revised game frames0398/0399 show the preserved delivery-to-return join, and0419/0420 show the next dealer pickup. Both were inspected. No blank actor or extra server card was observed at these joins. Small pose and exposure differences and motion softness remain; status stays review, not approved.

A three-direction round used right, centre, left and own-card takes: balance $1,040 → $1,025 for $15 stake, then dealer bust returned $30 to settle $1,055. The revised left-only trial changed $1,055 → $1,050 for $5, presented5-club/2-heart againstJ-heart and a hole card, and settled at$1,050 after stand. The recorded initial deal preserves elapsed capture timing and is silent. Open **Watch left return test** in rehearsal, or `dealers/astrid/performance/left-return-game.mp4`.

## Rejected generation attempts

Three silent4s1080 Seedance2.0 returns were generated using the authorized credits:

- Left `2c6e8168-2d5a-48e6-bdae-52ce93c05ab8`: installed only as a partial review candidate after the entry correction.
- Right `ae46f7f7-d029-4b14-92d5-7472553a4a77`: rejected; the hand sweeps unnecessarily across the felt before returning.
- Dealer `3a837abd-a2e5-4109-b1c7-dde736bb4922`: rejected; the hand moves the generated delivered card back toward the shoe. This is not an empty-hand return.

The rejected takes are not referenced by the runtime. Prompts, IDs, source hashes and rejection reasons are in `return-directions-provenance.json`. Original videos, frame extractions, segmentation masks and both failed/revised game recordings are preserved privately. Do not interpret the completed generation status as asset acceptance. Right and dealer returns need controlled performance capture unless a demonstrably correct take becomes available; no floating-card replacement is accepted.

## Rebuild and limits

The generalized `pipeline/build-return-continuation.mjs` accepts a staging `source-contract.json` binding the base action/source/media hashes, preserved frame, resume frame and bridge trim. For left, copy committed `left-return-source-contract.json` and `left-return-bridge-source.mp4` to a staging directory as `source-contract.json` and `source.mp4`; extract frames, run `pipeline/person-mask.swift`, then run the builder with that directory and end frame56. A rebuild resets visual review to pending. Centre defaults still reproduce the previous candidate.

All42 required hook tests, six performance-media probes and the90-stream four-dealer baseline probe pass. The four original delivery takes and prior centre continuation are unchanged. Technical regression and probe results are stored with the private evidence. Goodluck played twice sequentially for Astrid, Vera, Amira and Mei through the actual rehearsal interface after this change; each first playback ended before the second began. Screenshots and start/end traces are saved privately. No full lip-sync approval follows from hashes or repeated playback. Existing seven-seat contact corrections, right/dealer folded tails, initial/final pose transitions, softness, filmed reveal/collection/shoe-change and physical-device acceptance remain open. No default promotion or production release.
