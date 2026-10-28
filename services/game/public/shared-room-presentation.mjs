import { createLayerComposition } from '../../../packages/presentation/runtime/presentation-composition.mjs';
import { combineAbortSignals } from './abort-signals.mjs';
import { layoutGameOverlay, BLACKJACK_COMPACT_QUERY } from '../../../packages/presentation/runtime/game-overlay-layout.mjs';
import { calibration } from '../../../packages/presentation/contracts/calibration.mjs';
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
export function createSharedRoomPresentationPorts({ media, cards, composition = null, clock = Date.now, onError = () => {}, onPresentation = () => {}, mediaStallTimeoutMs = 30000, filmedProfile = null, dealerId = null }) {
  if (!Number.isSafeInteger(mediaStallTimeoutMs) || mediaStallTimeoutMs < 1 || mediaStallTimeoutMs > 30000) throw new TypeError('shared_room_invalid_media_timeout');
  let state, previousSignal, restoredThrough = 0, offset = 0, closed = false, abortMedia, cancelCurrentClip;
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
  const pause=(ms,signal)=>new Promise((resolve,reject)=>{
    const abort=()=>{clearTimeout(timer);reject(signal.reason);};
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},Math.min(ms,MAX_STEP_WAIT_MS));
    signal?.addEventListener('abort',abort,{once:true});
  });
  return Object.freeze({
    restoreSnapshot(snapshot,{signal} = {}) {
      signal?.throwIfAborted(); if(closed)return;
      const reconnect = !state || previousSignal?.aborted;
      previousSignal?.removeEventListener('abort',abortMedia);
      abortMedia=()=>{onPresentation(null);media.state({action:true,speech:false,command:'shared-disconnect'});};
      signal?.addEventListener('abort',abortMedia,{once:true});
      // Only an authoritative transition on this connection confirms collection.
      if(!reconnect&&state.phase==='settled'&&snapshot.phase==='bets'&&snapshot.windowId!==state.windowId)
        void Promise.resolve(media.observeEvents?.([],{command:'collect',previousVersion:state.presentationVer,signal})).catch(()=>onError('shared_room_media_unavailable'));
      if(reconnect){cards.restore(snapshot.round);restoredThrough=snapshot.presentationVer;}
      else if(snapshot.roundId!==state.roundId){cards.clear();cards.sync(snapshot.round);}
      else cards.sync(snapshot.round);
      state=snapshot;previousSignal=signal;offset=snapshot.serverNow-clock();
      media.state({ready:snapshot.players?.some(p=>p.id===snapshot.me.id&&p.ready)===true,action:false,speech:false});
    },
    async present(presentation,{signal} = {}) {
      signal?.throwIfAborted();if(closed||!state)return;
      if(presentation.ver!==state.presentationVer||presentation.roomId!==state.roomId)throw new Error('shared_room_presentation_mismatch');
      onPresentation(presentation);
      if(presentation.ver<=restoredThrough)return;
      if(presentation.kind==='plan'&&presentation.endAt<=clock()+offset){cards.restore(state.round);restoredThrough=presentation.ver;return;}
      const timeline=timelineFor(presentation),fitted=Boolean(timeline?.fit);
      // The lookahead names each planned step's exact take, so the next file is prepared before its time.
      media.prepareSequence?.(presentation.events.map((event,index)=>{const step=timeline?.eventIndex.get(index);
        return step?{...event,filmedTake:{profileId:timeline.profileId,takeKey:step.takeKey,sha256:step.sha256}}:event;}));
      media.state({action:true,speech:false});
      void Promise.resolve(media.observeEvents?.([...presentation.events],{signal})).catch(()=>onError('shared_room_media_unavailable'));
      // unavailable: a step's exact media was missing (404/410) or declared
      // unavailable. That step has already ended; the rest of this presentation
      // shows its committed cards at once instead of loading more film, so the
      // table reaches the player's turn on the server's clock, not the media's.
      let completedSequence=false,shiftMs=0,inRun=false,unavailable=false;
      const tableNow=()=>clock()+offset,elapsed=()=>tableNow()-presentation.startAt;
      // The server opens the player's decision at turnAt and refuses it before (NOT_YOUR_TURN).
      // From then on no step of this plan waits for media: the buttons open on the server's clock.
      const turnAt=presentation.kind==='plan'&&state.phase==='round'&&['decisions','insurance'].includes(state.round?.phase)
        &&Number.isFinite(state.plan?.turnAt)?state.plan.turnAt:null;
      const turnPassed=()=>turnAt!==null&&tableNow()>=turnAt;
      const showCommitted=event=>{if(event.type==='deal')cards.show(event.shoeDraw);else if(event.type==='reveal')cards.reveal(state.round);};
      try {
        for(const [index,event] of presentation.events.entries()){
          signal?.throwIfAborted();if(closed)return;
          if(event.type==='idle'||event.type==='turn'||event.type==='settle')continue;
          if(unavailable||turnPassed()){showCommitted(event);continue;}
          const step=timeline?.eventIndex.get(index)??null;let timing={},dueAt=turnAt??Infinity;
          if(step){
            const placed=fitted?step.fit:step;
            if(!inRun&&index>0)shiftMs=Math.max(shiftMs,elapsed()-(placed.playbackStartMs??placed.startMs));
            inRun=true;
            let phase=filmedStepPhase(step,elapsed()-shiftMs,{fitted});
            if(phase.waitMs>0){await pause(Math.min(phase.waitMs,Math.max(0,dueAt-tableNow())),signal);signal?.throwIfAborted();if(closed)return;phase=filmedStepPhase(step,elapsed()-shiftMs,{fitted});}
            if(phase.expired||turnPassed()){
              // Its time is over on the table clock: the committed card is shown, the take is never replayed from its start.
              showCommitted(event);
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
          try {
            const outcome=await Promise.race([stalled,leftStep,Promise.resolve().then(()=>{clip.signal.throwIfAborted();return media.present(event,{signal:clip.signal,onProgress:progress,...timing,
              onUnavailable:()=>{if(!clip.signal.aborted&&!closed&&accepting)unavailable=true;},
              onSelected:(video,source)=>{clip.signal.throwIfAborted();if(closed||!accepting)return;
                if(video?.id!==selectedId){selectedId=video?.id;lastFrame=-1;}
                if(event.type==='deal'||event.type==='reveal')token=cards.begin(video,source);},
              onFrame:time=>{if(clip.signal.aborted||closed||!accepting)return;
                // Repeated frozen frames do not prove a live clip. A new verified
                // fallback may start at zero, but selection alone renews no lease.
                if(Number.isFinite(time)&&time>=0&&time>lastFrame){lastFrame=time;shown=true;arm();}
                if(token!==undefined)cards.frame(token,time);}});})]);
            if(!left){
              clip.signal.throwIfAborted();completed=outcome;
              if(completed===false)onError('shared_room_media_unavailable');
            }
          } finally {
            accepting=false;clearTimeout(timer);clearTimeout(dueTimer);signal?.removeEventListener('abort',relay);
            if(cancelCurrentClip===cancel)cancelCurrentClip=null;
            if(!closed&&(left?!signal?.aborted:!clip.signal.aborted)){
              if(token!==undefined)cards.finish(token,event.shoeDraw,completed===true);
              else if(event.type==='deal')cards.show(event.shoeDraw);
              if(event.type==='reveal')cards.reveal(state.round);
            }
          }
        }
        restoredThrough=presentation.ver;completedSequence=true;
      } finally {if(completedSequence&&!closed&&!signal?.aborted){media.state({action:false,speech:false});}}
    },
    close(){if(closed)return;closed=true;previousSignal?.removeEventListener('abort',abortMedia);cancelCurrentClip?.();media.close();cards.close();composition?.close();},
  });
}

export async function mountSharedRoomPresentation({ document, window, selection, onReady, onError, signal, transport = null,
  createComposition=createLayerComposition, loadAdapters=()=>Promise.all([import('./performance-player.mjs'),import('./local-presentation.mjs'),import('./local-card-overlay.mjs')]) }) {
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
  let media,cards,version=0,muted=true,lastLayout,currentPresentation,currentConnection,restoreColor=()=>{};
  const sound=document.getElementById('sound-btn');
  const onSound=()=>{muted=!muted;paintSound();media?.state({});};
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
    media=await createLocalPresentation({player,host,dealerId:dealer.id,entry:selection,version:()=>version,
      muted:()=>muted,composition,transport:{request},receipt:()=>{},onIdle:dealerFrame,onBusy:()=>{},
      onError:()=>{if(!dealerShown)placeholder.textContent=DEALER_UNAVAILABLE;onError('shared_room_media_unavailable');}});
    signal?.throwIfAborted();
    cards=createLocalCardOverlay(host,{dealerLabel:dealer.label,filmedProfile});
    // Apply only this server binding's N2 values. Shared tables never read a
    // personal dealer/colour override or query-string choice here.
    const chosen=resolvePlayerSelection({choices:selection.choices,branding:selection.branding,currentDealer:dealer.id,composition:selection.composition});
    if(chosen.applyBackground)composition?.setBackground(chosen.backgroundValue);
    if(chosen.tableValue)composition?.setTable(chosen.tableValue);
    restoreColor=roomColor(document,chosen.tableColor);
  } catch(error){media?.close();cards?.close();player?.dispose();composition?.close();restoreColor();placeholder.remove();throw error;}
  const ports=createSharedRoomPresentationPorts({media,cards,composition,onError,onPresentation:value=>{currentPresentation=value;},filmedProfile,dealerId:dealer.id});
  function layout(value=lastLayout){
    if(!value)return;lastLayout=value;
    const scene=host.getBoundingClientRect(),table=document.getElementById('table2d').getBoundingClientRect();
    const plane=composition?.referencePlane(),compact=window.matchMedia?.(BLACKJACK_COMPACT_QUERY).matches;
    const active=value.snapshot.round?.hands?.[value.snapshot.round.active]?.box;
    const centre=Number.isInteger(active)?active:value.focusSeat??value.snapshot.me.seats[0]??3;
    const boxes=compact?Array.from({length:3},(_,i)=>Math.max(0,Math.min(4,centre-1))+i):[0,1,2,3,4,5,6];
    const width=scene.width,height=scene.height;
    let projected;
    if(plane)projected=layoutGameOverlay(plane,boxes,{left:12,right:width-12,top:80,bottom:height-150},{compact,filmedProfile});
    else {
      // Existing calibrated film plane; no replacement board or dealer is selected here.
      const scale=Math.min(width/1080,height/1920),x=(width-1080*scale)/2,y=(height-1920*scale)/2;
      projected={x,y,scale,positions:calibration.positions,offsets:{},cardView:'table',followCards:true,boxes,
        seats:boxes.map(box=>({box,x:x+calibration.positions[String(box+1)].cx*scale,y:y+calibration.positions[String(box+1)].cy*scale})),controlScale:Math.max(.65,scale)};
    }
    for(const [i,node] of value.seats.entries())node.hidden=!boxes.includes(i);
    for(const item of projected.seats){const node=value.seats[item.box];Object.assign(node.style,{left:(scene.left+item.x-table.left)+'px',top:(scene.top+item.y-table.top)+'px'});node.style.setProperty('--game-seat-scale',String(projected.controlScale));}
    cards.setProjection(projected,width,height);
  }
  const unGeometry=composition?.onGeometryChange(layout);
  const resize=()=>layout();window.addEventListener('resize',resize);sound?.addEventListener('click',onSound);paintSound();
  let closed=false;
  const close=()=>{if(closed)return;closed=true;window.removeEventListener('resize',resize);sound?.removeEventListener('click',onSound);unGeometry?.();ports.close();player.dispose();restoreColor();placeholder.remove();};
  try{signal?.throwIfAborted();media.start();}catch(error){close();throw error;}
  return Object.freeze({
    restoreSnapshot(snapshot,options){currentConnection=options?.signal;version=snapshot.presentationVer;if(currentPresentation?.ver!==version)currentPresentation=null;return ports.restoreSnapshot(snapshot,options);},
    present:ports.present,layout,
    close,
  });
}

