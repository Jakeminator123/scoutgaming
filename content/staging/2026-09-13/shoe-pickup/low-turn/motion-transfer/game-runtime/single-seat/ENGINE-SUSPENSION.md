# Isolated idle-engine suspension

Baseline app166 starts DealerEngine continuously. Existing candidate installer only canceled/released PerformancePlayer; visibility:hidden does not stop WebCodecs decoding or the 24fps canvas presenter/watchdog.

Do not use stop/start: stop disposes actorCompositor, does not wait for asynchronous feeder, cancel RAF, close decoders, or immediately clear heartbeat. Late fetch continuations and a rapid running=true restart can revive an old loop alongside a new loop. A new start guard alone cannot fix stopped/restarted closure ownership.

Implemented isolated-only lease by install-engine-suspension.py, rebuilt from unchanged public source. Atomic replace is mandatory because isolated file originally had two hard links. Public source SHA is preserved in engine-suspension-receipt.json.

engine.suspendPresentation() returns an idempotent release function. Nested leases retain suspension until last release. Existing feeder polls without submissions while held; post-fetch check closes the await race. Presenter/drain returns before drawing; heartbeat avoids falsely declaring decoder stalled. Same decoder/compositor and buffered frame cursor are retained. Final release resets presentation deadline, avoiding an accumulated catch-up burst. start is idempotent while already running. No stop/start invocation.

Existing submitted callbacks may complete during suspension and populate the bounded display queue. Thus verify stats.submitted and stats.presented unchanged while held, not decoded===0. Fetch already in progress is not canceled; this patch reduces ongoing decode/presentation work, not all network activity. It keeps RAF checks and a40ms feeder wake, deliberately avoiding a new event/wait ownership mechanism.

Meaningful regression test engine-suspension.test.mjs exercises actual generated engine code with a deferred clip fetch and controllable clocks: no submission after awaited fetch under lease, no paint while held, two leases with repeated release, duplicate start without second presenter/watchdog, same cursor resumption, no catch-up paint. Pass1/1. Test does not claim GPU throughput improvement; root owns stable no-capture4190 browser comparison.

Bridge integration owned by contact_integration: acquire only after candidate loaded/validated, reject if current speech is playing, store release, invoke exactly once in finally before unhiding baseline. Speech that starts during held interval needs separate application arbitration if observed; this engine patch deliberately does not mute audio, rewrite speech queues, or change authoritative deal settlement.
