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

No live rehearsal result is claimed by this initial implementation note.
The last read-only runtime receipt had one old RunPod job returning 404 and
no terminal record. Its relay worker count was not yet observable.
