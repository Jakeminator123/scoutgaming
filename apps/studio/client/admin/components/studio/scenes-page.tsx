import {useState,type FormEvent} from 'react';
import {Plus} from 'lucide-react';
import type {StudioProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import Link,{navigate} from '../../../runtime/navigation';
import {HubPage,Tabs,Chip,Empty,Note} from '../ui/hub';
import {Button,Loading,chipVariants,cn,focusRing,plural,Footnote} from '../ui/kit';
import {Field,Input,Label,Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '../ui/form';
import {Sheet} from '../ui/dialog';
import {adminMaterialFilterId,adminMaterialFilters,adminSceneTabs,environmentHref,materialHref} from '../../lib/admin-navigation';
import {environmentCounts,environmentRooms} from '../../lib/environment-workspace.mjs';
import {addLane,newCompositionId} from '../../../../components/lane-editor';
import {activeStudioDealers} from '../../../../components/studio-types';
import {RegisteredMaterialLibrary} from './registered-material-library';
import {DealerFaces} from './dealer-identity-portrait';
import {SceneCover} from './scene-cover';
import {EnvironmentEditor} from './environment-editor';
import {useEnvironmentWorkspace} from './environment-workspace';

// Miljöer och material in two levels: the tabs Miljöer | Material, and one environment's editor (`composition`).
// Material filters Bakgrund, Bordsgrafik and Arkiverat; the library is the role's own (uploads, AI, trash).
export function ScenesPage({tab,filter,compositionId,game,operator=null,table=null,visible,blocked,onChanged,refreshKey}:{tab:string;filter:string|null;compositionId:string;game:string|null;operator?:string|null;table?:string|null;visible:boolean;blocked:boolean;onChanged:()=>void;refreshKey:string|number}) {
  // The environments (catalog, project and the whole video inventory) are read on Miljöer only.
  const workspace=useEnvironmentWorkspace({active:visible&&tab==='miljoer',refreshKey,onChanged});
  const {data,status,dirty,error}=workspace;
  const [creating,setCreating]=useState(false);
  if(tab==='miljoer'&&compositionId)return <EnvironmentEditor workspace={workspace} laneId={compositionId} game={game==='roulette'?'roulette':'blackjack'} visible={visible} blocked={blocked} operator={operator} table={table}/>;
  const project=data?.project,counts=environmentCounts(project),lanes=project?.lanes??[],assets=project?.layerAssets??[];
  const materialFilter=adminMaterialFilterId(filter);
  const dealerOf=(id:string)=>({id,label:project?.dealers.find(row=>row.id===id)?.label??'Okänd dealer'});
  const actions=tab==='miljoer'?<>
    {dirty&&<Button variant="secondary" disabled={workspace.busy} onClick={()=>{if(confirm('Kasta dina osparade ändringar och läs in det sparade utkastet?'))workspace.discard();}}>Kasta ändringar</Button>}
    {dirty&&<Button variant="primary" disabled={workspace.busy||blocked||workspace.conflicts.length>0} onClick={()=>void workspace.save()}>Spara utkast</Button>}
    <Button variant={dirty?'secondary':'primary'} disabled={!project||blocked||workspace.busy} onClick={()=>setCreating(true)}><Plus aria-hidden="true"/>Ny miljö</Button></>:undefined;
  return <HubPage title="Miljöer och material" actions={actions}
    intro="En miljö placerar bakgrund, dealer och bordsgrafik för dator och mobil och säger vilka dealers och vilket material den tillåter. Materialet laddas upp här, på ett ställe."
    tabs={<Tabs items={adminSceneTabs} active={tab} param="tab" drop={['composition','operator','table']} counts={project?{miljoer:counts.miljoer,material:counts.material}:{}}/>}
    note={tab==='miljoer'?(dirty?'Osparat utkast. Spara innan du lämnar sidan.':'Välj en miljö för att ändra miljöbild, lager och placering.'):undefined}>
    {status==='error'&&!data&&<Empty chip={null} title="Miljöerna kunde inte läsas" text={error||'Projektet svarade inte.'} action={<Button variant="secondary" onClick={()=>void workspace.load()}>Försök igen</Button>}/>}
    {tab==='miljoer'&&!data&&status!=='error'&&<Loading label="Läser miljöerna…" rows={3}/>}
    {tab==='miljoer'&&data&&(lanes.length?<div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3" role="list" aria-label="Miljöer">{lanes.map(lane=>{
      const used=environmentRooms(data.catalog,lane.id),dealers=lane.layers.dealer.allowed.map(dealerOf);
      return <Link key={lane.id} role="listitem" href={environmentHref(lane.id)} className={cn('group grid overflow-hidden rounded-[10px] border border-sg-border bg-sg-surface text-sg-text no-underline transition-colors duration-200 hover:border-sg-faint motion-reduce:transition-none',focusRing)}>
        <SceneCover lane={lane} assets={assets} dealer={dealers.find(row=>row.id===lane.layers.dealer.default)??dealers[0]}/>
        <span className="grid gap-2 p-4">
          <span className="flex items-center justify-between gap-2"><span className="truncate font-semibold group-hover:underline">{lane.label}</span><Chip tone={used.length?'live':'off'} dot>{used.length?plural(used.length,'spelbord','spelbord'):'Oanvänd'}</Chip></span>
          <span className="text-[12.5px] text-sg-muted"><DealerFaces dealers={dealers} empty="Inga dealers ännu"/></span>
          {used.length>0&&<span className="truncate text-xs text-sg-faint">Används av {used.map(room=>room.name).join(', ')}</span>}
        </span>
      </Link>;})}</div>
      :<Empty chip={null} title="Inga miljöer ännu" text="En miljö behövs innan ett spelbord kan skapas." action={<Button variant="primary" disabled={blocked} onClick={()=>setCreating(true)}><Plus aria-hidden="true"/>Ny miljö</Button>}/>)}
    {tab==='material'&&<div className="grid gap-4">
      <nav aria-label="Filtrera material" className="flex flex-wrap gap-2">{adminMaterialFilters.map(row=><Link key={row.id} href={materialHref(row.id,game==='roulette'?{game}:{})} aria-current={row.id===materialFilter?'page':undefined}
        className={chipVariants({selected:row.id===materialFilter})}>{row.label}{project&&<span className="font-mono tabular-nums text-sg-muted">{counts[row.id as 'bakgrund'|'bordsgrafik'|'arkiverat']}</span>}</Link>)}</nav>
      {dirty&&<Note tone="warn">Miljöerna har ett osparat utkast. Spara eller kasta det under Miljöer innan du ändrar materialet.</Note>}
      {materialFilter==='arkiverat'&&<Footnote>Arkiverat material kan återställas; permanent radering är ett eget steg. Arkiverade dealers finns under Dealers.</Footnote>}
      {materialFilter!=='arkiverat'&&<RegisteredMaterialLibrary role={materialFilter==='bakgrund'?'background':'table'} base="/admin/scenes" visible={visible} disabled={blocked||dirty} onChanged={onChanged} refreshKey={String(refreshKey)}/>}
      {materialFilter==='arkiverat'&&<><RegisteredMaterialLibrary role="background" base="/admin/scenes" visible={visible} disabled={blocked||dirty} onChanged={onChanged} refreshKey={String(refreshKey)} trashOnly/>
        <RegisteredMaterialLibrary role="table" base="/admin/scenes" visible={visible} disabled={blocked||dirty} onChanged={onChanged} refreshKey={String(refreshKey)} trashOnly/></>}
    </div>}
    {project&&<NewEnvironment open={creating} project={project} onClose={()=>setCreating(false)} onCreate={(next,id)=>{workspace.edit(next);setCreating(false);navigate(environmentHref(id));}}/>}
  </HubPage>;
}

