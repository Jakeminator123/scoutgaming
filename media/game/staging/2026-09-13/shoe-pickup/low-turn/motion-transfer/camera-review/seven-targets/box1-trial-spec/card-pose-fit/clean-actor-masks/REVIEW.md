# Box1 conservative actor cleanup

97 grayscale native masks are ready. Original source RGB and all retained alpha values are unchanged. Removed 836,512 positive-alpha pixels across the sequence, all in components disconnected by more than8 pixels from the actor component. Nearby whole components remain, so no antialiased finger or hair contour is eroded. Proof compares raw and result at0,18,30,48,63,80,96 using original source RGB on a neutral background. These keys were inspected; the removed distant lower-right room fragment disappears and hands/hair remain.

The principal mask includes both hands in these inspected keys, even where the receiving hand looks detached at overview scale. Component connectivity is an implementation rule, not a semantic proof for every tiny pixel. The pass deliberately leaves connected chair/table bleed at torso0/48, shoulder lamp fringe30/96, and shoe fragments0/80/96. These need source-bound contour corrections. Connected sourcepaper is also retained for the separate hand/paper pass; do not use this R alone as final actor composite.

Apply contact integration's explicit paper removal delta after this R, then clamp foreground G<=final R. Receipt includes source and all mask hashes. No gameplay approval, no body warp, no generation, no full RGB exports.
