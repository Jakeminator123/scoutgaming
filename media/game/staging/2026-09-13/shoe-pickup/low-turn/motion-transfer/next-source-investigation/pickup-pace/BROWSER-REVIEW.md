# Browser pace test — not smoothness acceptance

2026-09-14, in-app browser, document.visible, DPR2. The25-frame1920x1080 derivative was exercised through actual UI controls. Canvas crop playback dropped5/25 and6/25 decoder frames in consecutive plays. The same file on a direct visible HTML video surface reported0 dropped (quality counter delta21; callbacks17, not25). A repeat on the direct surface reported1/25 dropped and21 callbacks. Therefore it is not legitimate to claim measured60fps presentation from this test. Source frame selection and60fps encoding alone do not prove smooth rendered motion.

The difference points to a presentation-path cost or scheduling difference worth isolating, not a proven decoder bug. The active game uses a different compositor; these measurements must not be presented as game performance. browser-proof.json, browser-repeat-proof.json and browser-native-proof.json preserve public DOM receipts.

The primitive still ends partway through extraction; no transfer, release or empty return was added. No gameplay change, generation, or credit use occurred in this experiment.
