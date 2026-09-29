# Astrid: manual voice input, current camera model and local cloud storage

2026-09-29. Changes prepared by `fix-runtime-chat`; coordinated commit/deployment belongs to the root audit. Existing uncommitted media, the local generated-speech profile and `bddf534c` voice identity fix are preserved.

## Visible chat and usable input

- Astrid's Lissabon stylesheet makes the conversation visible as soon as that presentation loads, before media loading or optional voice initialization finishes. The existing always-open chat behavior for Escape, timeout and mobile remains.
- The consent dialog offers **Record one message**. This starts one microphone/camera turn only after that explicit choice, uses the existing Whisper English translation and image contract, then switches recording off after one send. A later Record click starts another single turn. Record during capture cancels without sending. There is no automatic substitute cloud wake-word service.
- If local wake-word support fails, devices remain off and the same dialog offers the manual choice. Neither failure nor merely opening the dialog records or uploads anything.
- An explicit manual choice made before the initial configuration response now continues when valid settings arrive. Wake-word mode still requires a fresh browser gesture after that wait. Cancellation, hidden pages, changed identity, a newly occupied turn or disabled server settings prevent device acquisition.
- A fresh saved Terra/Luna selection now controls images on the next turn. Previously an older `modeVision` value from initial activation could keep the camera off even after the server returned a current image-capable model.
- Existing authenticated context checks, bounded audio/images, stop-on-profile-change/navigation, English translation, buffer wiping and no automatic error retries remain.
- Missing generated speech media still produces text without a substitute browser voice, as established by `bddf534c`.

## Local environment correction and explicit cloud storage

The private `.env.generated-speech.local` no longer overrides the scoped RunPod endpoint with the older endpoint. It now agrees with `lab/.env.local` and the documented cloud test endpoint. No provider key was changed or printed. `RUNPOD_API_KEY` remains empty locally; a new normal Lab start with its existing generated-speech profile remains blocked until the intended key is supplied privately. The profile was not disabled to hide that failure.

Local cloud storage is explicit:

```powershell
node lab/start.mjs --check --astrid-camera --cloud-storage
# Only when a local start is requested, after stopping any existing pair:
node lab/start.mjs --no-open --astrid-camera --cloud-storage
```

Without `--cloud-storage`, the launcher ignores cloud storage credentials and its private staging file. With the flag, file precedence is `.env`, `lab/.env.local`, `lab/.env.generated-speech.local`, `lab/.env.cloud-storage.local`, then the process environment. `--offline` cannot be combined with the flag; a running pair is never silently reconfigured.

- `CROUPIER_MEDIA_STORAGE=blob` and `BLOB_READ_WRITE_TOKEN` reach Web and Lab.
- `CROUPIER_ZONES_DATABASE_URL` reaches only Lab, never the product server or browser.
- Reports expose presence/mode only. Credentials and derived storage settings are non-enumerable.
- The isolated network guard allows Vercel's API origin and the exact token-derived private Blob origin. Lab also receives the exact Neon HTTP API origin derived from its scoped database host. No wildcard or user-selected SDK endpoint override is forwarded.
- The local private staging file parsed successfully with Blob and zonedatabase credentials present. This was a configuration check, not a live storage write.

## Verification and remaining live checks

130 focused tests passed across camera control, wake word, Whisper translation, image contracts, chat visibility, voice routing, Gateway model reconciliation and local launcher isolation. `audit-dealer-sync.mjs --probe` passed all four dealer baselines, with the already documented missing takes and no new audiovisual approval.

Peer review reproduced the early manual-click configuration race before its fix. Two added regression tests cover successful delayed manual start, the retained wake gesture, cancellation, visibility, identity, occupied turns and server disablement. All 38 camera-control tests passed after the correction.

An isolated headless Chrome fixture used real DOM, AudioWorklet recording, PCM/WAV conversion, silence detection and JPEG capture with synthetic devices. All nine cases passed: cancellation/silence, short/long speech, short pauses, pre-roll, Terra selected after page load, two manual messages without a wake recognizer, and rejected legacy capabilities. At 390 px, chat remained `display:flex`, input `display:block`, chat width 360 px. The temporary server, browser process and profile were cleaned up.

A separate coordinated `startLocalComparison({startLab:false})` fixture acquired the shared session guard, served the actual game at `localhost:4194`, and used its own temporary database and browser profile. Each of `/?dealer=vera&rehearsal=1`, `astrid`, `amira` and `mei` completed **two consecutive `goodluck` plays** through the actual rehearsal player. The browser recorded two `playing` and two `ended` media events per dealer, with no media errors. Vera, Amira and Mei used matching indexed video clips; Astrid used its existing embedded-audio MP4. No media bytes or baselines changed. The fixture, browser, profile and database were removed, and the shared guard was released.

Screenshots from both plays for each dealer and `rehearsal-four-dealers-receipt.json` are saved privately under `C:\Users\jakem\.codex\visualizations\2026\09\29\01a0ec14-d34d-7590-8bdb-0e54c6dd16a6` as `rehearsal-<dealer>-play-1.png` and `rehearsal-<dealer>-play-2.png`. These are functional playback evidence, not new audiovisual or lip-sync approval.

Provider responses were stubbed in the input browser fixture; rehearsal used existing recorded media and no providers. No paid model/GPU calls or physical microphone/camera capture were made. Full coordinated hook checks and post-deploy verification of the authenticated Render configuration, real Terra image response, Whisper capture and generated speech remain with the root deployment. These tests do not establish lip-sync acceptance or cloud storage persistence.
