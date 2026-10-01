# Isolated speech rehearsal in the live relay

The operator rehearsal at `/bo/speech-qa.html` uses the running product's
OpenClaw speech call, generated-speech service, RunPod session manager,
budget journal, WebSocket relay and shared browser speech player. It does
not create a player or write synthetic chat, balances or rounds to the
player database. It does not construct another relay or copy the budget.

The endpoint is disabled unless an operator places `operator-qa.json` in
the configured private `CROUPIER_GENERATED_SPEECH_DIR`. The file contains
only a fresh UUID `id`, millisecond `createdAt` and `expiresAt`; the maximum
window is 30 minutes. No credentials belong in this file. Remove only this
gate file when the test is complete; keep all attempt and budget receipts.
The gate must have mode 0600 and the same owner/group as the private speech
directory (1000:1000 in the verified Render instance). Render Web Shell runs
as root; a root-owned 0600 gate correctly remains unreadable to the app.

The existing BO administrator session is required and remains subject to
normal auth-epoch checks. POST/DELETE require the product origin. Browser
stream admission is bound to that same BO session and the short-lived QA
identity. Expiration/revocation is checked again before paid work and while
streaming. GET only reports status and cannot start model, TTS or GPU work.

The shared service grants QA an exclusive, temporary voice reservation only
when no preparation or stream is active. Ordinary voice preparation is
unavailable during that reservation. Completion, failure or cancellation
releases it after any in-flight session cleanup, so aborting QA cannot cancel
a concurrently admitted player's GPU startup. This does not pause gameplay.

Two fixed synthetic questions are available. Each button press requests
one answer; there is no automatic retry or fallback to full-file generation.
The campaign allows at most three durable attempts, including failed ones:
an existing expired-job 404 may consume the first attempt while the normal
session manager retires it. Only a later explicit click may request another
answer. The same normal GPU budget checks still apply.

The QA page records preparation/first-frame/completion times, shared-player
start/end receipts, audible-element state and cleanup. Where supported, it
also captures a local browser playback recording for repeated inspection
without another GPU call. This recording is re-encoded and may omit the
initial frame; it is not an original media hash or proof of correct lip sync.
Keep QA recordings private and outside Git.

## Acceptance still required

Two consecutive real streamed answers must complete with matching audible
speech and mouth movements and return to idle. Check that the second answer
is distinct and does not replay the first sentence. A code test, completion
receipt or budget reservation alone does not approve audiovisual quality.

## Live result — 1 October 2026, 10:58 UTC

Transport passed twice; visual quality FAILED. Product revision
`7fa0400ddb3710e6d488300341d885644c8e6d4f` was live on Render deployment
`dep-dav3lhe417fc73fvufig`; all three GitHub CI jobs passed and the Vercel
production alias also served that revision. Campaign
`1e0f1f5c-e90b-46eb-b0d0-9e76ab84b067` reserved exactly two attempts.
A first click while a real player request was active returned
`operator_speech_qa_busy` before consuming an attempt or starting QA work.

| Turn | UTC start | Model wait | First visible frame | Completed | Result |
| --- | --- | --- | --- | --- | --- |
| 1 | 10:58:20.193 | 1796 ms | 3232 ms | 7888 ms | start/end, audible element, returned to idle |
| 2 | 10:58:40.228 | 2399 ms | 3645 ms | 9225 ms | start/end, audible element, returned to idle |

Frame/completion times are measured from the explicit button click. Both
responses used distinct text and neither returned 404 or Voice off:

1. Mum bakes cinnamon buns while Dad brews the morning coffee at home.
2. Blueberries, paper, and soft cushions rest quietly on the balcony.

The private review recordings contain Opus audio and 1080x1920 VP9 video.
They are saved outside Git at `C:\Users\jakem\Downloads\astrid-qa-turn-1.webm`
and `C:\Users\jakem\Downloads\astrid-qa-turn-2.webm`. SHA-256 respectively:

```text
077be7047320d2c888800e0ae7d4641a7979020c844663d30709f8044204f51c
9774b3894e1fdf214f3ac3cc12511cb54ed45e2d2874d00b475150d0128ffe85
```

Direct inspection of frames at one second in both recordings and three
seconds in turn 1 shows a magenta rectangle over the face and a green mouth
region. This is a rejection, not a lip-sync approval. The audible-element
flag and transport receipts do not establish phoneme alignment, natural
mouth movement, or a successful microphone-to-answer acceptance test.

Read-only source review found no intentional debug rectangle in the actual
worker; `assets/astrid_spel2x/talk_base.png` is clean. The recording captures
the video element directly, not DOM/CSS overlays. Next investigation should
compare the deployed worker image with the repository and inspect real
`compose_crop` BGRA output before the BGRA→YUVA/FFmpeg overlay path in
`services/astrid-gpu-worker/workers/lipsync_worker.py` and `streaming.py`.
The exact visual defect cause remains unproven; no original media or visual
acceptance baseline has been changed.

## Cleanup and related checks

Only the matching temporary gate was removed. The QA endpoint then reported
disabled, zero identities, zero pending work and zero workers/busy/available.
The normal idle shutdown requested provider cancellation; budget, campaign
and attempt records remain intact. The final read showed USD 1.00 reserved
for the day (including real-user activity), not measured provider billing;
the durable daily cap remains USD 9.94. One session had a CANCELLED terminal
receipt and the latest session had a cancellation request but no persisted
terminal receipt yet. No extra paid call was made merely to close that receipt.

The user's existing in-app game showed an API 502 around deployment. Reload
restored the authenticated session with the same USD 955 demo balance and no
new browser warnings/errors. No agent bet, signup, account reset or balance
edit was performed. The user then submitted their own chat requests; a request
during the exclusive QA window correctly received a busy response.

The misleading table-wait label remained visible during media preparation.
A subsequent two-line client fix shows “Förbereder röst och läppsynk…” once
generated playback begins preparing, and “Astrid svarar” only on actual media
start. The delayed-start regression failed before the fix; 50 focused checks
and the four-dealer sync audit passed afterward. This changes status text,
not the generated video or mouth composition.

Six isolated account/auth checks also passed. Public signup is enabled at
`/blackjack?dealer=astrid`, with separate player-account and existing Scout
account choices. Accounts remain in persistent SQLite; Neon is zone metadata.
Public password recovery is still absent. No real account was created for QA.
