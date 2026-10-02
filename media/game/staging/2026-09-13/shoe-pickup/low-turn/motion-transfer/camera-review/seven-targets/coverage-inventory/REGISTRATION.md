# Can existing nearby placements be registered onto boxes2–4?

No supported static whole-actor registration currently satisfies both the existing shoe alignment and these exact landing centers. This calculation deliberately allows similarity scale as well as rigid rotation/translation, so failure is not an overly restrictive translation-only test.

| Target | Candidate source card | Translation needed | Exact pivot-constrained landing: rotation / scale | Largest resulting shoe-landmark displacement |
|---|---|---:|---|---:|
|Box2|4|69.30px|6.35° /1.08362|21.69px|
|Box3|3|43.56px|6.91° /1.00396|18.38px|
|Box4|1|45.37px|13.82° /1.00450|36.73px|

Native coordinate basis is1920×1080. Pivot(1257,626) is the observed initial distal paper boundary from first-pose anchors, not an independently measured pressure-contact point. Exact hand pressure and occluded corners remain unknown. Five source shoe landmarks come from live-shoe-fit.json; their existing registration has1.22 CSS-pixel RMS. Source landmark uncertainty is about3 native pixels and live2 CSS pixels. Large rotations around a single outlet point do not preserve extraction direction or the established shoulder/head orientation.

An equal-weight least-squares similarity on all five fixed shoe landmarks plus the requested landing retains errors: box2 landing8.95px/shoe max14.80px; box3 landing8.44px/shoe max11.23px; box4 landing17.16px/shoe max14.67px. These are compromise examples, not optimized visual acceptances or a proof that no other weighting exists. Exact preservation of two distinct corresponding shoe landmarks fixes a similarity to identity, which retains the original43–69px destination misses.

The stationary rendered shoe is not part of the actor alpha. Transforming its landmark coordinates here measures the changed camera relationship that the actor's feeding hand would inherit; this is not a proposal to move the rendered shoe with the actor. Matching only one pickup pixel while rotating the body6–14° is insufficient physical registration. A time-dependent body transform that starts aligned and later shifts to the target would create the body dragging the user rejected.

Conclusion: these clips remain useful extraction/turn references, but their existing native placement segments cannot be accepted for these exact centers through static uniform registration alone. A different recorded reach, genuinely articulated new source motion, or independently validated source reanimation is needed for the placement segment if centers and the current camera remain fixed. This does not prove paid generation is the only remedy, and does not forbid reusing clean pickup/return portions with proven seams. No local arm warp or floating-card-only correction is supported.

Reproducible inputs/calculations: measure-registration.py and whole-actor-registration.json. Original source, actor masks, public gameplay, and camera remain unchanged.
