import { createLayerComposition } from '../../../packages/presentation/runtime/presentation-composition.mjs';
import { layoutGameOverlay, BLACKJACK_COMPACT_QUERY } from '../../../packages/presentation/runtime/game-overlay-layout.mjs';
import { calibration } from '../../../packages/presentation/contracts/calibration.mjs';
import { registeredFilmedProfile } from './dealer-filmed-profiles.mjs';

// K04's public instructions are rendered through the existing exact media/card ports.
// A reconnect restores authoritative cards and consumes its historical presentation.
export function createSharedRoomPresentationPorts({ media, cards, composition = null, clock = Date.now, onError = () => {}, onPresentation = () => {}, mediaStallTimeoutMs = 30000 }) {
  if (!Number.isSafeInteger(mediaStallTimeoutMs) || mediaStallTimeoutMs < 1 || mediaStallTimeoutMs > 30000) throw new TypeError('shared_room_invalid_media_timeout');
  let state, previousSignal, restoredThrough = 0, offset = 0, closed = false, abortMedia, cancelCurrentClip;
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
      media.prepareSequence?.([...presentation.events]);
      media.state({action:true,speech:false});
      void Promise.resolve(media.observeEvents?.([...presentation.events],{signal})).catch(()=>onError('shared_room_media_unavailable'));
      let completedSequence=false;
      try {
        for(const event of presentation.events){
          signal?.throwIfAborted();if(closed)return;
          if(event.type==='idle'||event.type==='turn'||event.type==='settle')continue;
          composition?.backgroundEvent?.(event.type==='speak'?'speak.'+event.line:event.type,`${presentation.talkId}:${presentation.ver}:${event.shoeDraw??event.line}`);
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
            completed=await Promise.race([stalled,Promise.resolve().then(()=>{clip.signal.throwIfAborted();return media.present(event,{signal:clip.signal,onProgress:progress,
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
  if(!host||!dealer||selection.localDealer!==dealer.id)throw new Error('shared_room_presentation_binding_missing');
  signal?.throwIfAborted();
  const [{PerformancePlayer},{createLocalPresentation},{createLocalCardOverlay}]=await loadAdapters();
  signal?.throwIfAborted();
  const composition=createComposition(document,selection.composition);
  let player;
  let media,cards,version=0,muted=true,lastLayout,currentPresentation,currentConnection;
  const sound=document.getElementById('sound-btn');
  const onSound=()=>{muted=!muted;paintSound();media?.state({});};
  const paintSound=()=>{if(sound){sound.textContent=muted?'🔇':'🔊';sound.setAttribute('aria-label',muted?'Slå på dealerljud':'Stäng av dealerljud');sound.setAttribute('aria-pressed',String(!muted));}};
  try {
    player=new PerformancePlayer({host});
    const request=(url,options={})=>{
      if(url==='/api/presentation/select'){
        if(!currentPresentation||currentPresentation.ver!==version)throw new Error('shared_room_media_authority_unavailable');
        const body=JSON.parse(options.body);
        if(body.version!==currentPresentation.ver)throw new Error('shared_room_media_authority_unavailable');
        options={...options,body:JSON.stringify({...body,sharedRoom:{roomId:currentPresentation.roomId,ver:currentPresentation.ver,talkId:currentPresentation.talkId}})};
      }
      const requestPort=transport?.request??window.fetch.bind(window);
      return requestPort(url,{...options,credentials:'same-origin',mode:'same-origin',redirect:'error',
        signal:AbortSignal.any([signal,currentConnection,options.signal,AbortSignal.timeout(10000)].filter(Boolean))});
    };
    media=await createLocalPresentation({player,host,dealerId:dealer.id,entry:selection,version:()=>version,
      muted:()=>muted,composition,transport:{request},receipt:()=>{},onIdle:()=>onReady(dealer.id),onBusy:()=>{},onError:()=>onError('shared_room_media_unavailable')});
    signal?.throwIfAborted();
    cards=createLocalCardOverlay(host,{dealerLabel:dealer.label,filmedProfile:registeredFilmedProfile(dealer.id)});
  } catch(error){media?.close();cards?.close();player?.dispose();composition?.close();throw error;}
  const ports=createSharedRoomPresentationPorts({media,cards,composition,onError,onPresentation:value=>{currentPresentation=value;}});
  function layout(value=lastLayout){
    if(!value)return;lastLayout=value;
    const scene=host.getBoundingClientRect(),table=document.getElementById('table2d').getBoundingClientRect();
    const plane=composition?.referencePlane(),compact=window.matchMedia?.(BLACKJACK_COMPACT_QUERY).matches;
    const active=value.snapshot.round?.hands?.[value.snapshot.round.active]?.box;
    const centre=Number.isInteger(active)?active:value.focusSeat??value.snapshot.me.seats[0]??3;
    const boxes=compact?Array.from({length:3},(_,i)=>Math.max(0,Math.min(4,centre-1))+i):[0,1,2,3,4,5,6];
    const width=scene.width,height=scene.height;
    let projected;
    if(plane)projected=layoutGameOverlay(plane,boxes,{left:12,right:width-12,top:80,bottom:height-150},{compact,cardView:'raised'});
    else {
      // Existing calibrated film plane; no replacement board or dealer is selected here.
      const scale=Math.min(width/1080,height/1920),x=(width-1080*scale)/2,y=(height-1920*scale)/2;
      projected={x,y,scale,positions:calibration.positions,offsets:{},cardView:'raised',followCards:true,boxes,
        seats:boxes.map(box=>({box,x:x+calibration.positions[String(box+1)].cx*scale,y:y+calibration.positions[String(box+1)].cy*scale})),controlScale:Math.max(.65,scale)};
    }
    for(const [i,node] of value.seats.entries())node.hidden=!boxes.includes(i);
    for(const item of projected.seats){const node=value.seats[item.box];Object.assign(node.style,{left:(scene.left+item.x-table.left)+'px',top:(scene.top+item.y-table.top)+'px'});node.style.setProperty('--game-seat-scale',String(projected.controlScale));}
    cards.setProjection(projected,width,height);
  }
  const unGeometry=composition?.onGeometryChange(layout);
  const resize=()=>layout();window.addEventListener('resize',resize);sound?.addEventListener('click',onSound);paintSound();
  media.start();
  return Object.freeze({
    restoreSnapshot(snapshot,options){currentConnection=options?.signal;version=snapshot.presentationVer;if(currentPresentation?.ver!==version)currentPresentation=null;return ports.restoreSnapshot(snapshot,options);},
    present:ports.present,layout,
    close(){window.removeEventListener('resize',resize);sound?.removeEventListener('click',onSound);unGeometry?.();ports.close();player.dispose();},
  });
}
