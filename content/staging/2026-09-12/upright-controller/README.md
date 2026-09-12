# Private upright runtime diagnostic

Use dealer-rig-upright.mjs with profile.json and the unchanged Sept11 finger-candidate-v1/astrid-rigged.glb. When copying into a private web runtime, rewrite the two imports from ../../../../web/public/ to the runtime-relative vendor and dealer-motion paths. Public files and Git index are untouched.

Idle is centred at root [0,-0.12,0] with torso lean 0.05 rad and matching head counter-rotation. Approach smoothly enters action lean; return fades back to the identical idle. Elbow poles have a modest outward offset. Finger weights and geometry are unchanged. The support anchor uses the lowest actual whole-hand skin point: fingertip-only masks missed up to 20 mm of palm penetration in the initial trial. This change is whole-hand support, not approval of anatomical fingertip grip.

check-upright.mjs loads the actual V1 GLB and independently evaluates Three.js skin transforms for 707 states (101 per seat). checks.json: all seven seats pass reach/contact/felt checks; minimum hand floor 0.9112499 m against felt 0.91055 m; support error up to 0.7002 mm; zero return residual. Maximum wrist displacement per 1/100 progress sample is 47.1 mm. This is not a speed/acceleration or full motion quality approval.

Actual controller matrices are rendered in upright-idle.png and centre-release.png, with editable .blend snapshots. Native/runtime bone-head agreement is within 0.00151 mm. The diagnostic plane is not the game table. Visual inspection confirms upright idle, but the rejected model still has crushed/twisted sleeve shapes and an unacceptable face/hair source. The lean during centre release is substantial. No likeness, cloth deformation, card grip or complete gameplay acceptance is claimed. Root owns Chrome review and the new source.
