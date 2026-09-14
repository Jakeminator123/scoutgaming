# Astrid box0 staging lifecycle adapter

`adapter.mjs` is an isolated lifecycle boundary around the existing hash-bound `bindAstridSequence`. It does not load media, mutate public gameplay/database, select a generated take, or approve a manifest. Six synthetic lifecycle tests pass; these fixtures are explicitly synthetic and do not certify far-left footage.

Inputs: already-issued delivery `{cardId,seatId,targetId:'box0',faceDown,card?}`, exact current target, reviewed sequence ledger, optional endpoint calibration, surface `{render(plan): Promise, dispose()}`, onLand/onFallback, AbortSignal. Hidden-card ranks/suits are stripped before renderer, landing and fallback outputs. The binder validates exact target and final moving corners; no approximate seat choice or endpoint teleport.

Call `present(frame)` from the real sampled-media integration. Calls are serialized; cancellation invalidates queued/in-flight acknowledgments. Only successfully rendered plans can emit onLand and it occurs once. `ended()` requires the final ledger frame plus landed state; video ended alone never manufactures landing. Resize cancels to require new exact target validation. Cancellation/hidden/render failure returns the issued-card identity to a caller fallback path, with no invented dealer motion and no false landing. If already landed, that fact is retained. Adapter disposal removes its renderer; the future host must preserve its own live card state.

A render Promise acknowledges renderer success, NOT OS compositor presentation. The final integration must connect the reviewed media clock and genuine render result; calling present with a fabricated final frame is not evidence. The adapter does not seek, retime, stretch actor footage or automatically reveal a hidden card. Revealing later needs an explicit server-state policy outside this one-delivery contract.

## Ledger still required

Use existing schema `astrid-staged-sequence-v1`: dealer, sourceSha256, fps, frames `{frame,cards:[{cardId,corners,faceUp}]}`, one delivery `{cardId,seatId,targetId,targetCorners,pickup,release,land}`, reviewed payload digest/evidence. Preserve source-cut and continuation-frame provenance on every row. `release` is hand separation; physical felt contact may occur earlier. Here `land` means the DOM/table ownership handoff, not first felt contact; it must not precede release. Keep the fixed prop during return even after hand release if required by the renderer host. Use `feltContact` as separate provenance/event if needed.

Motion reviewer confirms continuation native0 is already felt-contact, clear release14, fixed target thereafter. Full pickup/regrip/reach remains unapproved. The bounded53-frame neutral join original64–66→continuation0–39→original0–9 is not a complete authorized pickup-and-deal ledger. Do not fabricate the missing reviewed events or stamp staged-reviewed from this prototype.

## Public PerformancePlayer compatibility

Current public PerformancePlayer.play accepts card,faceDown,target,corners,onCue,onLand, aborts on resize/hidden and preserves a held ready layer on successful completion. It also has its own sample/release interpolation and callback landing behavior. Do not wrap both onLand paths together: the future adapter must own exactly one handoff emitter. Do not feed this ledger into the old player's release interpolation or generic source fallback, which would change its rigid quads/timing. This prototype disposes its own surface at complete; production needs an explicitly reviewed idle/ready ownership handoff rather than silently using an old idle splice.
