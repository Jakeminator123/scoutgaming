import {mountPublishedScene} from '/published-scene.mjs';
import {validatePublicOperatorRooms} from '/operator-rooms-contract.mjs';
import {validatePublicOperatorPreview} from '/operator-preview-contract.mjs';
import {readChoices} from '/player-choices.mjs';

export async function mountRoomScene(room) {
  const host=document.getElementById('dealer-scene');
  const status=document.createElement('p'); status.role='status';status.textContent='Laddar rummets dealer…';
  const rules=document.getElementById('show-rules');
  document.querySelector('.table-tools').append(rules);
  host.className='published-scene';host.replaceChildren(status);
  let scene;
  try {
    const base='/api/operators/'+encodeURIComponent(room.operator);
    const get=async url=>{const res=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});if(!res.ok)throw Error('preview_unavailable');return res.json();};
    const [catalogValue,previewValue]=await Promise.all([
      get(base+'/rooms'),get(base+'/rooms/'+encodeURIComponent(room.id)+'/preview?'+new URLSearchParams({packageRevision:room.packageRevision,dealer:room.dealer})),
    ]);
    const catalog=validatePublicOperatorRooms(catalogValue,{operatorSlug:room.operator});
    const preview=validatePublicOperatorPreview(previewValue);
    if(catalog.packageRevision!==room.packageRevision||preview.roomId!==room.id||preview.dealer.id!==room.dealer||preview.packageRevision!==room.packageRevision) throw Error('preview_changed');
    const dealer=catalog.rooms.find(row=>row.id===room.id)?.dealers.find(row=>row.id===room.dealer);
    if(!dealer||!preview.media.dealer||preview.media.dealer.compositing&&!preview.independentLayers) throw Error('preview_unavailable');
    let choices={};try {choices=readChoices(localStorage,room.operator);} catch { /* Use published defaults. */ }
    const layer=(key,media)=>{
      const definition=dealer[key],preferred=choices[key==='table'?'tableAsset':key];
      const id=definition.allowed.some(row=>row.id===preferred)?preferred:definition.default;
      return preview.independentLayers&&definition.enabled?media.find(row=>row.id===id)??null:null;
    };
    const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1280;canvas.role='img';canvas.setAttribute('aria-label',preview.dealer.label+' i '+room.name);canvas.hidden=true;
    const caption=document.createElement('div');caption.className='scene-caption';caption.textContent=preview.dealer.label+' · '+room.operatorName;
    const toggle=document.createElement('button');toggle.className='secondary scene-controls';toggle.type='button';toggle.hidden=true;
    host.append(canvas,caption,toggle);
    scene=mountPublishedScene(canvas,{dealer:preview.media.dealer,table:layer('table',preview.media.tables),background:layer('background',preview.media.backgrounds),
      settings:preview.settings,compositing:preview.media.dealer.compositing,
      onReady:()=>{status.remove();canvas.hidden=false;toggle.hidden=false;},
      onFailure:()=>{canvas.hidden=true;toggle.hidden=true;status.textContent='Dealerscenen kunde inte visas. Spelet fungerar fortfarande.';host.prepend(status);},
      onPlaying:playing=>{toggle.textContent=playing?'Pausa dealer':'Spela dealer';toggle.setAttribute('aria-pressed',String(playing));},
    });
    toggle.addEventListener('click',()=>scene.toggle());
    window.addEventListener('pagehide',()=>scene.close(),{once:true});
  } catch {scene?.close();status.textContent='Dealerscenen är inte tillgänglig just nu. Spelet fungerar fortfarande.';}
}
