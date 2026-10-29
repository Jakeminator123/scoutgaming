import { createLayerComposition } from '../../../packages/presentation/runtime/presentation-composition.mjs';
import { combineAbortSignals } from './abort-signals.mjs';
import { layoutGameOverlay, BLACKJACK_COMPACT_QUERY } from '../../../packages/presentation/runtime/game-overlay-layout.mjs';
import { SEAT_HALF_PX, fallbackSeatLayout, seatWindow } from './shared-room-layout.mjs';
import { registeredFilmedProfile } from './dealer-filmed-profiles.mjs';
import { planFilmedTimeline, filmedStepPhase } from '../../../packages/presentation/runtime/filmed-deal-timeline.mjs';
import { nativeRoomFilmedPlanning } from '../../../packages/presentation/contracts/native-room-filmed-planning.mjs';
import { resolvePlayerSelection, applyTableColor } from '../../../packages/presentation/runtime/player-choices.mjs';

const colorOwner=Symbol('shared-room-color');
function roomColor(document,color){
  if(!color)return()=>{};
  const root=document.documentElement,owner={},previous=root.dataset.tableColor;
  const styles=[[root,'--table-felt'],[document.querySelector('#felt-brand'),'color'],[document.querySelector('#wallet'),'border-left-color'],
    [document.querySelector('#chip-row'),'box-shadow']].filter(([node])=>node).map(([node,property])=>({node,property,value:node.style.getPropertyValue?.(property)??'',priority:node.style.getPropertyPriority?.(property)??''}));
  if(!applyTableColor(document,color))return()=>{};
  root[colorOwner]=owner;
  return()=>{
    if(root[colorOwner]!==owner)return;delete root[colorOwner];
    for(const {node,property,value,priority}of styles){if(value)node.style.setProperty(property,value,priority);else node.style.removeProperty?.(property);}
    if(previous===undefined)delete root.dataset.tableColor;else root.dataset.tableColor=previous;
  };
}