// "Ny miljö" in a side panel: a name and the dealer it starts with. The environment is created in the draft and
// opened; Spara utkast saves it, as every other environment edit.
function NewEnvironment({open,project,onClose,onCreate}:{open:boolean;project:StudioProject;onClose:()=>void;onCreate:(project:StudioProject,id:string)=>void}) {
  const dealers=activeStudioDealers(project);
  const [label,setLabel]=useState(''),[dealer,setDealer]=useState(''),[error,setError]=useState('');
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const name=label.trim();if(!name||!dealers.some(row=>row.id===dealer))return;
    try{const id=newCompositionId(project,name);onCreate(addLane(project,id,name,dealer),id);setLabel('');setDealer('');setError('');}
    catch(cause){setError((cause as Error).message);}
  }
  return <Sheet open={open} title="Ny miljö" description="Namnet visas i Admin och portalen. Ett tekniskt id skapas automatiskt." onClose={onClose}>
    <form className="grid gap-4" onSubmit={submit}>
      <Field label="Namn"><Input value={label} required maxLength={80} onChange={event=>setLabel(event.target.value)}/></Field>
      <div className="grid gap-1.5"><Label htmlFor="new-environment-dealer">Dealer</Label>
        <Select value={dealer} onValueChange={setDealer}><SelectTrigger id="new-environment-dealer"><SelectValue placeholder="Välj dealer"/></SelectTrigger>
          <SelectContent>{dealers.map(row=><SelectItem key={row.id} value={row.id}>{row.label}</SelectItem>)}</SelectContent></Select>
        {!dealers.length&&<p className="m-0 text-[12.5px] text-sg-muted">Registrera först en dealer under <Link href="/admin/dealers" className="font-semibold text-inherit">Dealers</Link>.</p>}</div>
      {error&&<p role="alert" className="m-0 text-[13px] text-sg-danger">{error}</p>}
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Avbryt</Button><Button variant="primary" type="submit" disabled={!label.trim()||!dealer}>Skapa miljö</Button></div>
    </form>
  </Sheet>;
}
