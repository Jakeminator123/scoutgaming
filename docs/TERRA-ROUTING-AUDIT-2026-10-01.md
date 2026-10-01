# Terra routing audit — 2026-10-01

## Scope and evidence

Jakob explicitly requested Terra as the main/default model, without a mini
fallback. This audit separates Render environment values, the persistent native
OpenClaw configuration, and the model requested by the product. It does not
change Whisper, Cartesia, the separately budgeted web-search specialist, media,
player data or GPU budget records.

At 09:15 UTC the product was running `d0fd6c3d0384f9521ae86c3ebf8fdee9b21d798c`.
OpenClaw was running `15bd15419fc05d88635fedcde3e73f952386c6c5`. The current
checkout already contained Terra seed defaults. An existing persistent Gateway
configuration intentionally survives code deployments and environment changes.

## Live finding and correction

The OpenClaw Render service `srv-danhiv3tqb8s73burkq0` still had
`OPENCLAW_MODEL_ID=gpt-5.4-mini`. Its persistent
`/data/openclaw/openclaw.json` also had `lab-provider/gpt-5.4-mini` as primary
for all five roles. This was a main-model setting, not a transcription or TTS
parameter.

Only the following five `agents.entries.<role>.model.primary` fields were
changed to `lab-provider/gpt-5.6-terra`:

| Role | Primary after correction | Fallbacks |
| --- | --- | --- |
| croupier-director | lab-provider/gpt-5.6-terra | [] |
| croupier-chat | lab-provider/gpt-5.6-terra | [] |
| croupier-operator | lab-provider/gpt-5.6-terra | [] |
| croupier-social | lab-provider/gpt-5.6-terra | [] |
| croupier-speech | lab-provider/gpt-5.6-terra | [] |

The exact old primary and empty fallback list were checked before editing. A
candidate file was validated with the deployed OpenClaw CLI (`config validate
--json`, exit 0), the source was checked again for concurrent modification,
and the candidate was atomically renamed. A private mode-0600 backup remains
at `/data/openclaw/openclaw.json.pre-terra-20261001.bak`; its contents were not
exported. All five corrected values were read back after a service restart.

The provider is `lab-provider`, API `openai-responses`, base URL
`https://api.openai.com/v1`; Terra's declared inputs are `text` and `image`.
The system-agent owner remains `croupier-operator`.

The current native model catalogue contains `gpt-5.4-mini` (text),
`gpt-6-luna` (text, image), and `gpt-5.6-terra` (text, image). At 09:20:38 UTC,
a read-only authenticated `GET https://api.openai.com/v1/models` returned HTTP
200 and these matching provider IDs: `gpt-5.6-sol`, `gpt-5.6-terra`,
`gpt-6-astra`, `gpt-6-luna`, `gpt-6-sol`. No additional matching snapshot IDs
were returned. This proves listing access, not inference success, image/tool
capabilities, latency, price or suitability. The provider key stayed in service
memory, no prompt was sent, and the native catalogue was not expanded.

There was **no current EACCES**: the service process and config owner are UID
1000, the config has mode 0600, and its directory was writable. No chmod/chown
or permission expansion was needed.

The Render environment field was saved as `gpt-5.6-terra` and read back from
the dashboard after navigation. A plain **Restart service** created a new
instance but retained `gpt-5.4-mini` in its process environment. Therefore the
same already-running commit, `15bd154`, was explicitly redeployed to apply the
saved environment. Deployment: `dep-dav28s8u01pc7385ja30`, confirmed **Live**
at 09:18:49 UTC in Render.

**Final runtime verification, 09:19:29 UTC:** the new instance `6j9k6` has
`process.env.OPENCLAW_MODEL_ID=gpt-5.6-terra`, still on the exact same `15bd154`
commit. The five saved role primaries are all Terra, all fallbacks are empty,
and the deployed CLI validates the config with exit 0. The config still has
owner UID 1000 and mode 0600.

