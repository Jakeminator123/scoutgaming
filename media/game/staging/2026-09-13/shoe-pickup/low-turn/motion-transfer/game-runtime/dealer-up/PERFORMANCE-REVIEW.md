# Playback comparison — unfinished

Full-atlas HTML video: 17–19 dropped frames in85; cropped B2:19 dropped despite76% fewer pixels. Legacy-first isolation still12 drops, so preceding box3 is not necessary. B0 cropped:11 drops in each of two rounds; warm run fully buffered, readyState4,rate1. These measurements do not prove a causal B0 improvement because repeated conditions differ. All codecs/crops retain source geometry.

Native Annex-B experimental path decoded85frames in86.5ms and disposed85frames after playback; GPU disposed11resources. Actual1470x837 gameplay then presented43 updates beyond frame0 and skipped41 source frames over wallclock1.4167s. Most callback intervals ~33ms, JSpaint median0.4ms/max0.9ms. This is worse and is REJECTED as replacement. No low-power setting enabled according to read-only pmset. Browser/compositor cause remains unknown. The native flag stays opt-in, removed from user URL after test. Do not claim smooth60.

All sourceRGB and alpha pairs were checked for exact crop674,54,694,720 with>=14px anatomy margin. It reduces atlas pixels75.90% without resampling. Only whole actor camera similarity and source-supported card placement are used. Actual native test at1470x837 passed unchanged .02native corner tolerance and exactly one server-card landing; source wholehand layout versionv2 adds that viewport for review, not broad responsive approval.

Transition review rejected right96 to canonical entry: arm stacking differs and a visible hand lift is missing. Allseven coverage and naturalturnover remain incomplete. Three source-comparison proof images and exact hashes live in transition-review. These findings change the next action; repeating size/codec experiments without new evidence is not justified.

Build: build-media.py --crop 674,54,694,720 --no-b-frames; node build-ledger.mjs; python3 build-native-index.py. Native path additionally requires astridNativeFrames=review. Original committed full atlas remains in Git356925c; local full-atlas-v1 andcropped-b2-v1 preserve earlier candidates.