// K04's public instructions are rendered through the existing exact media/card ports.
// A reconnect restores authoritative cards and consumes its historical presentation.
// With a filmed profile the deal/reveal steps run on Kevin's table clock (K public/shared-table.js:304-328,
// app.js:214-246): each step has its own time from the take lengths of the published plan, a step reached
// early waits, a late one joins in phase, one whose time is over shows its committed card without film.
// Speech has no published length, so a chain that follows speech anchors where it begins; the plan's
// leading chain keeps the clock. Nothing here selects media or cards: every step is still the server's.
//
// A step's media may not hold the table past its time (K04 at 400 kbit/s, 28 Oct 2026: a 1.58 MB deal
// clip downloaded from 59 to 91 s while turnAt was 56.5 s, so the player saw no cards and no buttons and
// the server stood for them). A step is due at the end of its window on the table clock and, in a plan
// that opens a decision, at the server's turnAt at the latest. A film part that has not shown a frame by
// then is left: its committed card shows at once, its download stays in the verified buffer's grace for
// whoever needs the same bytes next, and after turnAt the rest of the plan shows its cards without film.
// A part that already shows frames plays on; its own take clock ends it.
const MAX_STEP_WAIT_MS = 5000, MAX_TIMER_MS = 2147483647;
const stepLate = () => Object.assign(new DOMException('Step time is over', 'AbortError'), { late: true });
const DEALER_LOADING = 'Dealern laddas…', DEALER_UNAVAILABLE = 'Dealern kunde inte visas.';
// The dealer rests in its decide phase while a player decides (as app.mjs on the native table), else between hands.
export const sharedIdlePhase = snapshot => snapshot?.phase === 'round' && ['decisions', 'insurance'].includes(snapshot.round?.phase) ? 'decide' : 'bets';
// The player's sound choice for this tab. A republished package mounts the table anew, which started muted every
// time. Storage can be absent or throw (a private window, blocked site data): the table then starts muted.
const SOUND_KEY = 'scoutgaming.shared-room.sound';
function readSound(window) { try { return window?.sessionStorage?.getItem(SOUND_KEY) === 'on'; } catch { return false; } }
function writeSound(window, on) { try { window?.sessionStorage?.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* The choice holds for this mount. */ } }
const readyOf = snapshot => snapshot.players?.some(p => p.id === snapshot.me.id && p.ready) === true;
// Both kinds are valid answers, but only moving-speech-stream plays here: its path takes assertCurrent, so a mute,
// a disconnect or a newer answer stops it mid-line. generated-speech-stream plays its own unmuted <video> without that
// check, so it is shown as text (speech_kind_unsupported) until its stream path takes assertCurrent too.
const SPEECH_KINDS = new Set(['moving-speech-stream', 'generated-speech-stream']), PLAYABLE_SPEECH_KINDS = new Set(['moving-speech-stream']);
export const SHARED_ROOM_SOUND_ACTION = 'Slå på ljud';
// playSpeech: generated-speech-player.mjs playGeneratedSpeech (the descriptor's own validation, ticket and stream).
// muted(): the tab's sound choice. caption: {show(text)} for the dealer's spoken or text-only line.
export function createSharedRoomPresentationPorts({ media, cards, composition = null, clock = Date.now, onError = () => {}, onPresentation = () => {}, mediaStallTimeoutMs = 30000, filmedProfile = null, dealerId = null,
  playSpeech = null, muted = () => false, caption = null, host = null }) {
  if (!Number.isSafeInteger(mediaStallTimeoutMs) || mediaStallTimeoutMs < 1 || mediaStallTimeoutMs > 30000) throw new TypeError('shared_room_invalid_media_timeout');
  let state, previousSignal, restoredThrough = 0, offset = 0, closed = false, abortMedia, cancelCurrentClip;
  // The window presentation a new mount found in progress (its placebets). A reconnect of this mount never replays it.
  let mountWindow = null;
  // playing: a presentation runs on `state`. held: a newer state of it arrived meanwhile. resting: the dealer's last idle input.
  let playing = false, held = false, resting;
  // speaking: the one chat answer that owns the dealer's speech. A presentation, a disconnect, a newer answer or close
  // hands the dealer over (stop); the idle film is then theirs to restart, never this answer's.
  let speaking = null;const idleWaiters = new Set();
  const speechLive = () => Boolean(speaking?.live && !speaking.controller.signal.aborted);
  const untilIdle = signal => new Promise((resolve, reject) => {
    if (!playing) { resolve(); return; }
    const done = () => { idleWaiters.delete(wake); signal.removeEventListener('abort', abort); };
    const wake = () => { done(); resolve(); }, abort = () => { done(); reject(signal.reason); };
    idleWaiters.add(wake); signal.addEventListener('abort', abort, { once: true });
  });
  const timelineFor=presentation=>{
    if(!filmedProfile||presentation.kind!=='plan'||!Number.isFinite(presentation.startAt))return null;
    let planning={profile:filmedProfile,dealerId:dealerId??'filmed'};
    if(media.filmedMaterial) {
      try { planning=nativeRoomFilmedPlanning(media.filmedMaterial); }
      catch { onError('shared_room_media_unavailable');return null; }
    }
    const timeline=planFilmedTimeline({...planning,events:presentation.events,startAt:presentation.startAt,endAt:presentation.endAt});
    return timeline.complete?timeline:null;
  };
  // hold.wake ends the wait early, without an error (K04 R2b).
  const pause=(ms,signal,hold={})=>new Promise((resolve,reject)=>{
    const abort=()=>{clearTimeout(timer);hold.wake=null;reject(signal.reason);};
    const done=()=>{clearTimeout(timer);hold.wake=null;signal?.removeEventListener('abort',abort);resolve();};
    const timer=setTimeout(done,Math.min(ms,MAX_STEP_WAIT_MS));
    hold.wake=done;signal?.addEventListener('abort',abort,{once:true});
  });
  return Object.freeze({
    restoreSnapshot(snapshot,{signal,receivedAt=clock()} = {}) {
      signal?.throwIfAborted(); if(closed)return;
      const reconnect = !state || previousSignal?.aborted, mounted = !state;
      // K04 B1: a newer state of the presentation that plays (same connection, presentation, window, configuration
      // and round: the same committed cards) waits for its end here. The film, the card cursor, the table clock
      // and the dealer's state stay as they are; the controls already show the newer state.
      if(playing&&!reconnect&&signal===previousSignal&&['presentationVer','roundId','windowId','configVersion'].every(key=>snapshot[key]===state[key])){
        state=snapshot;held=true;return;
      }
      previousSignal?.removeEventListener('abort',abortMedia);
      abortMedia=()=>{speaking?.stop('disconnect');onPresentation(null);media.state({action:true,speech:false,command:'shared-disconnect'});};
      signal?.addEventListener('abort',abortMedia,{once:true});
      // Only an authoritative transition on this connection confirms collection.
      if(!reconnect&&state.phase==='settled'&&snapshot.phase==='bets'&&snapshot.windowId!==state.windowId)
        void Promise.resolve(media.observeEvents?.([],{command:'collect',previousVersion:state.presentationVer,signal})).catch(()=>onError('shared_room_media_unavailable'));
      if(reconnect){cards.restore(snapshot.round);restoredThrough=snapshot.presentationVer;}
      else if(snapshot.roundId!==state.roundId){cards.clear();cards.sync(snapshot.round);}
      else cards.sync(snapshot.round);
      // Preview 28 Oct 2026: a republished package mounts the table anew, and the open window's placebets was
      // consumed as history, so the dealer never invited the bets. A new mount still plays it while that window is open.
      mountWindow=mounted&&snapshot.phase==='bets'?{ver:snapshot.presentationVer,windowId:snapshot.windowId}:reconnect?null:mountWindow;
      state=snapshot;previousSignal=signal;offset=snapshot.serverNow-receivedAt;
      // Only ready, the idle phase or a new connection changes the dealer's state. Every call stops and restarts the
      // idle film (local-presentation.mjs state()), so another player's bet or ready leaves it playing.
      const ready=readyOf(snapshot),rest=`${ready}:${sharedIdlePhase(snapshot)}`;
      // A chat answer that speaks keeps its speech flag: the idle film stays paused until the answer ends.
      if(reconnect||rest!==resting){resting=rest;media.state({ready,action:false,speech:speechLive()});}
    },
    async present(presentation,{signal,superseded} = {}) {
      signal?.throwIfAborted();if(closed||!state)return;
      if(presentation.ver!==state.presentationVer||presentation.roomId!==state.roomId)throw new Error('shared_room_presentation_mismatch');
      onPresentation(presentation);
      const windowOpen=presentation.kind==='window'&&mountWindow?.ver===presentation.ver&&mountWindow.windowId===presentation.windowId
        &&state.phase==='bets'&&state.windowId===presentation.windowId&&(!Number.isFinite(state.deadline)||state.deadline>clock()+offset);
      mountWindow=null;
      if(presentation.ver<=restoredThrough&&!windowOpen)return;
      // The replayed line competes with the dealer's first idle file, and the controls wait for the presentation: it
      // may not hold the table longer than any step waits for its media. Not shown by then, it is left without text.
      const replayDueAt=presentation.ver<=restoredThrough?clock()+offset+MAX_STEP_WAIT_MS:Infinity;
      if(presentation.kind==='plan'&&presentation.endAt<=clock()+offset){cards.restore(state.round);restoredThrough=presentation.ver;return;}
      const timeline=timelineFor(presentation),fitted=Boolean(timeline?.fit);
      const tableNow=()=>clock()+offset,elapsed=()=>tableNow()-presentation.startAt;
      // The server opens the player's decision at turnAt and refuses it before (NOT_YOUR_TURN).
      // From then on no step of this plan waits for media: the buttons open on the server's clock.
      const turnAt=presentation.kind==='plan'&&state.phase==='round'&&['decisions','insurance'].includes(state.round?.phase)
        &&Number.isFinite(state.plan?.turnAt)?state.plan.turnAt:null;
      const turnPassed=()=>turnAt!==null&&tableNow()>=turnAt;
      // The server's presentation owns the dealer from here: a chat answer that speaks or waits stops now.
      speaking?.stop('presentation');
      // The lookahead names each planned step's exact take, so the next file is prepared before its time.
      // K04 F5 (staging 28 Oct 2026): asked for only when its time began, a step's server answer (1-1.7 s)
      // outlasted the step, so every filmed deal and reveal was left as late. This plan is already committed
      // and published as a whole, so the server's answers for its filmed steps are asked for now. An answer
      // only names the clip of a step of this plan: its card, receipt and film still wait for the step's own
      // time on the table clock, and a step whose answer is still missing at the end of its time is left.
      media.prepareSequence?.(presentation.events.map((event,index)=>{const step=timeline?.eventIndex.get(index);
        // A plan that already carries the server's choice for the step (K04 F5c, #506) keeps it.
        return step&&!event.filmedTake?{...event,filmedTake:{profileId:timeline.profileId,takeKey:step.takeKey,sha256:step.sha256}}:event;}),{selectAhead:!turnPassed(),...(['en','sv'].includes(presentation.language)?{language:presentation.language}:{})});
      media.state({action:true,speech:false});
      void Promise.resolve(media.observeEvents?.([...presentation.events],{signal})).catch(()=>onError('shared_room_media_unavailable'));
      // unavailable: a step's exact media was missing (404/410) or declared
      // unavailable. That step has already ended; the rest of this presentation
      // shows its committed cards at once instead of loading more film, so the
      // table reaches the player's turn on the server's clock, not the media's.
      let completedSequence=false,shiftMs=0,inRun=false,unavailable=false;
      const showCommitted=event=>{if(event.type==='deal')cards.show(event.shoeDraw);else if(event.type==='reveal')cards.reveal(state.round);};
      // K04 R2a (review of #481): the decision opens at turnAt, so the whole plan shows by then. A film part that
      // already shows frames plays on, but its card is placed at turnAt and every later card of the plan shows with
      // it. Each committed card is shown once; nothing is moved or shown again after turnAt.
      const committed=new Set();let cursor=0,placeCurrent=null,turnTimer;
      const commit=index=>{if(committed.has(index))return;committed.add(index);showCommitted(presentation.events[index]);};
      const atTurn=()=>{if(closed||signal?.aborted)return;placeCurrent?.();for(let index=cursor;index<presentation.events.length;index++)commit(index);};
      if(turnAt!==null&&!turnPassed())turnTimer=setTimeout(atTurn,Math.min(MAX_TIMER_MS,Math.max(0,turnAt-tableNow())));
      // K04 R2b (review of #481): a newer committed plan waits behind this one, a player's hit for instance. Once this
      // plan's time is over on the table clock all of its cards are due (R2a: turnAt = endAt bounds every step), so a
      // take that still plays is left and the rest of the plan shows its committed cards now. The newer plan's cards
      // still wait for its own steps. A window or collect presentation (speech, no card) plays to its end.
      let skipRest=false,leaveCurrent=null,supersedeTimer;const hold={};
      const fastForward=()=>{if(closed||signal?.aborted||skipRest)return;skipRest=true;atTurn();leaveCurrent?.();hold.wake?.();};
      const onSuperseded=()=>{
        if(presentation.kind!=='plan'||skipRest)return;
        const wait=presentation.endAt-tableNow();clearTimeout(supersedeTimer);
        if(wait<=0)fastForward();else supersedeTimer=setTimeout(fastForward,Math.min(MAX_TIMER_MS,wait));
      };
      if(superseded?.aborted)onSuperseded();else superseded?.addEventListener('abort',onSuperseded,{once:true});
      playing=true;
      try {
        for(const [index,event] of presentation.events.entries()){
          signal?.throwIfAborted();if(closed)return;cursor=index;
          if(event.type==='idle'||event.type==='turn'||event.type==='settle')continue;
          if(unavailable||skipRest||turnPassed()){commit(index);continue;}
          const step=timeline?.eventIndex.get(index)??null;let timing={},dueAt=Math.min(turnAt??Infinity,replayDueAt);
          if(step){
            const placed=fitted?step.fit:step;
            if(!inRun&&index>0)shiftMs=Math.max(shiftMs,elapsed()-(placed.playbackStartMs??placed.startMs));
            inRun=true;
            let phase=filmedStepPhase(step,elapsed()-shiftMs,{fitted});
            if(phase.waitMs>0){await pause(Math.min(phase.waitMs,Math.max(0,dueAt-tableNow())),signal,hold);signal?.throwIfAborted();if(closed)return;phase=filmedStepPhase(step,elapsed()-shiftMs,{fitted});}
            if(phase.expired||skipRest||turnPassed()){
              // Its time is over on the table clock: the committed card is shown, the take is never replayed from its start.
              commit(index);
              continue;
            }
            // A separate entry clip must play whole. Anchor its exact take after
            // that clip, preserving the local chain without moving the deadline.
            if(step.beforeMs)shiftMs=Math.max(shiftMs,elapsed()-placed.playbackStartMs);
            const startMs=phase.startMs+shiftMs;
            timing={startOffset:step.beforeMs?0:phase.seekS,handoverAt:step.handoverMs/1000,...(fitted?{playbackRate:phase.rate}:{}),clockTime:()=>Math.max(0,(elapsed()-startMs)*phase.rate/1000)};
            dueAt=Math.min(dueAt,presentation.startAt+shiftMs+(placed.playbackEndMs??placed.endMs));
          } else inRun=false;
          for(const layerEvent of ['backgroundEvent','tableEvent'])composition?.[layerEvent]?.(event.type==='speak'?'speak.'+event.line:event.type,`${presentation.talkId}:${presentation.ver}:${event.shoeDraw??event.line}`);
          let token,completed=false,timer,lastFrame=-1,selectedId,accepting=true,progressClip=0,progressPhase,lastProgressFrame=-1,lastReceived=0;
          // shown: the current film part has presented a frame. due: the step's time is over.
          let shown=false,due=false,left=false,dueTimer,resolveLeft;
          const clip=new AbortController();
          const relay=()=>clip.abort(signal.reason);
          signal?.addEventListener('abort',relay,{once:true});
          let rejectStall;
          const stalled=new Promise((_,reject)=>{rejectStall=reject;});
          const leftStep=new Promise(resolve=>{resolveLeft=resolve;});
          const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{
            const error=Object.assign(new Error('shared_room_media_stalled'),{rendererTimeout:true});
            rejectStall(error);clip.abort(error);
          },mediaStallTimeoutMs);};
          const cancel=()=>{clearTimeout(timer);clearTimeout(dueTimer);const reason=new DOMException('Presentation closed','AbortError');rejectStall(reason);clip.abort(reason);};
          // Leave a step whose time is over before its current film part showed a frame. Not an error.
          const leave=()=>{if(left||clip.signal.aborted||closed||!accepting)return;left=true;clearTimeout(timer);clearTimeout(dueTimer);resolveLeft();clip.abort(stepLate());};
          leaveCurrent=leave;
          if(Number.isFinite(dueAt))dueTimer=setTimeout(()=>{due=true;if(!shown)leave();},Math.min(MAX_TIMER_MS,Math.max(0,dueAt-tableNow())));
          const progress=value=>{
            if(clip.signal.aborted||closed||!accepting||!Number.isInteger(value?.clip)||value.clip<1||value.clip>4)return;
            if(value.phase==='prepare'&&value.clip===progressClip+1){progressClip=value.clip;progressPhase='prepare';lastProgressFrame=-1;lastReceived=0;shown=false;if(due){leave();return;}arm();}
            else if(value.clip===progressClip){
              if(value.phase==='play'&&progressPhase==='prepare'){progressPhase='play';arm();}
              // New verified-buffer bytes renew the lease: a slow download is
              // bounded by silence and the frozen total, never by its length.
              else if(value.phase==='download'&&progressPhase==='play'&&Number.isSafeInteger(value.received)&&value.received>lastReceived){lastReceived=value.received;arm();}
              else if(value.phase==='frame'&&progressPhase==='play'&&Number.isFinite(value.time)&&value.time>=0&&value.time>lastProgressFrame){lastProgressFrame=value.time;shown=true;arm();}
              else if(value.phase==='complete'&&progressPhase==='play'){progressPhase='complete';arm();}
            }
          };
          cancelCurrentClip=cancel;arm();
          placeCurrent=()=>{if(token!==undefined&&!committed.has(index))cards.finish(token,event.shoeDraw,false);};
          try {
            const outcome=await Promise.race([stalled,leftStep,Promise.resolve().then(()=>{clip.signal.throwIfAborted();return media.present(event,{signal:clip.signal,onProgress:progress,...timing,
              onUnavailable:()=>{if(!clip.signal.aborted&&!closed&&accepting)unavailable=true;},
              // K04 F9: a stalled take whose card this cursor already shows ends its step without error text.
              shown:()=>token!==undefined&&!committed.has(index)&&cards.shown?.(token)===true,
              onSelected:(video,source)=>{clip.signal.throwIfAborted();if(closed||!accepting)return;
                if(video?.id!==selectedId){selectedId=video?.id;lastFrame=-1;}
                if((event.type==='deal'||event.type==='reveal')&&!committed.has(index))token=cards.begin(video,source);},
              onFrame:time=>{if(clip.signal.aborted||closed||!accepting)return;
                // Repeated frozen frames do not prove a live clip. A new verified
                // fallback may start at zero, but selection alone renews no lease.
                if(Number.isFinite(time)&&time>=0&&time>lastFrame){lastFrame=time;shown=true;arm();}
                if(token!==undefined&&!committed.has(index))cards.frame(token,time);}});})]);
            if(!left){
              clip.signal.throwIfAborted();completed=outcome;
              if(completed===false)onError('shared_room_media_unavailable');
            }
          } finally {
            accepting=false;clearTimeout(timer);clearTimeout(dueTimer);signal?.removeEventListener('abort',relay);
            if(cancelCurrentClip===cancel)cancelCurrentClip=null;
            placeCurrent=null;if(leaveCurrent===leave)leaveCurrent=null;
            if(!closed&&(left?!signal?.aborted:!clip.signal.aborted)&&!committed.has(index)){
              committed.add(index);
              if(token!==undefined)cards.finish(token,event.shoeDraw,completed===true);
              else if(event.type==='deal')cards.show(event.shoeDraw);
              if(event.type==='reveal')cards.reveal(state.round);
            }
          }
        }
        restoredThrough=presentation.ver;completedSequence=true;
      } finally {
        clearTimeout(turnTimer);clearTimeout(supersedeTimer);superseded?.removeEventListener('abort',onSuperseded);playing=false;
        if(completedSequence&&!closed&&!signal?.aborted){
          // A state held during the plan reaches the cards and the dealer now.
          if(held)cards.sync(state.round);
          const ready=readyOf(state);resting=`${ready}:${sharedIdlePhase(state)}`;media.state({action:false,speech:false,ready});
        }
        held=false;
        for(const wake of [...idleWaiters])wake();
      }
    },
    // One chat answer's speech (PR 3, plan-chatt-tal-lipsync §3). It waits while a plan plays and stops when a
    // presentation starts. Resolves {speech:'played'|'text-only'|'cancelled',reason?}; rejects for a descriptor of
    // another dealer, a missing authority or the caller's own abort. The text is always shown in #caption.
    async speak(descriptor,{signal}={}){
      signal?.throwIfAborted();
      if(closed||!state)throw new Error('shared_room_media_authority_unavailable');
      const text=descriptor?.exactText;
      if(!SPEECH_KINDS.has(descriptor?.kind)||typeof text!=='string'||!text.trim()||text.length>500)throw new Error('shared_room_speech_invalid');
      if(!dealerId||descriptor.dealerId!==dealerId)throw new Error('shared_room_speech_dealer_mismatch');
      const roomId=state.roomId,configVersion=state.configVersion;
      speaking?.stop('replaced');
      const owner={controller:new AbortController(),live:false,reason:null};
      owner.stop=reason=>{if(owner.controller.signal.aborted)return;owner.reason=reason;owner.controller.abort(new DOMException('Shared room speech '+reason,'AbortError'));};
      speaking=owner;
      const relay=()=>owner.stop('caller');signal?.addEventListener('abort',relay,{once:true});
      // Same room, binding and dealer as when the answer arrived, and the player still listens.
      const current=()=>{
        owner.controller.signal.throwIfAborted();
        if(closed||speaking!==owner||state.roomId!==roomId||state.configVersion!==configVersion||descriptor.dealerId!==dealerId)throw new Error('shared_room_speech_stale');
        if(muted())throw new Error('shared_room_speech_muted');
      };
      const textOnly=reason=>{caption?.show(text);return{speech:'text-only',reason,...(reason==='muted'?{action:SHARED_ROOM_SOUND_ACTION}:{})};};
      try{
        if(muted())return textOnly('muted');
        if(!PLAYABLE_SPEECH_KINDS.has(descriptor.kind))return textOnly('speech_kind_unsupported');
        if(!playSpeech)return textOnly('speech_player_unavailable');
        while(playing)await untilIdle(owner.controller.signal);
        current();
        owner.live=true;media.state({speech:true,ready:false});
        await playSpeech(descriptor,{exactText:text,dealerId,requestId:descriptor.requestId,mount:host,signal:owner.controller.signal,
          beforeStart:async()=>current(),assertCurrent:current,
          prepareRendering:(compositing,framing)=>composition?.prepareClip(compositing??undefined,framing),
          renderFrame:(video,presented)=>composition?.renderFrame(video,presented)??false,
          setMovingSpeechLayer:layer=>composition?.setMovingSpeechLayer(layer),
          onStart:spoken=>caption?.show(spoken)});
        return{speech:'played'};
      }catch(error){
        if(owner.reason==='caller')throw signal?.reason??error;
        if(owner.reason)return{speech:'cancelled',reason:owner.reason};
        return textOnly(muted()?'muted':'speech_playback_failed');
      }finally{
        signal?.removeEventListener('abort',relay);
        if(speaking===owner)speaking=null;
        // Only an answer that ended itself (or its caller) gives the dealer back to the idle film. A replaced answer
        // does too when the newer one does not speak (muted, text only, failed): otherwise the idle film stays paused.
        if(owner.live&&!closed&&([null,'caller'].includes(owner.reason)||(owner.reason==='replaced'&&!speechLive())))media.state({speech:false,ready:readyOf(state)});
      }
    },
    close(){if(closed)return;closed=true;speaking?.stop('closed');previousSignal?.removeEventListener('abort',abortMedia);cancelCurrentClip?.();media.close();cards.close();composition?.close();},
  });
}