## Product and specialised models

Read-only product Shell checks at 09:15 UTC confirmed:

- Saved `/var/data/studio/project.json`: `probePolicy.model=gpt-5.6-terra`,
  `probePolicy.mode=automatic`.
- `CROUPIER_STREAM_LANE=lissabon-stream-lane`.
- `CROUPIER_GENERATED_SPEECH=1`, `CROUPIER_GENERATED_SPEECH_STREAMING=1`,
  `CROUPIER_CLOUD_GENERATED_SPEECH=1`, `CROUPIER_ASTRID_CAMERA=1`.
- Whisper translation, Cartesia, RunPod, worker and ticket credentials are
  present. No secret values were printed.

The product sends its selected model to the Director, which sends
`x-openclaw-model: lab-provider/<selected model>` while retaining the
`openclaw/croupier-speech` role in the request body. `gateway-default` omits
the override and uses the saved role primary. Thus the Studio selection and
Gateway role defaults are separate controls that must agree.

Specialised models are intentionally unchanged: direct OpenAI audio translation
uses `whisper-1`; Cartesia uses the Astrid voice profile's `sonic-3.5`; the
separate companion web-search policy uses `gpt-4.1-mini-2025-04-14` with its
existing 5 SEK/hour cap. They are not mini fallbacks for Terra. The retained
mini catalogue entry is also not a fallback when each role's fallback list is
empty.

## Tests and remaining live acceptance

The delegated focused regression run passed **190/190 tests** without provider
calls or a second product/lab server pair: Gateway seed/reconciliation/start,
model routing and image capability, product speech/probe, session/stream/chat,
relay/player and microphone/chat-response behavior. No code repair was needed
for the current default or session implementation. Exact files and counts:

| Test file | Passing tests |
| --- | ---: |
| open-claw/lab/deploy/gateway-config.test.mjs | 21 |
| open-claw/lab/deploy/start-gateway.test.mjs | 14 |
| test/generated-speech-session.mjs | 22 |
| test/generated-speech-stream.mjs | 11 |
| test/generated-speech-chat.mjs | 10 |
| open-claw/lab/test/product-speech.test.mjs | 9 |
| test/player-probe.mjs | 26 |
| test/openclaw-chat-contract.mjs | 9 |
| test/generated-speech-stream-player.mjs | 13, including 4 nested |
| services/astrid-gpu-worker/gateway/test/relay.test.mjs | 10 |
| test/astrid-camera-control.mjs | 41 |
| test/chat-response.mjs | 4 |

Budget journal read at 09:16:34 UTC: valid version-1 policy; environment and
persisted daily cap both 9.94 USD; session reservation 0.50 USD; zero reserved
on 2026-10-01 and 9.94 USD remaining in this journal. Four historical
reservations all retain their cost, including cancelled/failed attempts. One
old job lacks a terminal receipt, is older than 720 seconds, and no session
lock existed. A GET of that existing job's RunPod status at 09:17:00 UTC
returned **404**. This audit did not modify the ledger or issue a paid POST.

The tested session logic can retire that expired 404 only when the actual
relay has zero workers/busy/available; the failing turn does not submit a
replacement automatically. A later explicit turn can pass the normal budget
and freshness checks. A disk audit alone cannot prove current relay state.
The first retirement turn may already have spent a model call before it reaches
the GPU failure. The read-only status check did not perform that retirement.

Two successive real streamed answers and an actual provider-returned Terra
response remain unverified. The available isolated cloud QA disk lacks the
speech configuration and shared budget authority; copying the production
journal would not create a shared cap. Mounting that journal into an additional
process is also insufficient: relay/worker state is process-local, the worker
callback origin belongs to that process, and separate QA authentication is not
accepted by the existing product process. A supported isolated identity path
inside the same process, or a coordinated exclusive fixture with the real
budget disk and stopped production, would be required first. Neither was
introduced in this model-default audit. No production player database or
conversation history was used for test writes. Routing tests and saved config
are evidence of configuration, not audiovisual approval or a live model call.

