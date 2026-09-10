# Astrid sound recovery and rejected seat coverage — 10 September 2026

**Current Jira state: CAC-8 Ready for QA; CAC-2 and CAC-4 Blocked on usable motion capture.**

The user's rejection of CAC-2 is correct. Three player-direction clips plus a corrective card slide do not establish hand delivery to all seven positions. No new per-seat footage was produced in this change. The current rendering remains staged.

## CAC-8: sound recovery

The baseline effects context never called `resume()`. In a disposable copy of the actual game at `audio-qa.localhost:4193`, a visible diagnostic button suspended the real AudioContext. A subsequent normal bet left it suspended while the sound button remained enabled. Ambience continued independently. This reproduces missing **effects**, not complete loss of speech or room audio.

The shared table audio controller now creates/resumes its context on pointer or keyboard interaction. Effects only run while the context is running; they are not queued behind asynchronous recovery. Mute and hidden-page handling close the old context, cancelling scheduled chimes rather than replaying them after unmute. Rehearsal's Play controls now update the same persisted mute state and icon as the sound button.

Card cues remain tied to presented media. The former two-source-frame gap limit could drop a cue during ordinary accelerated playback. Cues now tolerate short frame drops at the actual frame rate and playback speed: at most 80ms late, with at most a 250ms presentation gap. First-frame catch-up, seeking, hidden completion and long stalls remain silent. No speech footage, recorded audio, timing calibration or backend behavior changed.

The rehearsal “Watch…” buttons open silent saved recordings. Their labels now explicitly say **silent recording**. Live gameplay and Play line/Play twice use the actual sound path.

### Verification

- Baseline: context remained suspended after the next bet. Fixed: the same interruption recovered to running on the next bet.
- Actual seven-seat initial deal: 16 pickup and 16 landing cues, all against a running context. The QA analyser observed nonzero synthesized output (peak approximately 0.218); ambience advanced, and goodluck speech played through its embedded audio/video path.
- The seven-seat round completed after six normal Stand decisions (one initial blackjack), a dealer draw, big-win sound and settlement speech: 1005 → 970 after the 35 stake → 1042.50 after the 72.50 return. This was a disposable demo wallet.
- Mute closed the effects context and paused ambience; unmute created a running context. Unit checks cover suspended/interrupted recovery, mute/hidden context disposal, failed startup, dropped-frame cues and suppression of late cues. All 49 pre-commit checks pass, including existing speech cancellation and repetition tests.
- Astrid, Vera, Amira and Mei each completed two consecutive goodluck lines through the actual shared player. All four dealer asset probes, staged contact media integrity and Astrid actor/audio integrity pass. No media was regenerated.

Private evidence and the instrumented copies are under `content/staging/2026-09-10/audio-recovery/`. Instrumentation is not part of the shipped app. These observations do not verify the user's physical audio output, Safari interruption recovery or phone speakers; CAC-8 awaits user QA on the updated table.

Audio recovery follows the browser's documented [AudioContext gesture/resume behavior](https://developer.chrome.com/blog/web-audio-autoplay) and [interrupted state behavior](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state).

## CAC-2: actual missing coverage

[Player targets](reference/astrid-capture-20260910/player-targets.json) records the two actual initial card destinations for every seat and the dealer in a 1280×720 game viewport, alongside the corresponding source media identities and filmed release corners. Coordinates are viewport pixels; they are not a physical camera calibration.

| Player position, left to right | Existing source | Release-to-final-card travel, two cards |
| --- | --- | --- |
| 1 | Left | 48 / 31 px |
| 2 | Left | 61 / 78 px |
| 3 | Centre | 115 / 96 px |
| 4 | Centre | 24 / 21 px |
| 5 | Centre | 103 / 122 px |
| 6 | Right | 175 / 157 px |
| 7 | Right | 94 / 79 px |
| Dealer | Own-card | 23 / 26 px |

These numbers measure corrective card travel, not an acceptable contact tolerance. The hand stays on its filmed trajectory. Selecting a different nearest clip cannot repair the missing reach and release. Replacement performance must serve the actual target geometry, including subsequent cards and split fans, before CAC-2 can pass. Preserve the working extraction, identity and room registration, then review physical grip, release and empty-hand return at each served position. Follow the controlled-capture plan after the rejected generated returns; do not label another floating-card correction as finished dealing.