export async function mountSharedRoomPresentation({ document, window, selection, onReady, onError, signal, transport = null,
  createComposition=createLayerComposition, loadAdapters=()=>Promise.all([import('./performance-player.mjs'),import('./local-presentation.mjs'),import('./local-card-overlay.mjs')]),
  loadSpeechPlayer=()=>import('../../../packages/presentation/runtime/generated-speech-player.mjs') }) {
  if(selection.presentation!=='local')throw new Error('shared_room_presentation_adapter_unavailable');
  const host=document.getElementById('scene');
  const dealer=selection.registeredDealers?.find(row=>row.id===selection.dealer);
  if(!host||!dealer||selection.localDealer!==dealer.id||!/^[a-z0-9_-]{1,128}$/.test(selection.roomId??''))throw new Error('shared_room_presentation_binding_missing');
  const filmedProfile=registeredFilmedProfile(dealer.id);
  signal?.throwIfAborted();
  const [{PerformancePlayer},{createLocalPresentation},{createLocalCardOverlay}]=await loadAdapters();
  signal?.throwIfAborted();
  const composition=createComposition(document,selection.composition);
  // The table never waits for the dealer's film (K04 at 400 kbit/s). Until the
  // first verified dealer frame, the dealer's place says so instead of staying blank.
  const placeholder=document.createElement('p');placeholder.className='shared-room-dealer-placeholder';
  placeholder.setAttribute('role','status');placeholder.setAttribute('aria-live','polite');placeholder.textContent=DEALER_LOADING;host.append(placeholder);
  let dealerShown=false;
  const dealerFrame=()=>{if(!dealerShown){dealerShown=true;placeholder.remove();}onReady(dealer.id);};
  let player;
  let media,cards,version=0,muted=!readSound(window),lastLayout,currentPresentation,currentConnection,latest,restoreColor=()=>{};
  const sound=document.getElementById('sound-btn');
  // Preview 28 Oct 2026: the toggle restarted the presentation (state({}) stops the film that plays), so it cut the
  // line it was meant to make heard. Now only the playing line's video.muted changes.
  const onSound=()=>{muted=!muted;writeSound(window,!muted);paintSound();media?.sound?.();};
  const paintSound=()=>{if(sound){sound.textContent=muted?'🔇':'🔊';sound.setAttribute('aria-label',muted?'Slå på dealerljud':'Stäng av dealerljud');sound.setAttribute('aria-pressed',String(!muted));}};
  try {
    player=new PerformancePlayer({host});
    const request=(url,options={})=>{
      if(url==='/api/presentation/config'||url.startsWith('/api/presentation/config?'))
        url=url.replace('/api/presentation/config',`/api/presentation/shared-room/${selection.roomId}/config`);
      else if(url==='/api/presentation/idle-advice')url=`/api/presentation/shared-room/${selection.roomId}/idle-advice`;
      if(url==='/api/presentation/select'){
        if(!currentPresentation||currentPresentation.ver!==version)throw new Error('shared_room_media_authority_unavailable');
        const body=JSON.parse(options.body);
        if(body.version!==currentPresentation.ver)throw new Error('shared_room_media_authority_unavailable');
        options={...options,body:JSON.stringify({...body,sharedRoom:{roomId:currentPresentation.roomId,ver:currentPresentation.ver,talkId:currentPresentation.talkId}})};
      }
      const requestPort=transport?.request??window.fetch.bind(window);
      return requestPort(url,{...options,credentials:'same-origin',mode:'same-origin',redirect:'error',
        signal:combineAbortSignals([signal,currentConnection,options.signal,AbortSignal.timeout(10000)])});
    };
    // K04 (comparison with Kevin's table, B4): the idle rotation learns when a player decides, as on the native table.
    // Its idle films skip the per-play package read (two passes through the engine's global lock per player and
    // clip): the server confirmed this binding for its window, and the WS binding and 409 stale catch a change.
    media=await createLocalPresentation({player,host,dealerId:dealer.id,entry:selection,version:()=>version,idlePhase:()=>sharedIdlePhase(latest),idleConfigRead:false,
      muted:()=>muted,composition,transport:{request},receipt:()=>{},onIdle:dealerFrame,onBusy:()=>{},
      // A dealer that cannot be shown releases a background film deferred for its first frame.
      onError:()=>{if(!dealerShown){placeholder.textContent=DEALER_UNAVAILABLE;composition?.dealerUnavailable?.();}onError('shared_room_media_unavailable');}});
    signal?.throwIfAborted();
    cards=createLocalCardOverlay(host,{dealerLabel:dealer.label,filmedProfile});
    // Apply only this server binding's N2 values. Shared tables never read a
    // personal dealer/colour override or query-string choice here.
    const chosen=resolvePlayerSelection({choices:selection.choices,branding:selection.branding,currentDealer:dealer.id,composition:selection.composition});
    if(chosen.applyBackground)composition?.setBackground(chosen.backgroundValue);
    if(chosen.tableValue)composition?.setTable(chosen.tableValue);
    restoreColor=roomColor(document,chosen.tableColor);
  } catch(error){media?.close();cards?.close();player?.dispose();composition?.close();restoreColor();placeholder.remove();throw error;}
  // The speech player loads with the first chat answer, never with the table.
  const captionNode=document.getElementById('caption');let captionTimer;
  const caption={show(text){if(!captionNode)return;clearTimeout(captionTimer);captionNode.textContent=text;captionNode.classList?.add('show');
    captionTimer=setTimeout(()=>captionNode.classList?.remove('show'),Math.min(27000,3000+text.length*70));}};
  const ports=createSharedRoomPresentationPorts({media,cards,composition,onError,onPresentation:value=>{currentPresentation=value;},filmedProfile,dealerId:dealer.id,
    host,muted:()=>muted,caption,playSpeech:async(...args)=>(await loadSpeechPlayer()).playGeneratedSpeech(...args)});
  let floorSize,floorTop;
  function layout(value=lastLayout){
    if(!value)return;lastLayout=value;
    const scene=host.getBoundingClientRect(),table=document.getElementById('table2d').getBoundingClientRect();
    const plane=composition?.referencePlane(),compact=window.matchMedia?.(BLACKJACK_COMPACT_QUERY).matches;
    const boxes=compact?seatWindow(value.snapshot,value.focusSeat).boxes:[0,1,2,3,4,5,6];
    const width=scene.width,height=scene.height;
    // K04 F13: the seats keep clear of the bottom controls (dock, action zone, wallet and chips), so the room
    // above them is measured. A seat's controls reach about 140 px below its anchor on a wide screen; a phone
    // shows only the seat's circle there (its bets dock in the bottom controls).
    // The bottom controls change height with the phase (a phone's dock and chips belong to the betting window). The
    // plane keeps the tallest seen at this screen size, so cards never move between phases; a resize measures anew.
    const hud=document.getElementById('hud-bottom')?.getBoundingClientRect?.(),size=`${Math.round(width)}x${Math.round(height)}`;
    if(size!==floorSize){floorSize=size;floorTop=undefined;}
    if(hud?.height>0)floorTop=Math.min(floorTop??Infinity,height,hud.top-scene.top);
    const floor=floorTop??height-150,below=compact?28:140;
    let projected;
    // The seats stand on the same boxes as the cards (layoutGameOverlay): centred under each box, the circle just
    // below the hand total at a fixed pixel size, in every window shape. A phone moves its three touch targets apart
    // only as far as they need, evenly around the boxes.
    if(plane)projected=layoutGameOverlay(plane,boxes,{left:12,right:width-12,top:80,bottom:Math.max(200,floor-below+16)},{compact,filmedProfile,seatHalf:SEAT_HALF_PX});
    // Without a composition plane the seats stand on the dealer's filmed landings (shared-room-layout.mjs); the
    // calibrated row only stands in for a dealer without a filmed profile. No board or dealer is selected here.
    else projected=fallbackSeatLayout({width,height,boxes,filmedProfile,compact:Boolean(compact)});
    for(const [i,node] of value.seats.entries())node.hidden=!boxes.includes(i);
    for(const item of projected.seats){const node=value.seats[item.box];Object.assign(node.style,{left:(scene.left+item.x-table.left)+'px',top:(scene.top+item.y-table.top)+'px'});node.style.setProperty('--game-seat-scale',String(projected.controlScale));}
    cards.setProjection(projected,width,height);
  }
  const unGeometry=composition?.onGeometryChange(layout);
  const resize=()=>layout();window.addEventListener('resize',resize);sound?.addEventListener('click',onSound);paintSound();
  let closed=false;
  const close=()=>{if(closed)return;closed=true;clearTimeout(captionTimer);window.removeEventListener('resize',resize);sound?.removeEventListener('click',onSound);unGeometry?.();ports.close();player.dispose();restoreColor();placeholder.remove();};
  try{signal?.throwIfAborted();media.start();}catch(error){close();throw error;}
  return Object.freeze({
    restoreSnapshot(snapshot,options){latest=snapshot;currentConnection=options?.signal;version=snapshot.presentationVer;if(currentPresentation?.ver!==version)currentPresentation=null;return ports.restoreSnapshot(snapshot,options);},
    present:ports.present,layout,speak:ports.speak,
    // The chat's "Slå på ljud" for a text-only answer: the same toggle as the sound button.
    enableSound(){if(!closed&&muted)onSound();},
    close,
  });
}

