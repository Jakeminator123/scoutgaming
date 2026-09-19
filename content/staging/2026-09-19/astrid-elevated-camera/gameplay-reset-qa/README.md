# Astrid playback reset — 2026-09-19

Scope: remove old Astrid videos from ordinary gameplay; preserve approved green first-upcard take. No generation, table adjustment or production deployment.

The isolated guest used astridreset.localhost:4190. Its round dealt dealer6-hearts and player3-clubs/A-diamonds. Hit addedK-hearts for14; stand completed settlement, returning0 on5 with final balance995. Replay showed take `astrid-elevated-first-upcard-de1f90a9` at native frame4. Action/rest registration matched exactly at desktop: left423.703125, top10.8125, width519.109375, height410.9609375. The old dealer wrapper was hidden throughout. Rest hidden during playback, visible with no action layer after settlement. No browser warnings/errors.

Screenshots01–04 cover this round and replay. Screenshot05 is the refreshed user table with its original room plate preserved. No actions were played on the user's hand. Earlier QA screenshots01–04 predate the final room-plate preservation flag; actor placement and gameplay code did not change afterward.

Temporary rest source: source.mp4 SHA256 `dfaeea2b4dae3cad918a2a3af9114d261131939ea636cf2e3427172b3b33402b`, native frame96 from existing RGBA masking output, crop960:760:560:0. Public rest.png SHA256 `7dba7289c645ee59ea1a53f8e46306a623af51cd4762432cef4194dd3674c429`. No RGB modification or new generated motion.

Checks: four focused first-upcard tests, dealer sync probe, repository precommit suites passed. Remaining: new idle not generated, recorded speech intentionally disabled, other card events have no new Astrid motion, source endpoint/start pose cut still exists. This is removal acceptance, not full visual acceptance of gameplay.
