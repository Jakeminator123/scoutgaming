import {mountPublishedScene} from '/published-scene.mjs';
import {validatePublicOperatorRooms} from '/operator-rooms-contract.mjs';
import {validatePublicOperatorPreview} from '/operator-preview-contract.mjs';
import {readChoices} from '/player-choices.mjs';
import {ROULETTE_TABLE,ROULETTE_TABLE_MASK,rouletteSceneSettings} from './media.mjs';

export async function mountRoomScene(room) {
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
  let scene,closed=false;
  const close=()=>{closed=true;controller.abort();scene?.close();};
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
    const publishedDealer=catalog.rooms.find(row=>row.id===room.id)?.dealers.find(row=>row.id===room.dealer);
    if(!publishedDealer)throw Error('preview_unavailable');
    let choices={};try{choices=readChoices(localStorage,room.operator);}catch{/* Published defaults remain authoritative. */}
    const definition=publishedDealer.background;
    const backgroundId=definition.allowed.some(row=>row.id===choices.background)?choices.background:definition.default;
    const background=preview.independentLayers&&definition.enabled?preview.media.backgrounds.find(row=>row.id===backgroundId)??null:null;
    // A baked legacy scene cannot be placed behind a different game table.
    // No guessed dealer, crop or media URL: wait for a published separable take.
    const dealer=preview.independentLayers&&preview.media.dealer?.compositing?preview.media.dealer:null;
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
    canvas.role='img';canvas.setAttribute('aria-label','Roulettebord'+(dealer?' med '+preview.dealer.label:'')+' i '+room.name);canvas.hidden=true;
    host.append(canvas);
    scene=mountPublishedScene(canvas,{dealer,background,table:ROULETTE_TABLE,tableMask:ROULETTE_TABLE_MASK,
      settings:rouletteSceneSettings(preview.settings),layout:'desktop',compositing:dealer?.compositing,
      onReady:()=>{
        fallback.hidden=true;canvas.hidden=false;
        mediaMessage(dealer?'':'En frilagd dealer för det här bordet saknas. Du kan spela ändå.');
        document.getElementById('scene-caption').textContent=dealer?preview.dealer.label+' · '+room.operatorName:'Europeisk roulette · '+room.operatorName;
        toggle.hidden=![dealer,background,ROULETTE_TABLE].some(source=>source?.contentType.startsWith('video/'));
      },
      onFailure:()=>{fallback.hidden=false;canvas.hidden=true;toggle.hidden=true;mediaMessage('Rummets media kunde inte visas. Bordet och spelet är fortfarande tillgängliga.');},
      onPlaying:playing=>{toggle.textContent=playing?'Pausa video':'Spela video';toggle.setAttribute('aria-pressed',String(playing));},
    });
    toggle.addEventListener('click',()=>scene.toggle(),{signal:controller.signal});
  }catch{scene?.close();if(!closed)mediaMessage('Rummets media är inte tillgängliga just nu. Du kan spela vid bordet ändå.');}
}
