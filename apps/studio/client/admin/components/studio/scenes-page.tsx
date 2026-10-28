import Link from '../../../runtime/navigation';
import {HubPage,Tabs,Card,Chip,Row,Empty,Note} from '../ui/hub';
import {adminSceneTabs} from '../../lib/admin-navigation';
import type {Workspace} from '../../lib/connected-studio.mjs';
import {RegisteredMaterialLibrary} from './registered-material-library';

type Head={part:'head';tab:string;workspace:Workspace|null};
type Tail={part:'tail';tab:string;visible:boolean;disabled:boolean;onChanged:()=>void;refreshKey:string};

// Scenmallar och material: the scene editor (one clip-map instance, mounted by entry.tsx under the
// head) and the material library per role. Papperskorgen is the library's own trash per role.
export function ScenesPage(props:Head|Tail) {
  if(props.part==='head'){
    const lanes=props.workspace?.project.lanes??[],assets=props.workspace?.project.layerAssets??[],trash=props.workspace?.project.layerAssetTrash?.length??0;
    const rooms=props.workspace?.catalog.administration.rooms.filter(room=>room.state!=='archived')??[];
    return <HubPage wide title="Scenmallar och material" intro="En scenmall placerar bakgrund, dealer och bordsgrafik för dator och mobil och säger vilka dealers och vilket material den tillåter. Materialet laddas upp här, på ett ställe."
      actions={props.tab==='mallar'?<Link className="hub-btn" href="/admin/companies?tab=spelbord">Spelbord som använder mallarna →</Link>:undefined}>
      <Tabs items={adminSceneTabs} active={props.tab} param="tab" counts={props.workspace?{mallar:lanes.length,bakgrunder:assets.filter(asset=>asset.role==='background').length,bordsgrafik:assets.filter(asset=>asset.role==='table').length,papperskorg:trash}:{}}/>
      {props.tab==='mallar'&&lanes.length>0&&<Card title="Scenmallar" aside="välj en mall i editorn nedan; bordsfärg visas inte" className="hub-mt" as="section">
        <div className="hub-rows">{lanes.map(lane=>{const used=rooms.filter(room=>room.compositionId===lane.id);return <Row key={lane.id} chip={<Chip tone={used.length?'ok':''}>{used.length?`${used.length} spelbord`:'oanvänd'}</Chip>} title={lane.label} text={`dealers: ${lane.layers.dealer.allowed.join(', ')||'inga'} · ${lane.renderer} · ${used.map(room=>room.name).join(', ')}`} href={`/admin/scenes?tab=mallar&composition=${encodeURIComponent(lane.id)}`}/>;})}</div>
      </Card>}
    </HubPage>;
  }
  const {tab,visible,disabled,onChanged,refreshKey}=props;
  return <div className="hub-page is-wide" style={{paddingTop:0}}>
    {(tab==='bakgrunder'||tab==='bordsgrafik')&&<RegisteredMaterialLibrary role={tab==='bakgrunder'?'background':'table'} base="/admin/scenes" visible={visible&&(tab==='bakgrunder'||tab==='bordsgrafik')} disabled={disabled} onChanged={onChanged} refreshKey={refreshKey}/>}
    {tab==='papperskorg'&&<div className="hub-stack hub-mt">
      <Note>Papperskorgen för material visas per flik längst ned under Bakgrunder respektive Bordsgrafik (samma layerAssetTrash); återställ går, permanent radering är ett eget steg. Arkiverade dealers ligger under Dealers.</Note>
      <div className="hub-grid c2"><Card title="Bakgrunder"><Link className="hub-btn" href="/admin/scenes?tab=bakgrunder#material-trash">Öppna papperskorgen för bakgrunder</Link></Card><Card title="Bordsgrafik"><Link className="hub-btn" href="/admin/scenes?tab=bordsgrafik#material-trash">Öppna papperskorgen för bordsgrafik</Link></Card></div>
      <Empty chip={null} title="Arkiverade scenmallar" text="Scenmallar har ingen papperskorg i projektet; en mall tas bort när inget spelbord använder den."/>
    </div>}
  </div>;
}
