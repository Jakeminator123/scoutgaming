import {useEffect,useState} from 'react';
import {Upload} from 'lucide-react';
import Link, {navigate,useSearchParams} from '../../../runtime/navigation';
import {HubPage,Crumbs,Tabs,Chip,Card,Row,Empty,KV,Note,Steps,ActionMenu,PreviewFlyout,pageClass} from '../ui/hub';
import {buttonVariants,cn,plural,TechnicalDetails} from '../ui/kit';
import {adminDealerTabs,adminDealerSteps} from '../../lib/admin-navigation';
import type {Workspace} from '../../lib/connected-studio.mjs';
import type {StudioProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import {dealerCoverage,dealerStill,dealerTemplates,dealerUses} from '../../lib/dealer-coverage.mjs';
import {DealerAvatar} from './dealer-identity-portrait';
import {WorkspaceTool} from './workspace-tools';
import {TaldriftPanel} from './taldrift-panel';
import {ResourceConnections} from './resource-connections';
import {SavedScenePreview} from './saved-scene-preview';

type Props={part:'head'|'tail';dealerId:string;tab:string;workspace:Workspace|null;saved:StudioProject|null};
const base=(dealerId:string)=>'/admin/dealers/'+encodeURIComponent(dealerId);
type Coverage=ReturnType<typeof dealerCoverage>;
function Meter({label,part}:{label:string;part:{bound:number;total:number}}) {
  const share=part.total?part.bound/part.total:0;
  return <div className="grid min-w-[120px] flex-1 gap-1.5"><div className="flex items-baseline justify-between text-xs text-sg-muted"><span>{label}</span><b className="font-semibold tabular-nums text-sg-text">{part.bound}/{part.total}</b></div>
    <div className="h-1.5 overflow-hidden rounded-full bg-sg-hover"><div className={cn('h-full rounded-full',share>=1?'bg-sg-ok':'bg-sg-warn')} style={{width:`${Math.round(share*100)}%`}}/></div></div>;
}

// The dealer nav: header with portrait, status and actions, the seven steps, tabs. The clip map (Klippkarta,
// Röst och tal, Inställningar) is mounted by entry.tsx between head and tail so one instance serves all three tabs.
export function DealerHub({part,dealerId,tab,workspace,saved}:Props) {
  const query=useSearchParams();
  // Svarsbiblioteket and Dialogtest keep their drafts across tab changes on this dealer.
  const [talVisited,setTalVisited]=useState(tab==='tal');
  useEffect(()=>{if(tab==='tal')setTalVisited(true);},[tab]);
  const dealer=workspace?.project.dealers.find(row=>row.id===dealerId);
  const coverage=workspace&&dealer?dealerCoverage(workspace.project,workspace.inventory,dealer.id):null;
  const templates=workspace&&dealer?dealerTemplates(workspace.project,dealer.id):[];
  const uses=workspace&&dealer?dealerUses(workspace.catalog,dealer.id):{rooms:[],operators:[]};
  const trashed=workspace?.project.dealerTrash?.find(row=>row.dealer.id===dealerId);
  const label=dealer?.label??trashed?.dealer.label??'Dealer';
  const href=(flik:string,extra:Record<string,string>={})=>base(dealerId)+'?'+new URLSearchParams({flik,...extra});
  const steps=[
    {label:adminDealerSteps[0],done:Boolean(dealer),href:'/admin/dealers'},
    {label:adminDealerSteps[1],done:Boolean(coverage?.anyClip),href:href('klipp',{panel:'intake'})},
    {label:adminDealerSteps[2],done:Boolean(coverage&&coverage.deal.bound===coverage.deal.total&&coverage.idle.bound===coverage.idle.total&&coverage.deal.total>0),href:href('klipp')},
    {label:adminDealerSteps[3],done:false,href:href('landningar')},
    {label:adminDealerSteps[4],done:Boolean(coverage&&coverage.speech.total>0&&coverage.speech.bound===coverage.speech.total),href:href('tal')},
    {label:adminDealerSteps[5],done:false,href:href('installningar')},
    {label:adminDealerSteps[6],done:uses.operators.length>0,href:uses.operators[0]?`/admin/companies/${encodeURIComponent(uses.operators[0].id)}?flik=tilldelning`:'/admin/companies'},
  ];
  const technical:[string,string][]=dealer?[['Dealer-id',dealer.id],['Lagringsmapp',`dealers/${dealer.id}/`],...templates.map(lane=>['Scenmall '+lane.label,lane.id] as [string,string])]:[];
  const usedBy=uses.operators.length?`Används av ${uses.operators.map(row=>row.name).join(', ')}`:'Inte tilldelad något bolag';
  if(part==='head')return <HubPage wide continued
    title={<span className="inline-flex items-center gap-4">{dealer?<DealerAvatar dealer={dealer} still={dealerStill(workspace!.project,workspace!.inventory,dealer.id)} size={60}/>:null}<span>{label}</span></span>}
    chip={coverage?<Chip tone={coverage.complete?'ok':'warn'} dot>{coverage.complete?'Redo för spel':'Klipp saknas'}</Chip>:trashed?<Chip tone="danger">I papperskorgen</Chip>:undefined}
    eyebrow={<Crumbs items={[{label:'Dealers',href:'/admin/dealers'},{label}]}/>}
    intro={workspace?dealer?`${usedBy} · ${plural(uses.rooms.length,'spelbord','spelbord')} · tillåten i ${plural(templates.length,'scenmall','scenmallar')}`:trashed?'Dealern ligger i papperskorgen. Återställ den under Dealers.':'Dealern finns inte i registret.':'Läser register…'}
    actions={<>
      {tab==='klipp'&&dealer&&<Link className={buttonVariants({variant:'primary'})} href={href('klipp',{panel:'intake'})}><Upload aria-hidden="true"/>Lägg till klipp</Link>}
      {dealer&&<ActionMenu name={label} actions={[
        {id:'approve',label:'Godkänn dealern',disabled:'Godkännande sparas inte ännu; checklistan under Inställningar visar vad som återstår.',onSelect:()=>{}},
        {id:'archive',label:'Arkivera',onSelect:()=>navigate(href('installningar'))},
        {id:'delete',label:'Radera permanent',tone:'danger',disabled:uses.rooms.length?`Används av ${plural(uses.rooms.length,'spelbord','spelbord')}`:undefined,onSelect:()=>navigate(href('installningar'))},
      ]}/>}
    </>}>
    {dealer&&<Steps steps={steps}/>}
    <Tabs items={adminDealerTabs} active={tab} counts={coverage?{klipp:`${coverage.deal.bound+coverage.idle.bound+coverage.speech.bound}/${coverage.deal.total+coverage.idle.total+coverage.speech.total}`,anvands:uses.rooms.length}:{}}/>
    {tab==='klipp'&&coverage&&<div className="-mt-2 mb-1 flex flex-wrap items-end gap-x-6 gap-y-3 rounded-xl border border-sg-border bg-sg-surface px-4 py-3 shadow-sg">
      <span className="text-[12.5px] font-semibold text-sg-text">Krävs för spel</span>
      <Meter label="Giv" part={coverage.deal}/><Meter label="Tal" part={coverage.speech}/><Meter label="Vila" part={coverage.idle}/>
      <span className="text-xs text-sg-faint">Skoövergångar och {plural(coverage.optional.total,'replik','repliker')} är frivilliga.</span>
    </div>}
    {tab==='installningar'&&coverage&&<ApprovalCard coverage={coverage} templates={templates}/>}
    {tab==='installningar'&&dealer&&<TechnicalDetails items={technical}/>}
  </HubPage>;
  // Tail: what each tab shows below (or instead of) the clip map.
  if(!dealer)return null;
  return <div className={cn(pageClass,'max-w-none pt-0')}>
    {tab==='klipp'&&<DealerPreview dealerId={dealer.id} templates={templates} saved={saved}/>}
    {talVisited&&<div className="mt-5 grid gap-4" hidden={tab!=='tal'}>
      <Note tone="warn">Talkedjan byggs om efter O03, likadant för alla dealers: text, röst och läppsynk. Verktygen nedan fungerar som i dag.</Note>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Tal vid inaktivitet" aside="Av · Automatiskt klipp · AI-tal"><Empty title="Inte anslutet · kommer med talkedjan efter O03" text="Inställningen finns i dag bara för hela projektet, inte per dealer. Inget sparas här förrän talkedjan är byggd för alla dealers."/></Card>
        <Card title="Taldrift" aside="Talets GPU-läge i den här miljön"><TaldriftPanel/></Card>
      </div>
      <Card title="Svarsbibliotek" aside="Dealerns inspelade svar i kategorier"><WorkspaceTool section="replies" overrides={{dealer:dealer.id}}/></Card>
      <Card title="Dialogtest" aside="Chatta med dealern">{query.get('verktyg')==='dialog'?<WorkspaceTool section="dealer-agent" overrides={{dealer:dealer.id}}/>:<p className="m-0 flex flex-wrap items-center gap-3"><Link className={buttonVariants()} href={href('tal',{verktyg:'dialog'})}>Öppna Dialogtest</Link><span className="text-[12.5px] text-sg-muted">Chattar med dealerns sparade AI-inställningar, inte med inspelade tagningar.</span></p>}</Card>
    </div>}
    {tab==='landningar'&&<DealerLandings dealerId={dealer.id} templates={templates} saved={saved} dealTotal={coverage?.deal.total??0} dealBound={coverage?.deal.bound??0}/>}
    {tab==='anvands'&&<div className="mt-5 grid gap-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Spelbord">{uses.rooms.length?<div className="grid">{uses.rooms.map(room=><Row key={room.id} chip={<Chip tone={room.state==='live'?'ok':'warn'} dot>{room.state==='live'?'öppet':'pausat'}</Chip>} title={room.name} text={`${workspace!.catalog.administration.operators.find(row=>row.id===room.operatorId)?.name??'Okänt bolag'} · ${room.published?'publicerat':'inte publicerat'}`} href={`/admin/rooms/${encodeURIComponent(room.id)}`}/>)}</div>:<p className="m-0 text-[12.5px] text-sg-muted">Inga spelbord använder dealern.</p>}</Card>
        <Card title="Bolag">{uses.operators.length?<div className="grid">{uses.operators.map(operator=><Row key={operator.id} chip={<Chip>{operator.packageRevision===null?'ingen version':`version ${operator.packageRevision}`}</Chip>} title={operator.name} text="via spelbordens scenmallar" href={`/admin/companies/${encodeURIComponent(operator.id)}?flik=tilldelning`}/>)}</div>:<p className="m-0 text-[12.5px] text-sg-muted">Inte tilldelad något bolag.</p>}</Card>
        <Card title="Scenmallar">{templates.length?<div className="grid">{templates.map(lane=><Row key={lane.id} chip={<Chip tone={lane.isDefault?'accent':''}>{lane.isDefault?'förval':'tillåten'}</Chip>} title={lane.label} text={lane.isDefault?'Dealern är förvald i mallen':'Dealern kan väljas i mallen'} href={`/admin/scenes?tab=mallar&composition=${encodeURIComponent(lane.id)}&dealer=${encodeURIComponent(dealer.id)}`}/>)}</div>:<p className="m-0 text-[12.5px] text-sg-muted">Ingen scenmall tillåter dealern ännu.</p>}</Card>
      </div>
      <Card title="Alla kopplingar" aside="Samma läsning som System › Beroenden"><ResourceConnections embedded context={'?dealer='+encodeURIComponent(dealer.id)}/></Card>
    </div>}
    {(tab==='landningar'||tab==='anvands')&&<TechnicalDetails items={technical}/>}
  </div>;
}

function ApprovalCard({coverage,templates}:{coverage:Coverage;templates:{id:string}[]}) {
  const rows:[string,boolean|null][]=[
    [`Hela givbanken (${coverage.deal.bound}/${plural(coverage.deal.total,'fack','fack')})`,coverage.deal.total>0&&coverage.deal.bound===coverage.deal.total],
    [`Vila (${coverage.idle.bound}/${coverage.idle.total})`,coverage.idle.total>0&&coverage.idle.bound===coverage.idle.total],
    [`Talfack med standardtagning (${coverage.speech.bound}/${coverage.speech.total})`,coverage.speech.total>0&&coverage.speech.bound===coverage.speech.total],
    ['Landningar mätta',null],
    [`Tillåten i minst en scenmall (${templates.length})`,templates.length>0],
  ];
  return <Card title="Godkännande" aside="Krävs för att dealern ska kunna tilldelas" className="mt-3">
    <div className="grid">{rows.map(([text,ok])=><Row key={text} chip={ok===null?<Chip tone="warn">efter O03</Chip>:ok?<Chip tone="ok">klart</Chip>:<Chip tone="danger">saknas</Chip>} title={text}/>)}</div>
    <p className="mb-0 mt-3 text-[12.5px] text-sg-muted">Checklistan visar läget; godkännandet sparas inte ännu. Tilldelning görs under Bolag › Tilldelning. Landningarna mäts i Admin efter O03; i dag finns de bara för två filmade dealers.</p>
  </Card>;
}

function DealerPreview({dealerId,templates,saved}:{dealerId:string;templates:{id:string;label:string}[];saved:StudioProject|null}) {
  const [open,setOpen]=useState(false),[laneId,setLaneId]=useState('');
  const lane=templates.find(row=>row.id===laneId)??templates[0];
  return <PreviewFlyout title="Förhandsvisning · sparad scen" open={open} onOpenChange={setOpen}>
    {templates.length>1&&<label className="mb-3 grid gap-1.5 text-[13px] font-semibold">Scenmall<select value={lane?.id??''} onChange={event=>setLaneId(event.target.value)} className="h-9 rounded-lg border border-sg-border bg-sg-surface px-2.5 font-normal text-sg-text">{templates.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>}
    {!templates.length&&<Empty chip={null} title="Ingen scenmall tillåter dealern" action={<Link className={buttonVariants()} href="/admin/scenes?tab=mallar">Till Scenmallar</Link>}/>}
    {lane&&<SavedScenePreview active={open} presentationLaneId={lane.id} revision={saved?.revision} dealerId={dealerId} game="blackjack"/>}
    <p className="mb-0 mt-3 text-[12.5px] text-sg-muted">Visar scenmallens sparade förval som spelaren ser dem vid det delade bordet, på dator. Mobilvyn kommer efter O03.</p>
  </PreviewFlyout>;
}

function DealerLandings({dealerId,templates,saved,dealTotal,dealBound}:{dealerId:string;templates:{id:string;label:string}[];saved:StudioProject|null;dealTotal:number;dealBound:number}) {
  const [open,setOpen]=useState(false);
  return <div className="mt-5 grid gap-4">
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Var dealerns hand landar" aside={<Chip tone="warn">efter O03</Chip>}>
        <p className="mb-3 mt-0 text-[12.5px] text-sg-muted">Korten ritas där handen landar i filmen: på varje spelarplats och hos dealern, för varje givklipp. Landningarna mäts och sparas i Admin efter O03. I dag finns de bara för två filmade dealers.</p>
        <KV items={[['Givklipp',`${dealBound}/${plural(dealTotal,'fack','fack')} kopplade`],['Mobil','3 av 7 platser i ett glidande fönster, ingen zoom'],['Mäts ur','givklippen: när kortet nuddar, landar och lämnar handen']]}/>
        <div className="mt-4 flex flex-wrap items-center gap-2"><button type="button" className={buttonVariants()} disabled title="Efter O03">Mät landningar</button><button type="button" className={buttonVariants({variant:'ink'})} disabled title="Efter O03">Exportera landningsmall</button><span className="text-[12.5px] text-sg-muted">efter O03</span></div>
      </Card>
      <Card title="Så ser det ut i scenen" aside="Dator">
        {templates.length?<><button type="button" className={buttonVariants()} onClick={()=>setOpen(value=>!value)} aria-expanded={open}>{open?'Stäng förhandsvisningen':'Provspela sparad scen'}</button>{open&&<div className="mt-3"><SavedScenePreview active presentationLaneId={templates[0].id} revision={saved?.revision} dealerId={dealerId} game="blackjack"/></div>}</>:<Empty chip={null} title="Ingen scenmall tillåter dealern ännu" action={<Link className={buttonVariants()} href="/admin/scenes?tab=mallar">Till Scenmallar</Link>}/>}
        <p className="mb-0 mt-3 text-[12.5px] text-sg-muted">Bordsgrafiken ritas efter dealern, inte tvärtom. Lagrens storlek och läge ändras under <Link href="/admin/scenes?tab=mallar" className="font-semibold text-sg-accent-text">Scenmallar</Link>.</p>
      </Card>
    </div>
    <Card title={`Scenmallar som tillåter dealern (${templates.length})`} aside={<Link href="/admin/scenes?tab=mallar" className="font-semibold text-sg-accent-text no-underline hover:underline">Scenmallar →</Link>}>
      {templates.length?<div className="grid">{templates.map(lane=><Row key={lane.id} chip={<Chip>scenmall</Chip>} title={lane.label} text="Dealern kan väljas i mallen" href={`/admin/scenes?tab=mallar&composition=${encodeURIComponent(lane.id)}&dealer=${encodeURIComponent(dealerId)}`}/>)}</div>:<Empty chip={null} title="Ingen scenmall tillåter dealern ännu"/>}
    </Card>
  </div>;
}
