import {useState} from 'react';
import {Layers} from 'lucide-react';
import type {LayerAsset,StudioLane} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import {suppliedDealerArtwork} from '../../lib/dealer-artwork.mjs';

const assetUrl=(id:string)=>'/studio/api/layer-assets/'+encodeURIComponent(id);
const imageAsset=(assets:LayerAsset[],id:string|null|undefined)=>{const asset=id?assets.find(row=>row.id===id):undefined;return asset?.contentType.startsWith('image/')?asset:undefined;};

// A scene template's card picture from what the template actually selects: its background image with
// the table graphics over the lower part; for a background baked into the dealer film, the dealer's
// portrait; else a quiet placeholder that says no background is chosen. Decorative; the card names the template.
export function SceneCover({lane,assets,dealer}:{lane:StudioLane;assets:LayerAsset[];dealer?:{id:string;label:string}}) {
  const [failed,setFailed]=useState<string[]>([]);
  const ok=(url:string|undefined)=>url&&!failed.includes(url)?url:undefined;
  const fail=(url:string)=>()=>setFailed(current=>[...current,url]);
  const background=lane.layers.background.mode==='baked'?undefined:imageAsset(assets,lane.layers.background.default??lane.layers.background.allowed[0]);
  const table=imageAsset(assets,lane.layers.table.default??lane.layers.table.allowed[0]);
  const backgroundUrl=ok(background&&assetUrl(background.id)),tableUrl=ok(table&&assetUrl(table.id));
  const portrait=ok(dealer?suppliedDealerArtwork({id:dealer.id,name:dealer.label})?.image:undefined);
  const caption=backgroundUrl?null:lane.layers.background.mode==='baked'?'Miljön i dealerfilmen':'Ingen bakgrund vald';
  return <span aria-hidden="true" className="relative block aspect-[16/9] overflow-hidden bg-gradient-to-br from-sg-surface-2 to-sg-hover">
    {backgroundUrl&&<img src={backgroundUrl} alt="" loading="lazy" onError={fail(backgroundUrl)} className="absolute inset-0 size-full object-cover transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"/>}
    {!backgroundUrl&&portrait&&<img src={portrait} alt="" loading="lazy" onError={fail(portrait)} className="absolute inset-0 size-full object-cover object-[50%_25%]"/>}
    {tableUrl&&<img src={tableUrl} alt="" loading="lazy" onError={fail(tableUrl)} className="absolute inset-x-0 bottom-0 h-1/2 w-full object-contain object-bottom"/>}
    {!backgroundUrl&&!portrait&&!tableUrl&&<span className="absolute inset-0 grid place-items-center text-sg-faint"><Layers className="size-7" strokeWidth={1.4}/></span>}
    {caption&&<span className="absolute bottom-2 left-2 rounded-full bg-[rgba(15,16,18,.66)] px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur">{caption}</span>}
  </span>;
}
