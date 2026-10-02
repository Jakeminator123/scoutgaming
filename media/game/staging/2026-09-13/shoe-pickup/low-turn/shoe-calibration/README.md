# Shoe alignment measured against captured game camera

Visible shoe geometry is compatible with uniform registration within manual landmark uncertainty. **Ready and source7 do not share the same fit**: source7's five visible wall/base endpoints lie about5.66 px below the captured game shoe after its actual runtime contain fit, whereas ready's lie3.35 px above it. A shoe-only fixed offset cannot fix both clips. No public change made.

`measurement.json` contains each native landmark, mapped coordinate, per-landmark residual and least-squares solution; three enlarged coordinate-grid images make the annotations inspectable. Points were manually selected on glass tips and dark base corners, uncertainty about2 px in game/ready and3 px in source7. Exact numeric fitting does not remove that observation uncertainty.

| Image | Actual runtime transform | Best whole uniform transform to game | Landmark RMS |
| --- | --- | --- | --- |
|ready1344×752|scale0.776595745,x118.127660,y0|scale0.779771102,x113.659519,y2.109499|1.282 px|
|source7 1920×1080|scale0.540740741,x120.888889,y0|scale0.550953244,x108.327647,y−11.561165|1.019 px|

The source7 fitted scale is1.889% above runtime. These are **shoe-landmark fits only**: applying them to the whole actor requires matching face/shoulders/rail and clip seams before adoption. There is no evidence here that rotating or deforming the actor is necessary. No actor pixels were warped.

## Exact model outlet versus physical source exit

Captured `registration.json` projects the model outlet to **[781.1332615613,349.7307944557]** in the1280×720 game viewport. Under source7's actual current uniformRegistration, the exact inverse coordinate is **[1220.9998672709,646.7624281031]** in the1920×1080 source. This is an exact mathematical target from the camera, **not an observed source card exit**. In ready and source7 the feeding fingers cover the mouth/card contact. The remaining visible dark base is not a reliable substitute for the physical slot; assigning its centre would fabricate precision. The registered outlet is itself an explicit Object3D design point, not a tracked filmed card contact.

Consequently, exact physical exit equality cannot be certified from these two stills. Required next evidence is the first actually exposed card plane/edge crossing the slot in consecutive pickup frames, with tracked card corners and uncertainty, then its contact-frame projection against the current model outlet. Use the independent card origin from registration and verify it remains under the real fingers; do not translate the card alone to hide a miss. Root's source tracker should supply that contact point before promotion.

## Minimal shoe-only adjustment if actor registration stays fixed

`web/public/table-scene.mjs:139–140` sets shoe root `(shoeX,5,shoeZ)` and yaw−0.62; `shoe-model.mjs` outlet is local `(0,h*.16,l*.53)`. Captured group scale is0.8111111111 and camera is45-degree orthographic. At constant tabletop height, screen delta(dx,dy) corresponds to shoe root deltaX=dx/0.8111111, deltaZ=dy*sqrt(2)/0.8111111.

To move the game shoe toward **source7's existing fit**, the five-landmark mean screen delta is **[−0.64148,+5.65630] px**, giving root **Δx−0.79087, Δz+9.86204**, keeping y and yaw unchanged. Translation-only remaining landmark residual is about1–2 px. This is a proposed staged starting value, not a physical-contact-approved change. Move the shoe shadow by the same tabletop delta. The outlet moves automatically with the root; capture registration again and use that new origin for authoritative card flight.

Ready instead asks root Δx+1.95949,Δz−5.84275. That opposite direction is why a single shoe move cannot align uncorrected ready and source7. Prefer registered per-clip whole transforms with actor/seam validation first. The visible side-wall slopes do not establish a meaningful yaw mismatch beyond image uncertainty, so do not introduce an arbitrary shoe yaw correction.

Reproduce with `measure.py` using existing bundled Python/NumPy/Pillow. This is offline capture analysis; browser was not recaptured and no physical pressure/contact success is claimed.