Relevant contracts: `open-claw/lab/deploy/gateway-config.mjs:51`,
`open-claw/lab/src/product-speech.mjs:200`,
`web/generated-speech-session.mjs:103`,
`web/generated-speech-session.mjs:205`,
`web/generated-speech-stream.mjs:109`, `web/server.mjs:1115`,
`web/astrid-transcription.mjs:127`,
`open-claw/lab/deploy/companion-search-server.mjs:10`, and
`web/public/astrid-voice-profile.mjs:6`.

## Sol capability checks — follow-up at 09:24–09:30 UTC

Jakob subsequently authorised adaptive routing preparation, with Terra as the
default and a deeper model available for difficult requests. Root authorised
at most two small direct Gateway checks, each capped at 512 output tokens,
using synthetic text/image data. This is separate from GPU/talking-video QA.

At 09:24:19 UTC, only `gpt-6-sol` was appended to
`models.providers.lab-provider.models`, with declared `input: [text, image]`.
The candidate passed the deployed CLI validator, a concurrent-change check
passed, and an exclusive mode-0600 private backup was retained at
`/data/openclaw/openclaw.json.pre-sol-audit-20261001.bak` before atomic replace.
All five primary/fallback objects remained byte-equivalent after JSON parsing.
An explicit Gateway restart loaded the catalogue in instance `g5rx8`; the
environment and all five primaries were reread as Terra with empty fallbacks.
No router environment flag was changed.

Exactly two client POSTs were sent to the existing loopback Gateway
`/v1/chat/completions`, using its existing authentication in memory,
`model: openclaw/croupier-speech`, `x-openclaw-model: lab-provider/gpt-6-sol`,
`tool_choice: none`, `stream: false`, and `max_completion_tokens: 512`.
Neither request was retried. No Director/product/GPU/Cartesia route was called.

| Check | Started UTC | Result | Elapsed | Actual model evidence |
| --- | --- | --- | ---: | --- |
| Synthetic text with exact product speech JSON | 09:28:32.116 | HTTP 200; exact six-field schema and expected greeting matched | 4266 ms | lab-provider / gpt-6-sol; 85 output tokens |
| Procedural 96×96 PNG: red circle on white background | 09:29:36.273 | HTTP 200; exact six-field schema; answer identified red | 2536 ms | lab-provider / gpt-6-sol; 91 output tokens |

Each request had its own explicit application-owned QA session key, ending
`qa-sol-20261001-0927-text` or `qa-sol-20261001-0927-image`. Both keys were
confirmed absent before the tests. The active native SQLite database was
opened read-only and queried with `session_key = ?` for these exact two keys
only. The reported model is from `entry_json.modelProvider` and
`entry_json.model` in `session_nodes`, with `updated_at` after each request's
start. The Gateway response's `model` field is only the role alias and was
**not** used as actual-model proof. Reported total session token counts were
6066 and 6085 respectively; no billed-dollar estimate is asserted.

No real player database, human image, conversation history or other session
content was read for these tests. The new QA sessions and small attempt/receipt
files under `/data/openclaw/qa-sol-20261001-{text,image}.*.json` are private test
evidence. The GPU budget journal was untouched. Terra remains the default;
the old GPU 404 and two successive streamed-answer acceptance gaps above are
still open. These two checks prove the requested Sol text/image capability
through the existing Gateway, not the future adaptive Director route or
audio/visual playback.

Next staged verification must wait for root's exact coordinated SHA and
deployment instruction. It should send two new synthetic envelopes through
the Director's existing `/api/product/speech` bearer, keep that credential in
memory, and inspect only requested-model/attempt metadata plus those exact
new Gateway sessions. Never call the product `/api/chat` or attach a speech
stream for this routing test. A final model field alone cannot prove every
attempt when the same session is reused during an upgrade; retain the
allowlisted per-attempt routing receipt as well.
