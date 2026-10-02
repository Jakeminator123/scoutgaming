# Complete table support

The Blender base was clipped by the video-sized render viewport. Full-canvas projection now preserves source-frame screen positions while exposing geometry below the video frame. Original GLB, camera pose, actor mask and0.85 framing remain unchanged.

`full-base-user-view.png` shows the complete support in the user's1117×837 table. `action-base-visible.png` shows it during the approved first-upcard replay. A separate guest round exercised the game-issued hit path (5-spades/9-spades +3-hearts =17, stand). `result.json` records the final outcome and browser errors.

Six focused camera/action tests pass, as do dealer-sync probe and the repository precommit checks. One attempt to capture native60 timed out before that frame; the successful replay capture and player logs were inspected afterward. This was a capture timing limit, not a gameplay failure.
