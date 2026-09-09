# Astrid front-outlet repair — 9 September 2026

The staged game now uses the same photographed front-outlet pickup for player and dealer cards. The previous own-card source picked from the top of the stack; it is retained as historical source, but no longer selected by the manifest. No shoe position, game API, wallet state or other dealer's speech was changed.

## Source and registration

Both deliveries begin with the same 72 frames: the existing 24-frame empty-hand preparation followed by original player frames 0–47. The new own-card continuation starts at the original player's frame 48, already extracting a card from the front black outlet. It slides that card left to the dealer's position and returns to the folded resting pose. The top of the shoe and cut marker are untouched.

The four-second continuation is Higgsfield Seedance 2.0 job `5342f3c5-0d6d-43e0-9c92-4776b3beb1cd`, native 1920 × 1080, 24 fps, 97 frames. Its first and final reference images, prompt, receipt, measured frames and masks are in `content/staging/2026-09-09/dealer-front-continuation/`. The original continuation and assembled native source are also checked into the public performance asset directory. The original player action and empty-hand preparation remain preserved.

The completed own-card take has 169 presented frames, with pickup 69, release 113, landing 120 and settled rest 144. The player take remains 169 frames with pickup 69, release 116, landing 122 and rest 154. Prefix records and masks are copied exactly. Quad labels in the continuation are rotated cyclically to preserve card artwork orientation; this does not move measured points. `sharedExtraction` validates that the first 72 records, pickup event and outlet stay consistent. This is a regression constraint, not an independent visual-approval claim.

`pipeline/pack-contact-media.mjs` encodes the original photographic RGB at native resolution, with the existing normalized mattes scaled to match. Previously both actions were reduced to 1280 × 720. The new packed media is 1920 × 2160: 1080 RGB rows plus 1080 mask rows. The matte analysis still uses 720p inputs; this change preserves source detail, not new detail invented by upscaling the RGB. The camera fit stays identical because its aspect ratio and all normalized coordinates are unchanged. Native resolution does not remove blur already generated into the footage.

`build-contact-review.mjs` and `prepend-contact-entry.mjs` now use the native packer. The former accepts an optional public directory and unique asset name, builds privately, validates records/frame counts, and then publishes. `media-recipe.json` supplies native source segments; `shared-prefix.json` identifies the approved-for-reuse extraction records. Rebuilding a take changes its hash and returns it to pending visual review. Do not copy an old approval onto new bytes.

## Actual-game evidence

QA ran on a new temporary database at `127.0.0.1:4177`, recorded in `/tmp/astrid-outlet-qa-current`. Kevin's 4176 preview and its database were not used for fixtures or reset. The repo's public files are what 4176 serves; reload after the current hand to load the new named media.

- A complete 39.977-second initial-deal screen recording includes both player cards, the dealer upcard and the face-down hole card. All actions reached their final frame. It contains 340 timestamped screen samples; maximum capture gap was 0.682 seconds. This is a silent screenshot recording, not a lossless 24-fps source capture or proof of audio output.
- `initial-deal-review.mp4` is the full recording. `dealer-turn-review.mp4` is a 7.5-second excerpt of its own-upcard delivery, explicitly labeled as an excerpt in the review UI. The full recording also shows the hole-card pickup.
- An earlier isolated dealer turn drew a 3 diamonds onto 4 hearts / king hearts and settled against player 18. This exercised the new continuation; the prefix artwork-label correction was applied afterward and verified in the final initial-deal recording. Do not substitute that earlier recording as the final texture-orientation proof.
- Refresh restored player 7 hearts / ace diamonds against king clubs and the same $1,000 balance / $5 bet. Later rounds also settled normally. No new backend draw or deduction was introduced by the animation.
- All four dealers played `goodluck` twice consecutively. Astrid retained embedded audio/video; Vera, Amira and Mei retained their matched streams. `outlet-playback-checks.json` records the non-overlapping start/end events. These checks do not approve every phoneme or every speech line.
- Deep 90-stream dealer audit, native performance probes and all 32 hook/contract tests pass. The new tests protect native-resolution registration and shared extraction. Browser error/warning inspection during final initial-deal review was empty.

## Still unresolved

The legacy speech/idle clips contain their own baked room background. Switching to the isolated dealing actor exposes a different room plate and slightly different body/face pose. This remains a visible transition, despite the improved shared action prefix and held last frame. A single consistent room plus calibrated isolated speech/idle takes is still needed; do not add a long dissolve or face morph to conceal it.

Partial-card fitting during early extraction, corrective release-to-fan slides, moving-card versus DOM-card appearance, soft source frames and matte edges still need refinement. Left/right delivery variants, filmed hole reveal/collection/shoe change, full Astrid speech review, portrait layout and real Safari/iPhone/Android acceptance remain open. The entire table is still staged, not approved as the default realistic-table milestone.
