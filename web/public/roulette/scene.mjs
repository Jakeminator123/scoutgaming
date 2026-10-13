import {mountPublishedScene} from '/published-scene.mjs';
import {validatePublicOperatorRooms} from '/operator-rooms-contract.mjs';
import {validatePublicOperatorPreview} from '/operator-preview-contract.mjs';
import {readChoices} from '/player-choices.mjs';
import {ROULETTE_TABLE,ROULETTE_TABLE_MASK,rouletteSceneSettings} from './media.mjs';
import {mountRouletteWheel} from './wheel.mjs';

export async function mountRoomScene(room,{onTable=()=>{},onDealerClip=()=>{}}={}) {
  const host=document.getElementById('dealer-scene');
  const status=document.getElementById('scene-status');
  const toggle=document.getElementById('scene-toggle');
  const fallback=document.getElementById('scene-fallback');
  const mediaMessage=text=>{
    status.textContent=text;
    const more=document.getElementById('show-more');
    more.classList.toggle('has-media-note',Boolean(text));
    more.setAttribute('aria-label',text?'Mer, rumsinformation finns':'Mer');
  };
  const controller=new AbortController();
  let scene,wheel,lastOutcome,closed=false;
  let readyTimer,resolveReady;
  const ready=new Promise(resolve=>{resolveReady=resolve;});
  const finishReady=value=>{clearTimeout(readyTimer);resolveReady(value);};
  readyTimer=setTimeout(()=>finishReady(false),20000);
  const close=()=>{closed=true;finishReady(false);controller.abort();wheel?.close();scene?.close();};
  window.addEventListener('pagehide',close,{once:true});
  try {
    const base='/api/operators/'+encodeURIComponent(room.operator);
    const get=async url=>{const res=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])});if(!res.ok)throw Error('preview_unavailable');return res.json();};
    const [catalogValue,previewValue]=await Promise.all([
      get(base+'/rooms'),get(base+'/rooms/'+encodeURIComponent(room.id)+'/preview?'+new URLSearchParams({revision:room.packageRevision,dealer:room.dealer})),
    ]);
    if(closed)return;
    const catalog=validatePublicOperatorRooms(catalogValue,{operatorSlug:room.operator});
    const preview=validatePublicOperatorPreview(previewValue,{operatorSlug:room.operator,roomId:room.id,packageRevision:room.packageRevision,dealerId:room.dealer});
    if(catalog.packageRevision!==room.packageRevision)throw Error('preview_changed');
    const publishedRoom=catalog.rooms.find(row=>row.id===room.id);
    const publishedDealer=publishedRoom?.dealers.find(row=>row.id===room.dealer);
    if(publishedRoom?.game!=='roulette'||!publishedDealer)throw Error('preview_unavailable');
    let choices={};try{choices=readChoices(localStorage,room.operator);}catch{/* Published defaults remain authoritative. */}
    const definition=publishedDealer.background;
    const backgroundId=definition.allowed.some(row=>row.id===choices.background)?choices.background:definition.default;
    const background=preview.independentLayers&&definition.enabled?preview.media.backgrounds.find(row=>row.id===backgroundId)??null:null;
    // Both the room grants and the server's game-filtered preview must contain
    // a table. Stale/foreign browser choices never become media URLs.
    const tableDefinition=publishedDealer.table;
    const tableIds=[choices.tableAsset,tableDefinition.default,...tableDefinition.allowed.map(row=>row.id)];
    const publishedTable=preview.independentLayers&&tableDefinition.enabled
      ? tableIds.filter(id=>tableDefinition.allowed.some(row=>row.id===id))
        .map(id=>preview.media.tables.find(row=>row.id===id)).find(Boolean)??null : null;
    const table=publishedTable??ROULETTE_TABLE;
    const settings=publishedTable?preview.settings:rouletteSceneSettings(preview.settings);
    // A baked legacy scene cannot be placed behind a different game table.
    // No guessed dealer, crop or media URL: wait for a published separable take.
    const rawDealer=preview.independentLayers&&preview.media.dealer?.compositing?preview.media.dealer:null;
    const dealer=rawDealer?{...rawDealer,wheelStart:rawDealer.wheelStart?.tableDesignId===publishedTable?.designId?rawDealer.wheelStart:undefined}:null;
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
    canvas.role='img';canvas.setAttribute('aria-label','Roulettebord'+(dealer?' med '+preview.dealer.label:'')+' i '+room.name);canvas.hidden=true;
    host.append(canvas);
    scene=mountPublishedScene(canvas,{dealer,background,table,tableMask:publishedTable?null:ROULETTE_TABLE_MASK,
      settings,layout:'desktop',compositing:dealer?.compositing,onDealerClip,
      onReady:()=>{
        if(closed)return;
        fallback.hidden=true;canvas.hidden=false;
        onTable({designId:publishedTable?(publishedTable.designId??'unknown'):null,placement:settings.desktop.table});
        wheel?.close();
        wheel=mountRouletteWheel(host,{designId:publishedTable?.designId,placement:settings.desktop.table});
        if(lastOutcome)wheel?.showOutcome(lastOutcome.number,lastOutcome.roundId);
        finishReady(true);
        mediaMessage(dealer?'':'En frilagd dealer för det här bordet saknas. Du kan spela ändå.');
        document.getElementById('scene-caption').textContent=dealer?preview.dealer.label+' · '+room.operatorName:'Europeisk roulette · '+room.operatorName;
        toggle.hidden=![dealer,background,table].some(source=>source?.contentType.startsWith('video/'));
      },
      onFailure:()=>{finishReady(false);wheel?.close();wheel=null;fallback.hidden=false;canvas.hidden=true;toggle.hidden=true;onTable();mediaMessage('Rummets media kunde inte visas. Bordet och spelet är fortfarande tillgängliga.');},
      onPlaying:playing=>{toggle.textContent=playing?'Pausa video':'Spela video';toggle.setAttribute('aria-pressed',String(playing));},
    });
    toggle.addEventListener('click',()=>scene.toggle(),{signal:controller.signal});
    return {toggle:()=>scene.toggle(),setRoundActive:value=>scene.setRoundActive(value),close,
      showOutcome(number,roundId){lastOutcome={number,roundId};wheel?.showOutcome(number,roundId);},
      async playRound(number,roundId){
        const loaded=await ready;lastOutcome={number,roundId};if(!loaded||closed)return;
        const start=dealer?.wheelStart;
        if(!start||!wheel||!scene.playWheelStart){await wheel?.play(number,roundId);return;}
        let videoTime=0,continuedAt=null,spinning;
        const clock=()=>Math.max(0,videoTime-start.wheelImpulseMs)+(continuedAt===null?0:performance.now()-continuedAt);
        await scene.playWheelStart({onFrame:ms=>{
          videoTime=ms;
          if(!spinning&&ms>=start.wheelImpulseMs)spinning=wheel.play(number,roundId,{clock,ballDelayMs:start.ballReleaseMs-start.wheelImpulseMs});
        }});
        continuedAt=performance.now();
        if(closed)return;
        await (spinning??wheel.play(number,roundId));
      }};
  }catch{finishReady(false);wheel?.close();scene?.close();if(!closed)mediaMessage('Rummets media är inte tillgängliga just nu. Du kan spela vid bordet ändå.');}
}
