'use client';
import type {StudioLane, LayerAsset} from '../../../packages/presentation/contracts/studio-model.mjs';
import {layerAssetFitsGame} from '../../../packages/presentation/contracts/layer-asset-contract.mjs';
import {retainBlackjackTableGeometry} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {aiTableFitsTemplate} from '../client/admin/lib/ai-background.mjs';

export function LayerAssetSelect({role,lane,assets,onChange,permissions=true,game='blackjack'}:{role:'background'|'table';lane:StudioLane;assets:LayerAsset[];onChange:(lane:StudioLane)=>void;permissions?:boolean;game?:'blackjack'|'roulette'}) {
  const rows = assets.filter(asset=>asset.role===role&&layerAssetFitsGame(asset,game)), layer=lane.layers[role];
  const mismatched=role==='table'?[...new Set([...layer.allowed,...(layer.default?[layer.default]:[])])].filter(id=>!rows.some(row=>row.id===id)):[];
  // A base or clip referenced by this layer's playback rules cannot be un-allowed from here; remove the rule first.
  const backgroundRules=(role==='background'?lane.backgroundPlayback:lane.tablePlayback)?.rules??[];
  const inUse=(id:string)=>backgroundRules.length>0&&(layer.default===id||backgroundRules.some(rule=>rule.assetId===id));
  const edit = (change:(next:StudioLane)=>void) => {const next=structuredClone(lane);change(next);retainBlackjackTableGeometry(next.composition,next.layers.table.allowed);onChange(next);};
  // An AI table graphic is drawn for one dealer and placement; it cannot be newly chosen in another template.
  const misfit=(id:string|null)=>{const asset=role==='table'?rows.find(row=>row.id===id):undefined,fit=asset?aiTableFitsTemplate(asset,lane):{ok:true as const};return fit.ok?'':fit.reason;};
  const misfits=role==='table'?rows.filter(row=>(layer.allowed.includes(row.id)||layer.default===row.id)&&misfit(row.id)):[];
  const title=role==='background'?'Bakgrund':'Bord';
  return <fieldset className="field"><legend>{title}</legend>
    {misfits.map(asset=><p role="alert" key={'misfit-'+asset.id}>{asset.label}: {misfit(asset.id)}</p>)}
    {mismatched.length>0?<p role="alert">Miljön innehåller {mismatched.length} bord som inte passar {game==='roulette'?'Roulette':'Blackjack'}. {permissions?<button type="button" onClick={()=>edit(next=>{next.layers.table.allowed=layer.allowed.filter(id=>!mismatched.includes(id));if(next.layers.table.default&&mismatched.includes(next.layers.table.default))next.layers.table.default=null;})}>Ta bort dessa val ur miljön</button>:null}</p>:null}
    <label>{role==='background'?'Standard · bild eller videoloop':'Standard · bild eller scenloop'}<select value={rows.some(row=>row.id===layer.default)?layer.default??'':''} onChange={event=>{if(backgroundRules.length&&!event.target.value)return;if(event.target.value&&!rows.some(row=>row.id===event.target.value))return;if(event.target.value!==layer.default&&misfit(event.target.value))return;edit(next=>{
      next.layers[role].default=event.target.value||null;
      if(event.target.value&&!next.layers[role].allowed.includes(event.target.value))next.layers[role].allowed.push(event.target.value);
      if(role==='background'&&!event.target.value)next.layers.background.mode='baked';
      if(role==='background'&&event.target.value)next.layers.background.mode=rows.find(row=>row.id===event.target.value)?.contentType.startsWith('video/')?'video':'image';
    });}}><option value="" disabled={backgroundRules.length>0}>{role==='background'?'Ingen separat bakgrund':'Inget separat bord'}</option>
      {rows.filter(row=>permissions||layer.allowed.includes(row.id)).map(asset=><option key={asset.id} value={asset.id} disabled={asset.id!==layer.default&&Boolean(misfit(asset.id))}>{asset.label} · {asset.contentType.startsWith('video/')?'Video':'Bild'} · {asset.width} × {asset.height}{misfit(asset.id)?' · passar inte miljön':''}</option>)}
    </select></label>
    {!rows.length?<small>Ladda upp {title.toLowerCase()} i Miljö.</small>:null}
    {permissions?<fieldset><legend>Tillåtna {role==='background'?'bakgrunder':'bord'} ({layer.allowed.length})</legend>{rows.map(asset=><label className="check-field" key={asset.id}>
      <input type="checkbox" checked={layer.allowed.includes(asset.id)} disabled={inUse(asset.id)||!layer.allowed.includes(asset.id)&&Boolean(misfit(asset.id))} onChange={event=>{if(inUse(asset.id)||event.target.checked&&misfit(asset.id))return;edit(next=>{
        next.layers[role].allowed=event.target.checked?[...layer.allowed,asset.id]:layer.allowed.filter(id=>id!==asset.id);
        if(!event.target.checked&&next.layers[role].default===asset.id)next.layers[role].default=null;
      });}}/>{asset.label}{misfit(asset.id)&&!layer.allowed.includes(asset.id)?' · passar inte miljön':''}{inUse(asset.id)?(role==='background'?' · används av bakgrundsklipp':' · används av bordsklipp'):''}{role==='table'&&lane.composition?.blackjackTables?.some(row=>row.tableId===asset.id)?' · avmarkering tar också bort bordets kortplatser':''}
    </label>)}<small>{role==='background'?'En videobakgrund loopas under spelet.':'Bordsvideo är en scenloop.'+(game==='roulette'?' Anna-bordets hjul och kula ritas i spelet; vinnande nummer kommer från spelservern.':'')} Partnern kan bara välja publicerade alternativ som bolaget får ändra.</small></fieldset>:null}
  </fieldset>;
}
