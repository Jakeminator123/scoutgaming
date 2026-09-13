# Required camera evidence

Capture through the existing UI, at zero stake:

1. Record exact URL, viewport and screenshot; mode matters because table-scene now has a separate contactProof registration branch.
2. Open calibration, click Capture clean camera reference.
3. Read #performance-capture-status.dataset.registration. Save viewport, camera projection/world matrices, shoe matrix/world outlet/normalized screen outlet, and dealerRect together. Save clean screenshot before Escape restores controls.
4. Compare model outlet screen.x*viewport.width and screen.y*viewport.height with the source's annotated physical outlet after uniformRegistration(sourceCamera, viewport). Sources are full-scene1924×1076/1344×752 frames, not dealer-relative crops. Do not multiply whole-scene source coordinates by dealerRect.
5. Inspect screenshot alignment of shoe corners/mouth, not just a single point. A matching mouth with mismatched shoe scale/angle still fails finger contact. Record feeding fingertip and card leading edge in native source during extraction, transformed by the exact same global fit.
6. Compare stable face/shoulder position to preserved idle using a matching camera screenshot. Shoe correction must not distort the actor.

Public code confirms tableScene.registration exposes authoritative model projection; performance-player uses uniformRegistration(take.camera, viewport) for overlay. getBoundingClientRect on #shoe2d is a fallback UI rectangle, not the authoritative 3D outlet. Browser methods used are documented CUA tab.click(index), tab.getAXState(), tab.playwright.evaluate(readOnlyDOMFunction), tab.getScreenshot({emit:false}), tab.pressKey('Escape').

This QA agent's browser inventory remained empty during the capture handoff; root owns live tab29. No exact live coordinates are invented here.
