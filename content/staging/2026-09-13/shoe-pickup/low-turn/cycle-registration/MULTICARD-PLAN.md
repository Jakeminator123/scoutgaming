# One continuous multicard motion candidate — no submission

Primary route: Higgsfield MCP `generate_video`, model `hf_mult_motion_control` (Genjutsu), resolution1080p, count1, one canonical `image` reference and exactly one canonical `video` reference. The tool explicitly routes copy/transfer-motion intent here. Current model schema advertises480p/720p/1080p; it exposes no frame-rate, duration, camera-strength, pose-strength, seed or audio control. Do not invent those parameters. The driving clip should be the required4–6s duration; output duration inheritance must still be verified after preflight/provider response, rather than promised from an absent schema.

`multicard-request-DRAFT.json` contains the exact supported request shape and prompt, with an explicitly unresolved reference-video UUID. Image is accepted ready job dd01ae2e-cfb1-40c1-9bb6-43e16fda47f1 (`low-turn/ready.png`), already used as pickup start. No upload, estimate with fabricated media, paid generation or free allowance consumption was performed.

## Reference preparation constraints

Use gameplay QA's continuous4–6s cached real-dealer trim. Retain original cadence and every native frame; no speed change, reverse, stitched cycles, freeze frames or cuts. Select a segment containing repeated outlet extractions and visible overlap: feeding hand returns to/prepares the next card while receiving hand delivers current card. Keep the shoe mouth, both complete hands, wrist turns and destination releases visible. Start just before an extraction, not half way through a transferred card; avoid ending before final release if possible. Document the exact trim frame range, duration, count of cards, native fps and SHA before upload. Do not claim hidden grips measured.

Motion direction must be checked: Astrid's feeding hand is viewer right and receiving hand viewer left. If the real reference uses the opposite handedness, do not silently mirror it or force conflicting exact motion; flag to root and choose a compatible segment or deliberately prepare an explicitly documented mirrored motion-only reference. Retain Astrid's original room/shoe/camera in the image. Reference motion is guidance, not measured skeleton transfer or a guarantee of object contact.

The useful native sequence already inspected at reference n276–335 shows receiving hand ready beside outlet, extraction283–291, brief supported upright tip292–301, turn/outward302–309 while feeding hand returns, delivery310–330, release331 onward. The next candidate must preserve that overlap across successive cards, rather than serializing pickup/slide/return. Aim at the trim's observed roughly0.8–1.05s extraction intervals, not a hardcoded timing contradictory to the selected segment.

## One-job selection and validation

Do not submit a comparison batch. After the real video media UUID exists, root may perform read-only `estimate_video_cost` with the exact same params to catch role/schema restrictions, then submit the one chosen job if authorized. Do not request a free1080 run: the currently listed free allowance only covers480/720, and the user has not specifically requested spending it. No new approval flow is implied by this plan; root already controls authorized generation.

On completion verify real extracted card count and extraction-onset intervals; feeding/receiving overlap; every card's outlet origin; rigid red-back→narrow edge→face turn; sustained hand contact until release; stationary accumulated dealt cards; intact hands/sleeves/body; original Astrid face/camera/colour. A correct frame count or higher resolution does not satisfy this. Do not integrate a generated card into game state; root retains analytic game-card rendering and separately validated occlusion masks.

## Alternatives discovered, not additional jobs

Live Seedance2.0 supports4–15s,1080p/4K in std mode, high bitrate, silent output and video references. Seedance2.5 live schema now supports1080p and omni_reference mode; the local skill's720p cap is stale. Kling3.0 advertises motion-transfer tags but the returned media roles expose only start/end images, so do not assume a video reference works through that model. If Genjutsu cannot preserve Astrid's target framing or demands incompatible source layout, root can replace the one planned job with Seedance2.0 std1080p duration6 high bitrate generate_audio:false, ready as start_image and driving trim as video. This is a contingency, not authorization for a second job.

Discovery receipts: `motion-capabilities.json`. Read skill `/Users/solvifyab/.agents/skills/higgsfield-generate/SKILL.md` and media-input reference; user's explicit MCP requirement overrides the skill's CLI bootstrap. No CLI installation/authentication was attempted. Live MCP schema overrides stale documentation on supported resolution/audio fields.
