# Folded rest and native hand transition — 20 September

User selected folded hands like the original idle, then explicitly requested a
transition from its end to the currently installed ready pose. Keep the elevated
camera, present scale, table, speech sources and approved dealing takes.

## Sources and decisions

- `plate.png`: built-in GPT Image edit of the elevated full-scene plate and
  canonical Astrid identity, changing the arms to the original folded pose.
  Original generated file: `/Users/solvifyab/.codex/generated_images/01a089d2-0743-7fa2-8827-24888c70a8a2/exec-fd3fc7cc-8269-420c-a0c7-a540588da813.png`.
- Folded idle: Seedance 2.5 job `744a9e34-944a-4788-9d81-a0e50bd20039`.
  Use native frames72–144. Excluded the prolonged closed eyes at the beginning.
- `transition/`: Seedance 2.5 job `d51c19ba-6fed-40c1-875b-cfe746eca23f`,
  rejected for altered arm geometry and placement at its first frame. Not installed.
- `transition-v2/`: Seedance 2.0 job `92521ca6-1037-498a-ad71-933248fcf253`.
  References are the exact last folded frame and first current ready frame.
  Native hand movement retained; initial stationary frames0–39 trimmed. No card
  pickup or shoe movement is requested in this posture transition.
- Requests, submission receipts, completed receipts and sources are retained.
  No additional video jobs after these three. No paid Higgsfield GPT image job.

## Processing and playback

Native person masks use the existing elevated masking pipeline and enclosed-head
check. Both new sources required zero interior alpha repairs; encoded head alpha
minimum255. Eyes and fingers remain intact in source/matte and rendered checks.

`build-runtime.py --install` registers the full actor by translation only.
Folded rest (+19,+25), bridge endpoint offsets (+5.51,-9.31) to(+3.66,-8.32).
No scale change. The silent bridge uses native frames40–96 at36fps (1.5x), with
six-frame premultiplied optical-flow joins at each end. Flow is bounded30px and
only closes the small residual endpoint mismatch; the arm movement is filmed.
Total bridge duration69/36 =1.92s. Return reverses this silent bridge.

The folded loop is now the resting state. Every third loop connects to an existing
glance and back. Speech/dealing requests wait for the physical transition; close
successive lines keep the ready pose. The old ready source hash stays authoritative
for speech joins and card actions. Speech source footage/audio is unchanged.

Speech height correction is separate: rigid actor offset[0,20] with all17 entry/exit
flow maps rebuilt against it. This avoids easing upward into a displaced talk clip.

## Rendered verification

Isolated guest server4211; user4190 session and live DB untouched. Evidence is in
`height-qa/` and `gameplay-qa/`. Repeated native rest/unfold/glance/fold loops, greeting,
two goodluck plays, entry during a folding movement, and return to rest were observed.
Whole round on zero-based Box4: 4H+8H, hit7S =19. Dealer4S+2C+3H+3S+2H then bust;
$5 stake, $10 returned, final balance$1005. Dealerbust speech and folded rest resumed.
No new warning/error in the final runtime logs. Shared Vera/Amira/Mei goodluck
repetition regression completed without changing their assets.

11 focused tests, full pre-commit and dealer-sync --probe pass. These are technical
checks, not automatic visual acceptance or a claim of sample-perfect lipsync.

## Remaining limits

The generated sources retain a small skin-tone/texture difference. New idle and
existing glances are short loops; this is not a long uninterrupted filmed performance.
Speech sources and existing Box4/dealer-card choreography retain their prior limits.
No new seven-seat acceptance, no production deploy, no claim that every clip is perfect.
Individual PNG capture frames and native masking caches are local ignored QA data;
contact sheets and compact state logs are versioned.
