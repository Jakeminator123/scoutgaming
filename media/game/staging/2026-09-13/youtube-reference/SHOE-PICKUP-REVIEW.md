# Shoe pickup rejection — 13 September 2026

User rejects visible card delivery without extraction from the shoe, and the dragged-out motion before delivery. This supersedes any interpretation of the prior seven-seat lifecycle QA as physical dealing approval.

Re-ran the requested claude-video watch script against the cached user-selected Evolution reference (dfE-7NV4Vh8), range 4–8 seconds, 1280px. The tool emitted eight chronological frames despite requesting 6 fps; these are sampled observations, not native-frame event measurements. Local report: /tmp/astrid-shoe-watch.txt; frames: /tmp/astrid-shoe-review/frames/. No third-party footage is shipped.

Reference observations: the viewer-right hand contacts the outlet of the shoe, presents one card to the other hand, and stays by the shoe while the dealing hand slides the card across the felt. The receiving hand returns empty and immediately takes the next card. Hand transfer, outward travel, release and return are visibly connected.

Compared six RGB samples from the actual installed smooth60 right take. Astrid already carries paper beside/above the source shoe, and transfers that paper near her body. This does not demonstrate a single card emerging from the outlet. The packed RGB still includes the original generated shoe/background, removed by the mask in gameplay; that source shoe is not proof of contact with the rendered game shoe.

Code confirms the separation: app.mjs passes tableScene.shoeOutlet() into PerformancePlayer.play, but that method never uses origin. It renders fitted source hand-proxy card corners, then moves the released card to the seat. The metadata explicitly says measured:false. Connecting the drawn card to origin alone would create a floating card unless a matching hand extraction is present. Do not repair this by stretching Astrid or labelling proxies as measured.

Start latency also has a separate cause: dealSequence waits for the full paired goodluck sentence, then the idle entry (121/60 = 2.017 seconds), before the take starts. The right take reaches its nominal pickup at frame 19/60 = 0.317 seconds. A later hit can wait up to the 67-frame ready loop boundary plus a 91-frame entry. These are asset/control-flow durations, not newly measured browser latency. Globally speeding the player or adding interpolated frames will not correct missing shoe contact.

Next source acceptance must prove, in one continuous camera-matched take: empty fingers approach the actual shoe outlet; one card exits under those fingers; a visible transfer to the dealing hand; release onto felt; empty-hand return. Review the same movement before and after person masking and in the actual table camera. Reject cards already held at the start, imaginary extra shoes, paper remnants, dissolves, and slides unsupported by hand motion. Only then bind authoritative game-card identity and pickup/release frames. Preserve paired speech and remove the unnecessary setup gesture using a newly matched direct entry, not a hard cut.

No gameplay/media modification or physical-pickup fix is claimed by this review. Existing transitions and higher-frame-rate playback remain review quality.
