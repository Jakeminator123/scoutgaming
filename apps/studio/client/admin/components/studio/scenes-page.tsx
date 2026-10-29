import {ArrowRight} from 'lucide-react';
import Link from '../../../runtime/navigation';
import {HubPage,Tabs,Card,Chip,Row,Note,pageClass} from '../ui/hub';
import {buttonVariants,cn,focusRing,plural} from '../ui/kit';
import {adminSceneTabs} from '../../lib/admin-navigation';
import type {Workspace} from '../../lib/connected-studio.mjs';
import {RegisteredMaterialLibrary} from './registered-material-library';
import {DealerFaces} from './dealer-identity-portrait';
import {SceneCover} from './scene-cover';
import {CompositionPermanentDelete} from './permanent-delete';

type Head={part:'head';tab:string;workspace:Workspace|null};
type Tail={part:'tail';tab:string;visible:boolean;disabled:boolean;onChanged:()=>void;refreshKey:string};

// Miljöer och material: the scene editor (one clip-map instance, mounted by entry.tsx under the
// head) and the material library per role. Papperskorgen is the library's own trash per role.
export function ScenesPage(props:Head|Tail) {
  if(props.part==='head'){
    const lanes=props.workspace?.project.lanes??[],assets=props.workspace?.project.layerAssets??[],trash=props.workspace?.project.layerAssetTrash?.length??0;
    const rooms=props.workspace?.catalog.administration.rooms.filter(room=>room.state!=='archived')??[];
    const dealerOf=(id:string)=>({id,label:props.workspace?.project.dealers.find(row=>row.id===id)?.label??'Okänd dealer'});
    return <HubPage wide continued title="Miljöer och material" intro="En miljö placerar bakgrund, dealer och bordsgrafik för dator och mobil och säger vilka dealers och vilket material den tillåter. Materialet laddas upp här, på ett ställe."
      actions={props.tab==='mallar'?<Link className={buttonVariants()} href="/admin/companies?tab=spelbord">Spelbord som använder miljöerna<ArrowRight aria-hidden="true"/></Link>:undefined}>
      <Tabs items={adminSceneTabs} active={props.tab} param="tab" counts={props.workspace?{mallar:lanes.length,bakgrunder:assets.filter(asset=>asset.role==='background').length,bordsgrafik:assets.filter(asset=>asset.role==='table').length,papperskorg:trash}:{}}/>
      {props.tab==='mallar'&&lanes.length>0&&<div className="mb-5 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3" role="list" aria-label="Miljöer">{lanes.map(lane=>{const used=rooms.filter(room=>room.compositionId===lane.id);const dealers=lane.layers.dealer.allowed.map(dealerOf);
        return <Link key={lane.id} role="listitem" href={`/admin/scenes?tab=mallar&composition=${encodeURIComponent(lane.id)}`} className={cn('group grid overflow-hidden rounded-xl border border-sg-border bg-sg-surface text-sg-text no-underline shadow-sg transition-[box-shadow,border-color] duration-200 hover:border-sg-faint hover:shadow-md motion-reduce:transition-none',focusRing)}>
          <SceneCover lane={lane} assets={assets} dealer={dealers.find(row=>row.id===lane.layers.dealer.default)??dealers[0]}/>
          <span className="grid gap-2 p-4">
            <span className="flex items-center justify-between gap-2"><span className="truncate font-semibold group-hover:underline">{lane.label}</span><Chip tone={used.length?'ok':''}>{used.length?plural(used.length,'spelbord','spelbord'):'oanvänd'}</Chip></span>
            <span className="text-[12.5px] text-sg-muted"><DealerFaces dealers={dealers} empty="Inga dealers ännu"/></span>
            {used.length>0&&<span className="truncate text-xs text-sg-faint">Används av {used.map(room=>room.name).join(', ')}</span>}
          </span>
        </Link>;})}</div>}
    </HubPage>;
  }
  const {tab,visible,disabled,onChanged,refreshKey}=props;
  return <div className={cn(pageClass,'max-w-none pt-0')}>
    {(tab==='bakgrunder'||tab==='bordsgrafik')&&<RegisteredMaterialLibrary role={tab==='bakgrunder'?'background':'table'} base="/admin/scenes" visible={visible&&(tab==='bakgrunder'||tab==='bordsgrafik')} disabled={disabled} onChanged={onChanged} refreshKey={refreshKey}/>}
    {tab==='papperskorg'&&<div className="mt-3 grid gap-4">
      <Note>Material i papperskorgen kan återställas; permanent radering är ett eget steg. Arkiverade dealers finns under Dealers.</Note>
      <RegisteredMaterialLibrary role="background" base="/admin/scenes" visible={visible} disabled={disabled} onChanged={onChanged} refreshKey={refreshKey} trashOnly/>
      <RegisteredMaterialLibrary role="table" base="/admin/scenes" visible={visible} disabled={disabled} onChanged={onChanged} refreshKey={refreshKey} trashOnly/>
      <CompositionPermanentDelete disabled={disabled} onChanged={onChanged}/>
    </div>}
  </div>;
}
