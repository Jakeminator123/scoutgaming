# Adaptive routing live check — 2026-10-01

Target revision: `a34875d8b3eea4e1fb9ab8313a12aa81b433f729`.
Scope: deploy the reviewed opt-in Director router, align the product speech
deadline, and run at most two synthetic Director requests. No GPU/Cartesia
calls, player database writes, real images or real conversation history.

## Deployment record

| Service | Intended change | Deployment |
| --- | --- | --- |
| croupier-lab-director | Exact target SHA; `OPENCLAW_SPEECH_ROUTING=adaptive`, `OPENCLAW_SPEECH_DEEP_MODEL=gpt-6-sol`, `OPENCLAW_SPEECH_TIMEOUT_MS=20000` | `dep-dav2j5142hec73ckt6vg` |
| croupier-v2 | Same target SHA; only add `OPENCLAW_SPEECH_TIMEOUT_MS=20000` | Existing automatic build `dep-dav2jsk9v7es73bu0j10` |

The product's auto-deploy setting was read **before any manual deploy action**
as `After CI Checks Pass`. Its already-running CI-triggered target build was
allowed to continue. No specific-commit action was used on the product.
The Director previously used manual deployment. Only the three listed
Director values and the one product speech-timeout value were edited; the
general OpenClaw timeout and other variables were not changed.

Gateway remains on `15bd15419fc05d88635fedcde3e73f952386c6c5`. Its five role
defaults remain Terra with empty fallbacks; Sol was already added and tested
separately. No further Gateway deploy or model catalogue change is part of
this task. See [the preceding capability evidence](TERRA-ROUTING-AUDIT-2026-10-01.md).

## Synthetic test boundary

Only these two request IDs are admitted:

- `qa-adaptive-a34875d8-20261001-7e42b901-simple`
- `qa-adaptive-a34875d8-20261001-7e42b901-complex`

Both envelopes select Terra, contain an empty table and synthetic identity
labels, and permit only a generated text choice. The first asks for a short
English greeting. The second asks a two-machine prerequisite scheduling
question, then changes one task duration. Its optimum was independently
checked offline as 14 in both cases. It does not instruct the model to
escalate. Correctness and actual escalation are assessed separately.

Each request may make at most two Director-to-Gateway passes, requesting 512
output tokens each. This was not a cap across native continuations, as the
result below demonstrates. There are no client retries or extra proof requests. The Director's
20-second setting leaves 500 ms for the relay, so its shared model-work
deadline is 19.5 seconds.

Actual model evidence is read only for the four exact native session keys:
`agent:croupier-speech:openai-user:croupier-product-speech:<requestId>:attempt-0`
and `:attempt-1`, substituting the two request IDs above. They must be absent
before the test. The active SQLite file is opened read-only; queries select
only those exact keys and allowlisted model/token/update metadata.

The standard Director route log contains only `event`, `stage`, `attempt`,
`requestedModel` and `elapsedMs`. It has no request correlation ID, so
sequential UTC windows and exact test-session metadata are required to
distinguish these checks from unrelated traffic. Requested model is not proof
of the actual provider model. A route start is not proof of successful JSON.

## Result

Both services are Live on the exact target SHA. Director deployment completed
at 09:38:50 UTC; product deployment completed at 09:41:55 UTC. Product
auto-deploy remains `After CI Checks Pass`; Director remains `Off`.

At 09:40:57 UTC the actual Director child process had routing `adaptive`, deep
model `gpt-6-sol`, speech timeout `20000`, and general timeout `8000`.
`/healthz` returned HTTP 200 and `ok: true`. At 09:44–09:46 UTC the product
configuration and actual web child process both had speech timeout `20000`
and general timeout `8000`. Its public `/__cloud/health` returned HTTP 200
with body `ok`. The child's `CROUPIER_STREAM_LANE` remains
`lissabon-stream-lane`; its speech URL still uses
`croupier-lab-director.onrender.com`. No destination or video stream was
replaced. The product child's environment was read using its existing
service UID; no file permissions or ownership were changed.

For future rollouts, verify product speech timeout 20000 first, then enable
Director adaptive routing. Do not leave adaptive enabled with an old 8000 ms
product speech relay.

The four exact native test session keys were absent before the test.
Synthetic requests exercise the real Director and OpenClaw text route;
they do not produce a QA video stream or verify live audiovisual playback.

| Synthetic request | UTC start | HTTP / elapsed | Actual Gateway session model | Result |
| --- | --- | --- | --- | --- |
| simple | 09:47:44.436 | 200 / 2694 ms | `lab-provider/gpt-5.6-terra` | Valid generatedText: "Hello! Welcome to the table." Attempt 1 absent. |
| complex | 09:47:58.626 | 502 / 17818 ms | Attempt 0 Terra; attempt 1 `lab-provider/gpt-6-sol` | Natural escalation occurred; `invalid_openclaw_speech_json`. No semantic answer accepted. |

Only two HTTP POSTs were submitted, without client retries. Metadata for the
four previously absent exact keys proves three Gateway model passes. The
simple Terra pass recorded 75 output tokens; the complex Terra pass 116.
Sol session metadata recorded 1536 output tokens. Inspection restricted to
that own synthetic session found **three assistant completions**, sequences
5, 7 and 9, each `gpt-6-sol`, `stopReason=length`, and 512 output tokens.
The final text was 113 characters, started an object but did not close it,
failed JSON parsing, and contained no Markdown fence. Content block types
were thinking and text; no reasoning text was displayed or copied.

The configured 512 limit therefore applied to each native completion, but
did **not** bound the entire Gateway pass. There were at least five provider
completions across the two tests, exceeding the intended four-completion
test bound through internal Gateway continuations/retries. No further paid
request was made after discovery. The 17818 ms failure was below the shared
19.5-second model deadline; this was truncated JSON, not evidence of a
Director timeout. Any subsequent test must account explicitly for these native
continuations or first change the native policy; a two-pass request limit
cannot stand in for a total provider budget. No billed-dollar amount is
inferred from session token metadata.

The failed probe triggered the prescribed rollback of only Director
`OPENCLAW_SPEECH_ROUTING` to `fixed`. The first UI Save and deploy created
`dep-dav2p6p7lnhs73airtg0`, Live at 09:49:49 UTC, but actual child readback
at 09:52:56 still showed `adaptive`. This deployment is **not** rollback
evidence. The non-secret flag was revealed, edited with explicit blur,
saved, and read back as persisted `fixed` before another deployment of the
same exact SHA in `dep-dav2ri0u01pc7387so80`. Its build completed and it
entered deployment at 09:56:21 UTC. Final process confirmation is still
pending at handoff to the integrating agent; timeout 20000 and the Sol
catalogue remain. The public flag must remain `fixed` during subsequent
repair validation.

Private screenshot receipts, stored outside Git in the task's visualization
directory: `adaptive-product-runtime-2026-10-01.png`,
`adaptive-director-tests-2026-10-01.png`, and
`adaptive-model-metadata-2026-10-01.png`. They contain only the sanitized
runtime fields, synthetic result and exact-session model metadata described
above. No credential values or player history were copied into this report.
