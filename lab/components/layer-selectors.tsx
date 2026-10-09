'use client';
import type {StudioLane, LayerAsset} from '../lib/studio-model.mjs';

export function LayerAssetSelect({role,lane,assets,onChange,permissions=true}:{role:'background'|'table';lane:StudioLane;assets:LayerAsset[];onChange:(lane:StudioLane)=>void;permissions?:boolean}) {
  const rows = assets.filter(asset=>asset.role===role), layer=lane.layers[role];
  const edit = (change:(next:StudioLane)=>void) => {const next=structuredClone(lane);change(next);onChange(next);};
  const title=role==='background'?'Bakgrund':'Bord';
  return <fieldset className="field"><legend>{title}</legend>
    <label>Standard<select value={layer.default??''} onChange={event=>edit(next=>{
      next.layers[role].default=event.target.value||null;
      if(event.target.value&&!next.layers[role].allowed.includes(event.target.value))next.layers[role].allowed.push(event.target.value);
      if(role==='background'&&!event.target.value)next.layers.background.mode='baked';
      if(role==='background'&&event.target.value)next.layers.background.mode=rows.find(row=>row.id===event.target.value)?.contentType.startsWith('video/')?'video':'image';
    })}><option value="">{role==='background'?'Inbakad / ingen separat bakgrund':'Inbakat / inget separat bord'}</option>
      {rows.filter(row=>permissions||layer.allowed.includes(row.id)).map(asset=><option key={asset.id} value={asset.id}>{asset.label} · {asset.contentType.startsWith('video/')?'Video':'Bild'} · {asset.width} × {asset.height}</option>)}
    </select></label>
    {!rows.length?<small>Ladda upp {title.toLowerCase()} i Sammansättning.</small>:null}
    {permissions?<details><summary>Tillåtna alternativ ({layer.allowed.length})</summary>{rows.map(asset=><label className="check-field" key={asset.id}>
      <input type="checkbox" checked={layer.allowed.includes(asset.id)} onChange={event=>edit(next=>{
        next.layers[role].allowed=event.target.checked?[...layer.allowed,asset.id]:layer.allowed.filter(id=>id!==asset.id);
        if(!event.target.checked&&next.layers[role].default===asset.id)next.layers[role].default=null;
      })}/>{asset.label}
    </label>)}</details>:null}
  </fieldset>;
}
