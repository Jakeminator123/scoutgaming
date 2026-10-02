# Far-left source cadence versus real dealer

Re-inspected cached native60 reference extraction/turn/release frames every3 sourceframes, plus original far-left pickup10–23 grids, reach36–96 overview and continuation dense0–43. No generation, gameplay or media retiming.

Reference extraction283→release331–335 takes0.800–0.867s. Extraction283–291 about0.13s; transfer/turn292–309 about0.28s; low delivery310–330 about0.33s. Next extraction330–336 overlaps the firstrelease; next390–393 yields roughly0.8–1.05s between starts. Different destinations/distances are not identical motion constraints.

Current original10→continuation14 release spans100/24=4.167s; original10→continuation39 ready spans125/24=5.208s. Original0→96→continuation39 span135/24=5.625s, treating seam endpoints once. Source64–96 alone spends1.333s remaining in contact near destination. This long hold and serial return dominate delay; display60fps cannot remove them.

There is no evidence-backed claim of a universal minimum believable time. A useful hard sampling bound: preserving every native24 pose at60Hz permits at most2.5x. Even all phases at this ceiling take2.25s from original0 tocontinuation39 (136samples≈2.267s encoded),1.667s extraction10→release14 and2.083s extraction→ready39. Still roughly twice reference release latency and without next-card overlap.

The attached phase proposal is a conservative fast diagnostic:1.5x extraction/turn and finalslide,2x receivinggrip/release/emptyreturn,2.5x reach/setup/hold/settle. Total2.599s; extraction→release1.940s. This retains all actual poses at60fps and avoids blanket acceleration. Speed boundaries require continuous time-map easing, whose integral preserves phase durations, with RGB/R/G/card on one identical ledger. It is unrendered; no subjective realism approval.

A reference-speed subsecond release is unavailable from this full source with all poses retained. Shortening original64–96 could recover0.5s at2.5x, but those are not proven exact duplicates; skipping them needs registered actor+hand seam evidence. Regrip25–35 has real fingers and cannot be treated as idle. Original18–20 has only a few native edge-crossing poses; interpolation may smooth display but cannot reveal hidden grip or correct sourcepaper size. Continuation0–6 has large paper growth/print morph requiring independent rigid prop, not timing fixes. No speed curve creates missing next-card feeding overlap or six other seat reaches. Afterready39 a decision pause can be valid for a single hit; it should not be inserted between every opening card.
