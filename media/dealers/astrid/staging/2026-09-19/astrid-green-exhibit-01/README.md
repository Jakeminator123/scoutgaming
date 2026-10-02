# First green-screen test — rejected movement

User authorized a single first green-screen exhibit, using existing selected generations as reference data. Live backoffice was read through the existing deploy account, without writing any remote data. The sanitized snapshot contains 17 `want` and 52 `no` verdicts. The prior explicit selection `a9fa1da6-066c-47f4-8466-7f4924a3bfe2` is also marked `want` and assigned to `box2` in the live backoffice.

Two GPT Image 2.5 studio reference images and one Kling 3.0 video were generated through Higgsfield MCP. The scene is green, and the brighter green card has contrasting corner markers. The new image framing is closer than the original casino source; this is not a registered gameplay replacement. Original and submitted prompts and provider job IDs are saved alongside the source files.

## Observed result

**The video fails the physical dealing requirement.** In inspected frames 8–42 the card travels from the outlet across the surface largely without the receiving hand following it. The requested handoff, wrist turn, fingertip delivery and empty-hand return are not achieved. The successful green setting does not qualify this motion for use. The handoff failure is visible in `motion-sheet.jpg` and the source video.

The source is H.264, 1276×720, 73 frames at 24fps, duration 3.041667 seconds, silent. `analyze-motion.py` records colour components per frame and creates inspection samples; these observations are not a solved tracking path or visual acceptance.

Local review: `http://127.0.0.1:4198/green-exhibit-01/`. Its warning is visible above the looping raw source. No mask, gameplay installation, production deployment, server-card or wallet change. Original casino media remains untouched. No autonomous generation loop was resumed.

Required pre-commit suites and dealer-sync probe both passed on 19 September. Those checks do not validate this motion.

The user subsequently rejected the rewritten prompt/model choice and explicitly directed use of the winning Seedance prompt. The correction is recorded in sibling `astrid-green-exhibit-02-seedance`, using the original saved Seedance 2.0 submission for accepted job `9dc93653` with only green environment/card substitutions. No additional reference images were generated for that correction.
