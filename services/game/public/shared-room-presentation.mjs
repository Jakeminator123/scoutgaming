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
const MAX_STEP_WAIT_MS = 5000;
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
      let completedSequence=false,shiftMs=0,inRun=false;
      const elapsed=()=>clock()+offset-presentation.startAt;
      try {
        for(const [index,event] of presentation.events.entries()){
          signal?.throwIfAborted();if(closed)return;
          if(event.type==='idle'||event.type==='turn'||event.type==='settle')continue;
          const step=timeline?.eventIndex.get(index)??null;let timing={};
          if(step){
            const placed=fitted?step.fit:step;
            if(!inRun&&index>0)shiftMs=Math.max(shiftMs,elapsed()-(placed.playbackStartMs??placed.startMs));
            inRun=true;
            let phase=filmedStepPhase(step,elapsed()-shiftMs,{fitted});
            if(phase.waitMs>0){await pause(phase.waitMs,signal);signal?.throwIfAborted();if(closed)return;phase=filmedStepPhase(step,elapsed()-shiftMs,{fitted});}
            if(phase.expired){
              // Its time is over on the table clock: the committed card is shown, the take is never replayed from its start.
              if(event.type==='deal')cards.show(event.shoeDraw);else if(event.type==='reveal')cards.reveal(state.round);
              continue;
            }
            // A separate entry clip must play whole. Anchor its exact take after
            // that clip, preserving the local chain without moving the deadline.
            if(step.beforeMs)shiftMs=Math.max(shiftMs,elapsed()-placed.playbackStartMs);
            const startMs=phase.startMs+shiftMs;
            timing={startOffset:step.beforeMs?0:phase.seekS,handoverAt:step.handoverMs/1000,...(fitted?{playbackRate:phase.rate}:{}),clockTime:()=>Math.max(0,(elapsed()-startMs)*phase.rate/1000)};
          } else inRun=false;
          for(const layerEvent of ['backgroundEvent','tableEvent'])composition?.[layerEvent]?.(event.type==='speak'?'speak.'+event.line:event.type,`${presentation.talkId}:${presentation.ver}:${event.shoeDraw??event.line}`);
          let token,completed=false,timer,lastFrame=-1,selectedId,accepting=true,progressClip=0,progressPhase,lastProgressFrame=-1;
          const clip=new AbortController();
          const relay=()=>clip.abort(signal.reason);
          signal?.addEventListener('abort',relay,{once:true});
          let rejectStall;
          const stalled=new Promise((_,reject)=>{rejectStall=reject;});
          const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{
            const error=Object.assign(new Error('shared_room_media_stalled'),{rendererTimeout:true});
            rejectStall(error);clip.abort(error);
          },mediaStallTimeoutMs);};
          const cancel=()=>{clearTimeout(timer);const reason=new DOMException('Presentation closed','AbortError');rejectStall(reason);clip.abort(reason);};
          const progress=value=>{
            if(clip.signal.aborted||closed||!accepting||!Number.isInteger(value?.clip)||value.clip<1||value.clip>4)return;
            if(value.phase==='prepare'&&value.clip===progressClip+1){progressClip=value.clip;progressPhase='prepare';lastProgressFrame=-1;arm();}
            else if(value.clip===progressClip){
              if(value.phase==='play'&&progressPhase==='prepare'){progressPhase='play';arm();}
              else if(value.phase==='frame'&&progressPhase==='play'&&Number.isFinite(value.time)&&value.time>=0&&value.time>lastProgressFrame){lastProgressFrame=value.time;arm();}
              else if(value.phase==='complete'&&progressPhase==='play'){progressPhase='complete';arm();}
            }
          };
          cancelCurrentClip=cancel;arm();
          try {
            completed=await Promise.race([stalled,Promise.resolve().then(()=>{clip.signal.throwIfAborted();return media.present(event,{signal:clip.signal,onProgress:progress,...timing,
              onSelected:(video,source)=>{clip.signal.throwIfAborted();if(closed||!accepting)return;
                if(video?.id!==selectedId){selectedId=video?.id;lastFrame=-1;}
                if(event.type==='deal'||event.type==='reveal')token=cards.begin(video,source);},
              onFrame:time=>{if(clip.signal.aborted||closed||!accepting)return;
                // Repeated frozen frames do not prove a live clip. A new verified
                // fallback may start at zero, but selection alone renews no lease.
                if(Number.isFinite(time)&&time>=0&&time>lastFrame){lastFrame=time;arm();}
                if(token!==undefined)cards.frame(token,time);}});})]);
            clip.signal.throwIfAborted();
            if(completed===false)onError('shared_room_media_unavailable');
          } finally {
            accepting=false;clearTimeout(timer);signal?.removeEventListener('abort',relay);
            if(cancelCurrentClip===cancel)cancelCurrentClip=null;
            if(!clip.signal.aborted&&!closed){
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
      muted:()=>muted,composition,transport:{request},receipt:()=>{},onIdle:()=>onReady(dealer.id),onBusy:()=>{},onError:()=>onError('shared_room_media_unavailable')});
    signal?.throwIfAborted();
    cards=createLocalCardOverlay(host,{dealerLabel:dealer.label,filmedProfile});
    // Apply only this server binding's N2 values. Shared tables never read a
    // personal dealer/colour override or query-string choice here.
    const chosen=resolvePlayerSelection({choices:selection.choices,branding:selection.branding,currentDealer:dealer.id,composition:selection.composition});
    if(chosen.applyBackground)composition?.setBackground(chosen.backgroundValue);
    if(chosen.tableValue)composition?.setTable(chosen.tableValue);
    restoreColor=roomColor(document,chosen.tableColor);
  } catch(error){media?.close();cards?.close();player?.dispose();composition?.close();restoreColor();throw error;}
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
  const close=()=>{if(closed)return;closed=true;window.removeEventListener('resize',resize);sound?.removeEventListener('click',onSound);unGeometry?.();ports.close();player.dispose();restoreColor();};
  try{signal?.throwIfAborted();media.start();}catch(error){close();throw error;}
  return Object.freeze({
    restoreSnapshot(snapshot,options){currentConnection=options?.signal;version=snapshot.presentationVer;if(currentPresentation?.ver!==version)currentPresentation=null;return ports.restoreSnapshot(snapshot,options);},
    present:ports.present,layout,
    close,
  });
}

