# Reusing box0 for subsequent cards

Do not remove `index===0` alone. The second card's existing CSS fan differs from the reviewed landing by approximately 29.81×10.05 screen pixels at reference viewport, plus 6.5° rotation. Largest corner displacement is 66.08 native source pixels. The first slot has an extra -12px adjustment that the second does not; counting only the nominal 19px card spacing underestimates this difference. See SUBSEQUENT-BOX0-ANALYSIS.json; values are analytical CSS reconstruction, not fresh browser measurement.

The actor's receiving fingertips still contact the first-card location. Applying the second fan quad throughout that same filmed contact would detach card and fingers. Translating the actor would move her away from the fixed shoe. Allowing this mismatch through the endpoint tolerance would hide a real error.

Bounded safe next step: capture actual first/second DOM quads and existing first-card position during an isolated two-card round, retain the same canonical actor and independent issued-card identity, and validate a separate source/contact trajectory for the second fan position. No generic transform of the box0 motion can establish contact at that 66px-displaced endpoint.

A separate optional game presentation could land each card at a shared dealing spot, then arrange it into its fan only after observed finger release. This preserves contact during the clip but introduces an explicitly authored card movement without filmed pushing; it is not a realism fix and must not silently replace the requested natural dealer motion. Do not ship it as a matched second-card deal.

The adapter can already bind the static slot to another authoritative shoeDraw ID; identity reuse is not the blocker. Target/contact geometry is. Keep the first-card guard until one of the explicitly reviewed per-card landing approaches exists.
