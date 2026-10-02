# Current isolated game rejection

The user-visible 1091×837 game rejected the v2 candidate before loading/painting it: `Current first-card target differs from reviewed endpoint`. Earlier 1280×720 one-handoff evidence does not show this viewport working. Other deliveries explicitly use the legacy path; only Astrid box0 first card is eligible. This is not seven-seat delivery and the newer box1 source is not substituted for box0.

The source and table use uniformRegistration; table-scene group.scale follows fit.scale and layoutSeats projects its unchanged seat anchors. The DOM hand still uses fixed 46px cards, pixel offsets and transform origins. Saved isolated-game-targets.json already records responsive residuals. The proposed correction scales the entire local hand affine transform about the seat anchor (seat-inner [60,60]), preserving card proportions, fan and table seat. It does not retarget or warp the actor. Actual corner errors are logged before the unchanged acceptance guard.

Source ledger/media remain v2, explicitly visually failed: early finger holes, rough edge-on card and source-shoe debris. New actor ownership will hide both legacy wrappers and other performance layers only during the candidate, then restore them. Optional canvas captures are not full-scene screenshots or moving visual acceptance.

Live 1091×837 verification: pre-correction errors [6.7368,7.1868,3.5053,3.6157] native px; after [0.0035000,0.0034780,0.0034565,0.0034782]. A bounded .02-native-px CSS serialization allowance replaces .001; no ledger, actor or target geometry is moved.
