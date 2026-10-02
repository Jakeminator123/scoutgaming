# Economical pickup and turnover: refined native reference

Reviewed every encoded native frame n276–335 of cached dfE-7NV4Vh8 at 60 fps, 4.600–5.583 seconds. Source is 1280×720; compression/duplicated frames limit precision. Inspection sheets stay outside Git: /tmp/astrid-turn-native-276.jpg, /tmp/astrid-turn-native-306.jpg, /tmp/astrid-low-turn-detail.png. This is visual analysis, not measured 3D motion capture.

## Exact observed sequence

| Native frames | Time | Visible action |
| --- | --- | --- |
| 276–282 | 4.600–4.700 | Receiving hand waits open beside outlet, already near the feeding hand. No large reach from rest is needed. |
| 283–291 | 4.717–4.850 | Feeding fingertips slide one back-up card clear of outlet, close to felt, into the waiting receiving hand. |
| 292–301 | 4.867–5.017 | Card briefly tips upright between the adjacent hands. Receiving fingers support lower/trailing region; feeding fingers release the upper region. Exact hidden thumb placement cannot be proved from this compressed angle. |
| 302–309 | 5.033–5.150 | Receiving wrist completes compact turn and immediately travels outward; feeding hand already returns to outlet for next card. |
| 310–330 | 5.167–5.500 | Face-up card is pushed/carried low under receiving fingers to its destination. |
| 331–335 | 5.517–5.583 | Receiving fingers separate and hand returns empty. |

**Correction to an overly strict earlier interpretation:** the real dealer briefly presents the card near upright during turnover. It is not physically correct to reject every upright instant. The failure in our generated sources is the sustained upright/edge-on hold, unnecessary height/travel, and re-lift after turnover. Here the upright phase is roughly 0.15 seconds, coupled to the transfer, not a separate display action.

## Height and hand geometry

In the reference the card remains in the shoe-mouth/forearm band throughout the transfer. At the briefly upright n298 pose its lower edge is near the felt/outlet base, and its upper edge remains below the top of the shoe's loaded stack in screen projection. It is not suspended by its top edge in front of the chest. Perspective prevents assigning trustworthy centimetres from this video; use these visible relationships rather than invented 3D distances.

The waiting receiving hand is beside the outlet before extraction. Its forearm lies low across the rail/felt. The feeding hand only travels about one card width from the mouth to the handoff and is already preparing the next card while the receiving arm slides the current card outward. The principal rhythm is adjacent handoff, compact turn, direct delivery; there is no centre-body pause between those actions.

## Why our anchors encourage the wrong action

1. Original empty-hand start places the receiving hand far from the shoe. The model first has to cross the table to establish transfer.
2. Exact edge-on anchor depicts a thin dangling edge pinched near the upper end. It makes a long suspended card plausible and hides whether the lower edge is supported by felt. Its isolated geometry does not specify a compact temporal transition.
3. The face-up endpoint lies near the body's centre, roughly 200 pixels left of the shoe in the 1344px anchor, so motion must carry the card inward before the slide begins.
4. Separate three-second endpoint clips encourage a hold at each intermediate pose. Retiming shortens these but cannot remove their unnecessary spatial path.

## Minimal replacement poses

**A: ready at outlet.** Keep Astrid identity, exact shoe/camera/table/long sleeves. Feeding fingertips poised at mouth; empty receiving hand already beside it, palm positioned to receive, elbows low. No card in hand yet. This avoids a long crossing setup.

**B: post-turn, immediately beside outlet.** One face-up card already low/nearly flat with receiving fingertips on its trailing edge; hand/card no more than approximately one source-card width from the outlet. Feeding hand empty and already back at shoe. Card's lower edge touches or nearly touches felt; no hanging upper-edge pinch and no card at body centre. This is the most useful minimal new anchor for the end of a continuous pickup+turn segment.

If an intermediate anchor is necessary, show a **brief supported tilted card** with lower edge close to felt between adjacent hands, rather than demanding an exactly two-pixel edge or arbitrary horizontal long edge. The physical projected edge orientation depends on Astrid's unchanged camera and wrist axis. Forcing a horizontal line is not supported by the reference and can create a new geometry error.

Retain existing destination-contact anchor for the slide only if its camera and paper size align. It already corrected detached drift by leaving receiving fingertips on the destination card. Then empty-return may follow.

## Timing target and acceptance

For a bounded next source attempt, extract/transfer/turn should occupy roughly 0.4–0.5 seconds, then outward travel/release roughly 0.35–0.45 seconds, immediate empty return. These are reference-derived approximate targets, not a guarantee that the image/video model will comply. Preserve full card continuity and anatomy; do not satisfy timing by cutting away the actual wrist turn. Verify adjacent waiting hand, outlet exit, supported brief tip, face-up flattening, outward travel, release and empty return in one continuous camera before claiming improvement.
