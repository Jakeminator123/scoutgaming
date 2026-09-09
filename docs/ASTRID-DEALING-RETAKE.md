# Astrid dealing take — rejected for gameplay realism

User review, 8 September 2026: “her handmovement looks like she is shuffling not dealing cards”.

## Verified defect

The currently indexed `idle-1/actions/action-deal` moves both palms over cards that are already on the tabletop. It does not contain a visible shoe pickup. Fingertips leave the source frame. The measured release cues improve timing but cannot turn this action into authentic dealing. Do not mark the existing take approved or copy its motion to other dealer identities. The existing asset is retained for comparison. See the 9 September checkpoint below for replacement research.

## Approved visual direction

Kevin approved the four-panel concept on 8 September 2026: pickup, guide, release, rest. The saved storyboard is `reference/astrid-dealing-approved-concept.png`. It is an art-direction reference, not an implemented animation or proof of exact grip geometry.

The rejected Astrid action is now disabled for gameplay through its cue status. Initial deals and hits use direct shoe-to-seat card animation with the dealer resting until an approved replacement is integrated. This is a temporary fallback, not completion of the hand-action requirement. Speech assets and their calibration are unchanged.

## Required replacement

Use the same Astrid identity, outfit, lighting, camera and room. Stage a single-card action with enough lower and side framing to contain both hands, the shoe outlet and the full delivery path. Preserve a matching resting pose at both ends. Keep her mouth closed throughout the action so dealing does not introduce another speech mismatch.

1. Rest briefly with hands still.
2. Reach to the actual shoe outlet shown in the game. Use the current 3D scene as the spatial reference; do not choose an unrelated position from a generated room.
3. Extract one card. Show clear fingertip contact, not two palms rubbing or tapping a pile.
4. Carry/slide that same card toward one target with a continuous hand path.
5. Release once, then withdraw naturally to rest. No extra dealing gestures between requests.

Generate/film against a staging scene, keeping any photographed props out of the final actor matte. The server remains authoritative for the card face; generated card faces must not become independent game cards.

## Integration contract

Measure and retain pickup, contact, release and return frames. Start one action per server-issued card. The 3D card starts at the shoe outlet, remains at the tracked fingertips during contact, and leaves the hand only at the release frame. Use proper hand occlusion rather than letting the card travel through the palm. Wait for the landing before advancing game totals. Keep speech clips and calibration untouched.

Prepare additional target directions only after the first single-card action passes review. A loop with a fixed generic hand waypoint cannot establish contact at every seat. For Amira/Mei, create their own identity-matched action; do not substitute Astrid's footage.

## Acceptance

Watch the actual game at normal speed, then inspect pickup/release frame by frame. Test initial deal, one-card hit, double, split and dealer draws. Reject doubled cards, a second gesture without a card, floating cards, shuffling/rubbing motions, clipped fingertips, camera drift or an abrupt return cut. Repeat at narrow and wide viewport sizes. Update asset hashes only after documenting this visual review; a passing regression baseline is not visual approval.

## 9 September replacement checkpoint

Higgsfield credits were confirmed available. Several Seedance takes were generated and reviewed. The initial take reframed the actor; the eight-second retry preserved framing but contained generated cards, including one retained by the person matte. An empty-hand regeneration raised the hand instead of dealing. These were not promoted.

Targeted Seedance 2.5 video cleanup (job `36f7b6e4-746d-4b20-9094-a585695745d2`) removed the card props while retaining the low single-card movement. Source and prompts are preserved under `content/staging/2026-09-09/`. A review copy is committed at `web/public/review/2026-09-09/astrid-deal-cleanup.mp4`.

`/review/2026-09-09/contact.html` now demonstrates a real Three.js card following measured index/thumb positions on the presented video frame. Pause, seek and replay use the video clock; pickup and landing foley use cue crossings and suppress stale/hidden cues. This is an isolated review fixture, not an authoritative game draw.

**Still not accepted for live dealing:** exact fingertip occlusion, pickup alignment with the actual table shoe, and target-specific releases remain unresolved. The live rejected-action safeguard stays enabled. Do not report all dealers' hand synchronization complete. The next integration must satisfy the contract and acceptance cases above before promotion.
