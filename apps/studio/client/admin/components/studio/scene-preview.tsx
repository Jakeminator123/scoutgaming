import {useEffect,useState} from 'react';
import Link from '../../../runtime/navigation';
import {Empty,Note} from '../ui/hub';
import {Loading} from '../ui/kit';
import {CompositionPreview} from '../../../../components/composition-preview';
import {useScenePreviewMedia} from '../../lib/scene-preview-media.mjs';
import type {StudioProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import type {VideoInventory} from '../../lib/connected-studio.mjs';
import {SavedScenePreview} from './saved-scene-preview';

type SavedStudio={project:StudioProject;inventory:VideoInventory};
type Load={status:'idle'|'loading'|'error'}|{status:'ready';value:SavedStudio};

// The saved project and the video register, read once while the preview is open (pages that already hold
// them pass `saved`). Read only; nothing is written.
function useSavedStudio(active:boolean,saved:SavedStudio|null|undefined):Load {
  const [state,setState]=useState<Load>({status:'idle'});
  const given=Boolean(saved);
  useEffect(()=>{
    if(!active||given)return;
    const controller=new AbortController();setState({status:'loading'});
    const read=(path:string)=>fetch(path,{credentials:'same-origin',cache:'no-store',redirect:'error',headers:{accept:'application/json'},signal:controller.signal})
      .then(response=>{if(!response.ok)throw Error(path);return response.json();});
    void Promise.all([read('/studio/api/project'),read('/studio/api/videos')]).then(([project,inventory])=>{
      if(!project?.project||!Array.isArray(inventory?.videos))throw Error('shape');
      if(!controller.signal.aborted)setState({status:'ready',value:{project:project.project,inventory}});
    }).catch(()=>{if(!controller.signal.aborted)setState({status:'error'});});
    return()=>controller.abort();
  },[active,given]);
  return saved?{status:'ready',value:saved}:state;
}

/** The saved scene template drawn in the browser: the dealer's idle looping over the template's background and
 * table graphics with the template's own layer automation (as in the scene template editor), without the game
 * engine, a published package or a session. Missing media is said as it is.
 * "Provspela sparad scen" (the real game against the saved revision) stays below as the secondary action. */
export function ScenePreview({active,laneId,dealerId,game='blackjack',revision,saved}:{active:boolean;laneId:string;dealerId?:string;game?:string;revision?:string;saved?:SavedStudio|null}) {
  const studio=useSavedStudio(active,saved);
  const value=studio.status==='ready'?studio.value:null;
  const lane=value?.project.lanes?.find(row=>row.id===laneId);
  const scene=useScenePreviewMedia({project:value?.project,inventory:value?.inventory,lane,game,dealerId});
  const shown=scene.dealer||scene.background||scene.table;
  const dealerHref=`/admin/dealers/${encodeURIComponent(scene.dealerId||dealerId||'')}?flik=klipp${game==='roulette'?'&game=roulette':''}`;
  const clipAssets=(role:'background'|'table')=>lane?(value?.project.layerAssets??[]).filter(row=>row.role===role&&lane.layers[role].allowed.includes(row.id))
    .map(row=>({id:row.id,url:'/studio/api/layer-assets/'+row.id,label:row.label,contentType:row.contentType})):[];
  const templateHref=`/admin/scenes?tab=mallar&composition=${encodeURIComponent(laneId)}`;
  return <div className="grid gap-4">
    {(studio.status==='idle'||studio.status==='loading')&&<Loading label="Läser den sparade scenen…" rows={4}/>}
    {studio.status==='error'&&<Empty chip={null} title="Den sparade scenen kunde inte läsas" text="Projektet eller klippregistret svarade inte. Stäng förhandsvisningen och öppna den igen."/>}
    {value&&!lane&&<Empty chip={null} title="Scenmallen finns inte i det sparade projektet"/>}
    {value&&lane&&<>
      {shown?<CompositionPreview key={laneId+':'+scene.dealerId} minimal autoplay loopDealer dealer={scene.dealer} background={scene.background} table={scene.table}
        settings={scene.settings} layout="desktop" show={{dealer:true,background:true,table:true}} compositing={scene.compositing} framing={scene.framing}
        backgroundPlayback={scene.backgroundId!==lane.layers.background.default?undefined:lane.backgroundPlayback} backgroundAssets={clipAssets('background')}
        tablePlayback={game==='blackjack'&&scene.tableAsset?.id!==lane.layers.table.default?undefined:lane.tablePlayback} tableAssets={clipAssets('table')}/>
        :<Empty chip={null} title="Scenen har inget att visa" text="Dealern saknar viloklipp och mallen saknar både bakgrund och bordsgrafik."/>}
      {dealerId&&scene.dealerId!==dealerId&&<Note tone="warn">Den sparade scenmallen tillåter inte den här dealern. Förhandsvisningen visar mallens förvalda dealer.</Note>}
      {!scene.dealer&&<Note tone="warn">Dealern saknar viloklipp. Koppla vilan i <Link href={dealerHref} className="font-semibold text-inherit">dealerns klippkarta</Link>, så syns dealern här.</Note>}
      {!scene.background&&<Note tone="warn">Mallen saknar bakgrund. Välj en i <Link href={templateHref} className="font-semibold text-inherit">scenmallen</Link>.</Note>}
    </>}
    <div className="border-t border-sg-line-2 pt-4">
      <h3 className="m-0 mb-1 text-[13.5px] font-semibold">Provspela med spelmotorn</h3>
      <p className="mb-3 mt-0 text-[12.5px] text-sg-muted">{game==='blackjack'?'Startar Blackjack med testsaldo i den sparade scenen. Kräver att spelmotorn är igång.':'Provspelning med spelmotorn finns bara för Blackjack än så länge.'}</p>
      <SavedScenePreview active={active} presentationLaneId={laneId} revision={revision} dealerId={dealerId} game={game}/>
    </div>
  </div>;
}
