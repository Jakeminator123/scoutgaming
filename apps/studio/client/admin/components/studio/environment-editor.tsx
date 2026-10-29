import {ArrowLeft} from 'lucide-react';
import Link,{navigate} from '../../../runtime/navigation';
import {HubPage,Empty,Note} from '../ui/hub';
import {Badge,Button,Card,Loading,buttonVariants,plural} from '../ui/kit';
import {Label,Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '../ui/form';
import {environmentHref} from '../../lib/admin-navigation';
import {compositionUses} from '../../lib/connected-studio.mjs';
import {environmentRooms} from '../../lib/environment-workspace.mjs';
import type {EnvironmentWorkspace} from './environment-workspace';
import {EnvironmentPicture} from './environment-picture';
import {StudioCompositionPanel} from './studio-composition-panel';
import {ScenePreview} from './scene-preview';

/** One environment in its own view, in three sections: Miljöbild; Lager och placering (the placement editor,
 * layers, allowed dealers and material, and the saved scene's preview); Används av (the tables that use it,
 * each linking to its own editor, where publication happens). Saving is one draft for the whole project. */
export function EnvironmentEditor({workspace,laneId,game,visible,blocked}:{workspace:EnvironmentWorkspace;laneId:string;game:'blackjack'|'roulette';visible:boolean;blocked:boolean}) {
  const {data,base,status,busy,dirty,error,notice,conflicts,stale}=workspace;
  const lane=data?.project.lanes?.find(row=>row.id===laneId),savedLane=base?.lanes?.find(row=>row.id===laneId);
  const locked=blocked||busy||status!=='ready';
  const listHref=environmentHref();
  const back=<Link className={buttonVariants({variant:'ghost'})} href={listHref}><ArrowLeft aria-hidden="true"/>Alla miljöer</Link>;
  if(!data)return <HubPage eyebrow="Miljöer och material" title="Miljö" actions={back}>
    {status==='error'?<Empty chip={null} title="Miljön kunde inte läsas" text={error||'Projektet svarade inte.'} action={<Button variant="secondary" onClick={()=>void workspace.load()}>Försök igen</Button>}/>:<Loading label="Läser miljön…" rows={4}/>}
  </HubPage>;
  if(!lane)return <HubPage eyebrow="Miljöer och material" title="Miljön finns inte" actions={back}>
    <Empty chip={null} title="Miljön finns inte i projektet" text="Den kan ha tagits bort eller bytt adress." action={<Link className={buttonVariants()} href={listHref}>Till alla miljöer</Link>}/>
  </HubPage>;
  const rooms=environmentRooms(data.catalog,lane.id);
  const setGame=(value:string)=>navigate(environmentHref(lane.id,value==='roulette'?{game:'roulette'}:{}),true);
  const actions=<>{back}
    <Button variant="secondary" disabled={busy||!dirty} onClick={()=>{if(confirm('Kasta dina osparade ändringar och läs in det sparade utkastet?'))workspace.discard();}}>Kasta ändringar</Button>
    <Button variant="primary" disabled={locked||!dirty||conflicts.length>0} onClick={()=>void workspace.save()}>{busy?'Sparar…':'Spara utkast'}</Button></>;
  const state=dirty?<Badge tone="warn" dot>Osparat utkast</Badge>:savedLane?<Badge tone="draft" dot>Sparat</Badge>:<Badge tone="warn" dot>Inte sparad än</Badge>;
  return <HubPage eyebrow="Miljöer och material" title={lane.label} chip={state} actions={actions}
    intro="Miljön placerar bakgrund, dealer och bordsgrafik för dator och mobil och säger vilka dealers och vilket material den tillåter. Spelborden som använder den får ändringen när de publiceras.">
    <div className="grid gap-4" aria-busy={busy||undefined}>
      {blocked&&<Note tone="warn">Klippkartan har ett osparat utkast eller en pågående import. Spara eller avsluta där innan du ändrar miljön.</Note>}
      {error&&<p role="alert" className="m-0 text-[13px] text-sg-danger">{error} {stale&&<Button variant="link" onClick={()=>void workspace.compare()}>Jämför senaste revision</Button>}</p>}
      {conflicts.length>0&&<div role="alert" className="grid gap-2 text-[13px] text-sg-danger"><p className="m-0">Samtidiga ändringar: {conflicts.join(', ')}. Ditt utkast är kvar; sparande är spärrat tills du väljer.</p><Button variant="secondary" className="justify-self-start" onClick={workspace.keepDraft}>Behåll mitt utkast för dessa fält</Button></div>}
      {notice&&<p role="status" className="m-0 text-[13px] text-sg-muted">{notice}</p>}
      <Card title="Miljöbild" id="miljobild">
        <EnvironmentPicture project={data.project} savedProject={base} inventory={data.inventory} laneId={lane.id} blocked={locked} dirty={dirty}
          onEdit={workspace.edit} onExported={(remote,id)=>workspace.registered(remote,id,'illustration',lane.id)}/>
      </Card>
      <Card title="Lager och placering" id="lager" aside={<div className="flex items-center gap-2"><Label htmlFor="environment-game" className="text-sg-muted">Spel</Label>
        <Select value={game} onValueChange={setGame} disabled={busy}><SelectTrigger id="environment-game" className="h-8 w-36"><SelectValue/></SelectTrigger>
          <SelectContent><SelectItem value="blackjack">Blackjack</SelectItem><SelectItem value="roulette">Roulette</SelectItem></SelectContent></Select></div>}>
        <div className="grid gap-5">
          <StudioCompositionPanel inEnvironment project={data.project} savedProject={base} inventory={data.inventory} compositionId={lane.id} game={game}
            dealerId={lane.layers.dealer.default} uses={compositionUses(data.catalog,lane.id)} roomChoicesPath={null} blocked={locked} projectDirty={dirty}
            onSelect={id=>navigate(environmentHref(id,game==='roulette'?{game}:{}))} onEdit={workspace.edit} onSaved={workspace.savedRemote} onBusyChange={workspace.setChildBusy}
            onRegistered={(remote,id,role)=>workspace.registered(remote,id,role,lane.id)}/>
          <section aria-labelledby="environment-preview" className="grid gap-3 border-t border-sg-line-2 pt-4">
            <h3 id="environment-preview" className="m-0 text-[14px] font-semibold">Förhandsvisning av den sparade miljön</h3>
            {savedLane?<ScenePreview active={visible} laneId={lane.id} dealerId={savedLane.layers.dealer.default} game={game} revision={base?.revision} saved={base?{project:base,inventory:data.inventory}:null}/>
              :<p className="m-0 text-[13px] text-sg-muted">Spara utkastet så kan miljön förhandsvisas och provspelas.</p>}
          </section>
        </div>
      </Card>
      <Card title="Används av" id="anvands" flush>
        {rooms.length?<ul className="m-0 grid list-none p-0" aria-label="Spelbord som använder miljön">{rooms.map(room=><li key={room.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-sg-line-2 px-5 py-3 first:border-t-0">
          <span className="grid min-w-0"><Link href={room.href} className="truncate font-semibold text-sg-text hover:underline">{room.name}</Link>
            <span className="text-[12.5px] text-sg-muted">{room.operatorName} · {room.game==='roulette'?'Roulette':'Blackjack'}</span></span>
          <span className="flex items-center gap-2">{room.state==='live'?<Badge tone="live" dot>Öppet</Badge>:<Badge tone="warn" dot>Pausat</Badge>}
            <Link className={buttonVariants({variant:'ghost',size:'sm'})} href={room.href}>Publicera i spelbordet</Link></span>
        </li>)}</ul>
          :<div className="p-5"><Empty chip={null} title="Inget spelbord använder miljön" text="Ett spelbord väljer miljö när det skapas under Bolag och spelbord." action={<Link className={buttonVariants({variant:'secondary'})} href="/admin/companies?tab=spelbord">Till spelborden</Link>}/></div>}
        {rooms.length>0&&<p className="m-0 border-t border-sg-line-2 px-5 py-3 text-[12.5px] text-sg-muted">{plural(rooms.length,'spelbord använder','spelbord använder')} miljön. Ändringar här når spelarna först när spelbordet publiceras.</p>}
      </Card>
    </div>
  </HubPage>;
}
