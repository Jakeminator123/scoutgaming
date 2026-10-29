import {useState} from 'react';
import {Layers} from 'lucide-react';
import type {LayerAsset,StudioLane} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import {desktopSceneStill,stillRectPercent} from '../../../../../../packages/presentation/runtime/scene-still.mjs';
import {suppliedDealerArtwork} from '../../lib/dealer-artwork.mjs';

const assetUrl=(id:string)=>'/studio/api/layer-assets/'+encodeURIComponent(id);
const imageAsset=(assets:LayerAsset[],id:string|null|undefined,role:LayerAsset['role'])=>{const asset=id?assets.find(row=>row.id===id&&row.role===role):undefined;return asset?.contentType.startsWith('image/')?asset:undefined;};

// An environment's card picture. Its miljöbild when it has one; else the real scene on a computer screen:
// the background cover-fitted and the table graphics at their saved placement, with the compositor's geometry
// (runtime/scene-still.mjs). For a background baked into the dealer film, the dealer's portrait; else a quiet
// placeholder that says no background is chosen. Decorative; the card names the environment.
export function SceneCover({lane,assets,dealer}:{lane:StudioLane;assets:LayerAsset[];dealer?:{id:string;label:string}}) {
  const [failed,setFailed]=useState<string[]>([]);
  const ok=(url:string|undefined)=>url&&!failed.includes(url)?url:undefined;
  const fail=(url:string)=>()=>setFailed(current=>[...current,url]);
  const picture=imageAsset(assets,lane.illustration,'illustration'),pictureUrl=ok(picture&&assetUrl(picture.id));
  const background=lane.layers.background.mode==='baked'?undefined:imageAsset(assets,lane.layers.background.default??lane.layers.background.allowed[0],'background');
  const table=imageAsset(assets,lane.layers.table.default??lane.layers.table.allowed[0],'table');
  const backgroundUrl=ok(background&&assetUrl(background.id)),tableUrl=ok(table&&assetUrl(table.id));
  const portrait=ok(dealer?suppliedDealerArtwork({id:dealer.id,name:dealer.label})?.image:undefined);
  const still=desktopSceneStill({composition:lane.composition,background:backgroundUrl?background:null,table:tableUrl?table:null});
  const place=(role:'background'|'table')=>{const layer=still.layers.find(row=>row.role===role);if(!layer)return undefined;const box=stillRectPercent(layer.rect);
    return {left:box.left+'%',top:box.top+'%',width:box.width+'%',height:box.height+'%'};};
  const caption=pictureUrl||backgroundUrl?null:lane.layers.background.mode==='baked'?'Bakgrund i dealerfilmen':'Ingen bakgrund vald';
  return <span aria-hidden="true" className="relative block aspect-[16/9] overflow-hidden bg-gradient-to-br from-sg-surface-2 to-sg-hover">
    {pictureUrl?<img src={pictureUrl} alt="" loading="lazy" data-cover="illustration" onError={fail(pictureUrl)} className="absolute inset-0 size-full object-cover transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"/>
      :<span className="absolute inset-0 transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
        {backgroundUrl&&<img src={backgroundUrl} alt="" loading="lazy" data-cover="background" onError={fail(backgroundUrl)} style={place('background')} className="absolute max-w-none"/>}
        {!backgroundUrl&&portrait&&<img src={portrait} alt="" loading="lazy" onError={fail(portrait)} className="absolute inset-0 size-full object-cover object-[50%_25%]"/>}
        {tableUrl&&<img src={tableUrl} alt="" loading="lazy" data-cover="table" onError={fail(tableUrl)} style={place('table')} className="absolute max-w-none"/>}
      </span>}
    {!pictureUrl&&!backgroundUrl&&!portrait&&!tableUrl&&<span className="absolute inset-0 grid place-items-center text-sg-faint"><Layers className="size-7" strokeWidth={1.4}/></span>}
    {caption&&<span className="absolute bottom-2 left-2 rounded-full bg-[rgba(15,16,18,.66)] px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur">{caption}</span>}
  </span>;
}
