# Croupier / Scout Live Casino — continuation prompt

Prepared 9 September 2026. Copy the prompt below when handing the project to John or another engineer. Current runtime: the front-outlet/native-resolution checkpoint described in `ASTRID-FRONT-OUTLET.md`. Read later commits and current user instructions before relying on this snapshot.

---

Continue the existing Croupier / Scout Live Casino product for Kevin and Scout Gaming. Own the engineering work and its delivery: keep the backlog clear, protect working assets, implement the next useful improvement, and prove it in the actual game. Preserve the progress already made.

## Product target and current milestone

The visual reference is John's Scout Live Casino commercial and the reference at https://scoutgaminggroup.com/ai-casino. The intended experience has photographic dealers, believable hand/card contact, consistent voices and lips, coherent lighting, and a continuous room. “Every face, every language, infinite tables” describes the longer-term ambition, not shipped capability.

Finish **one realistic Astrid blackjack table**, in the existing application with a fixed seated camera, before scaling the approach to other dealers. Gameplay movement and speech synchronization come first; small talk stays off. Preserve the walkable casino prototype outside this milestone. The people currently use photographed/generated video layers; the table, shoe and cards have 3D geometry. Do not describe them as fully rigged 3D humans.

Kevin's latest feedback takes precedence over older handovers. He wants the useful context from Claude's handover, while continuing the current implementation. A new Bettalotto tour is not needed just to resume this work.

## Working source and evidence

- Repository on Kevin's Mac: `/Users/solvifyab/Desktop/croupier`. The older checkout inside Scout-Gaming is not the current product.
- GitLab: `scout-gg/croupier`, branch `codex/restore-casino-environment`. Inspect remote changes, especially John's, before editing shared files. A local preview or pushed commit does not prove production deployment.
- Read `AGENTS.md`, the newest section of `docs/JOHN-HANDOFF.md`, and `docs/ENVIRONMENT-RESTORATION.md`.
- Astrid staging route: `/?dealer=astrid&performance=staged&rehearsal=1`. At the latest checkpoint it was running on `http://localhost:4176/` with separate temporary demo data. Verify the process before reuse; preserve any active hand.
- Source media, camera, per-frame tracking, generation receipts and review recordings: `web/public/dealers/astrid/performance/`.
- Recordings: `initial-deal-review.mp4` and `dealer-turn-review.mp4`. Both are silent visual evidence. The latest initial-deal recording ends during the final return; the application completed that delivery.
- Recovery: committed handoff and Git history, plus independent backups under `/Users/solvifyab/Desktop/Croupier-Backups/`. Do not rely on conversation history alone.

## What currently works

Astrid's staged player delivery and separate dealer delivery use one presented-video clock for actor RGB, actor alpha, foreground fingers, tracked server-issued cards and pickup/landing sound cues. Her own take handles the upcard, face-down hole card and additional dealer draws. Both deliveries share 72 entry/extraction frames. The player retains its original contact motion; a new continuation delivers to Astrid. Both now retain native 1080p RGB.

The long actor dissolves and per-card resets to a different idle have been removed. Keep the last presented actor visible until the next take's first frame is ready. This removes idle flashes during loading. Waiting currently holds a still resting frame, so natural idle continuity remains work.

The existing backend owns cards, shoe depletion, legal actions, balances and settlement. Keep it authoritative. No replacement game or wallet API is needed. Local guest access remains enabled at Kevin's request; do not reintroduce a forced login screen.

Initial dealing, additional dealer draws and settlement were exercised in the actual game. Refresh recovered 6 hearts / 8 diamonds against 9 hearts and a face-down hole card with the same $995 balance and $5 bet. All four dealers' goodluck lines played twice consecutively. The 90-stream asset audit, 32 hook/contract tests passed (check the current commit's CI separately). These are scoped results, not full visual or phoneme approval.

## Next work, in order

1. **Finish physical contact and continuity.** Resolve partial-card geometry at extraction, corrective slides after release, and the visible speech/idle background and pose change. Preserve the improved transitions. Inspect pickup, fingers, release and return frame by frame, then normal-speed rounds. If generated contact footage cannot pass, use controlled performance capture; do not label a floating-card substitute finished.
2. **Repair portrait composition.** The 390 × 844 check exposed overlapping player/dealer card fans and duplicate mobile header elements. Fix these while keeping the actor, shoe and table registered to one camera. Viewport emulation is not real iPhone/Android acceptance.
3. **Complete the action and speech set.** Add and verify left/right deliveries, filmed hole-card reveal, collection and shoe change while preserving seat/split support. Review every reachable Astrid gameplay line against its exact text and voice. Replace only failed takes. Keep the other dealers' working assets intact.

Do not promote this path to Astrid's default until complete-table acceptance passes: initial deal, hit, stand, double, split, insurance, blackjack, bust, push, settlement, collection, cut-card transition; repeat/mute/slow-load/hidden-tab/interruption behavior; recovery without another deduction; and desktop Chrome/Safari plus real iPhone Safari/Android Chrome.

## Speech, assets and spending

Use the shared speech player. Astrid goodluck and win already use finished MP4s with embedded speech audio; other existing takes use their matched streams and audio. Preserve each line's exact text, audio, video, timing and calibration as a set. Never loop unrelated mouth movement, stretch wording to fit a gesture, or restore rejected assets because a numerical score passes.

Treat measurements, keyframe overlays and any existing voice-board verdicts as evidence to investigate. They do not replace watching and listening in gameplay. Preserve Vera's working lines; change a particular take only for a demonstrated defect within the requested scope.

Higgsfield use for this work has already been authorized. Inspect each result before expanding generation, record job provenance and available cost information, and keep rejected takes out of gameplay. Old credit balances and cost estimates are historical. Verify current model parameters instead of copying old commands.

The older handover raises ownership of speech technology as a strategic concern. Keep the code, assets, provenance and provider dependencies maintainable. Do not replace the working media path or choose an experimental viseme rig/self-hosted model merely because that handover says to pick one. Any proposed change needs a concrete quality comparison, operating cost and verified licensing. Pasted mouth overlays were already rejected.

## Delivery discipline

Work in loops: reproduce a visible defect, make a focused change, inspect it in the real game, run the relevant regression checks, and save the evidence. Preserve unrelated dirty files. Use isolated test data and keep all dealers on shared interfaces.

Follow the repository's current media checks. `docs/SPEECH-SYNC.md` and `docs/SCOUT-LIVE-CASINO-ER.md` contain useful history, but their old generation commands, timing thresholds, calibration-rebuild instructions, budgets and “shipped” claims are not current acceptance criteria. Do not bypass calibration protection or copy the old deploy recipe without checking the actual environment and requested release scope.

At each delivery, update the handoff, commit only owned changes, push the review checkpoint, and retain an independent recovery copy. Report what visibly changed, what was tested, and what remains broken. Separate a passing code check, visual acceptance, user acceptance and deployment status. Keep updates short and concrete; continue routine authorized work without repeatedly asking Kevin to approve each step.

Start from the current Astrid table and the first unresolved defect above. Deliver the next verified gameplay improvement.
