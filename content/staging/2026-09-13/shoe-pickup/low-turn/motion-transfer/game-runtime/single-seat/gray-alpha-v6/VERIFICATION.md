# V6 gray derivative

89 decoded frames verified against the original source PNG RGB and v6 R/G before encoding. Fixed crop1072×752, three tiles1072×2256, High420 CRF14,1,182,645bytes. No source/actor transform or RGB editing. Original native frame map and final105 preserved.

Normalized absolute errors: {"rgbError": {"meanAcrossFrames": 0.004758003713969189, "maxAcrossFrames": 0.196078431372549}, "rearError": {"meanAcrossFrames": 0.00035115222987881897, "maxAcrossFrames": 0.2784313725490196}, "frontError": {"meanAcrossFrames": 5.563195645927394e-05, "maxAcrossFrames": 0.27058823529411763}, "combinedAlphaError": {"meanAcrossFrames": 0.0003779762814134399, "maxAcrossFrames": 0.2684659746251442}}

Gray rear/front are computed before encoding. Lossy derivative, not pixel identical. Shoulder strips remain inherited. See receipt.json for each frame/source hash and error.
