# Box3 clearance at captured1091×837 viewport — proposal only

Calculation is saved inlayout-clearance.json. It applies the FULL source registration s.99037,t[8.157,8.464] first, then actual livefit s.5697298989356931,t[.13448439316877722,43.76552544495207]. No actor adjustment.

Native94 observed corners[[926,788],[990,786],[998,851],[929,853]] map to screen[[527.271,493.212],[563.383,492.083],[567.897,528.759],[528.964,529.887]]. Actual measuredquad remains slightly nonparallelogram; this is clearance evidence, not final rigidpropfit.

Actual box3 betting rectangle x515.5…575.5,y525.6484…570.0468. Cardbottom529.887 overlaps its top by4.239CSSpx, within horizontalbetbounds. Thus currentlayout failscard/betspotclearance. ±3nativecorner uncertainty projects±1.693CSSpx before any additionalcamera-fit uncertainty.

Required downward bet/chip/hitarea shift:
- Bare zero-gap nominal minimum4.239px, inappropriate as a usable target.
- Nominal4px breathinggap requires8.239px; shifting only8px yields3.761px, about2.07px under adversecorner uncertainty.
- Provisional10px shift gives5.761px nominal and~4.07px after sourcecorner uncertainty alone. This is a reasonable REVIEW candidate, not completeproof because livecamera uncertainty and roundedbet/chip shape are additional.

At10px shift proposed spot y535.6484…580.0468, card stays fixed at its filmedposition. Move visualbetspot, chip and clickablehitarea coherently, not only chipart. This is a static seatlayout adjustment BEFOREround; do not animatecard away afterrelease. Update corresponding layouttarget/version rather than widening the existing4nativepx endpoint gate.

Neighborbetspotboundsbox2x394.4375…454.4375 andbox4x636.5547…696.5547 leave card~72.83px clearleft and68.66px clearright. Midpointcell between seatcenters is~484.97…606.03; cardbounds527.27…567.90 remaininside by~42.30/~38.13px. These establish horizontal firstcardclearance only.

Not yet proven: table/felt lowerboundary at proposedspotbottom580.05; betamount label/hitcontrols; handtotalbadge; fan2/3/5+ corners and rotatednth-child overrides; responsivephone geometry. Need actual DOM/screenshot bounds for rail/controls before calling10px safe. Existing cardsanchor[540.2686,472.6702] is not itself a cardcorner or fullfanextent and cannot prove clearance. Do not inferfan from just center or default19pxspacing through nestedtransforms.

Conclusion: firstcard fitscentre horizontally but overlapscurrentbetspot. A coherent approximately10CSSpx downwardbet/chip review adjustment could resolve measuredfirstcardoverlap, conditional on rail/controls/fanverification. No runtimechange, mediaedit, actorwarp or arbitrarytolerance expansion performed.
