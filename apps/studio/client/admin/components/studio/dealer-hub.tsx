import {useEffect,useState} from 'react';
import {Upload} from 'lucide-react';
import Link, {navigate,useSearchParams} from '../../../runtime/navigation';
import {HubPage,Crumbs,Tabs,Chip,Card,Row,Empty,KV,Note,Steps,ActionMenu,PreviewFlyout,pageClass,AsideLink} from '../ui/hub';
import {buttonVariants,cn,Footnote,plural,TechnicalDetails,textLinkClass} from '../ui/kit';
import {adminDealerTabs,adminDealerSteps} from '../../lib/admin-navigation';
import type {Workspace} from '../../lib/connected-studio.mjs';
import type {StudioProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import {dealerCoverage,dealerStill,dealerTemplates,dealerUses} from '../../lib/dealer-coverage.mjs';
import {DealerAvatar} from './dealer-identity-portrait';
import {WorkspaceTool} from './workspace-tools';
import {TaldriftPanel} from './taldrift-panel';
import {ResourceConnections} from './resource-connections';
import {SavedScenePreview} from './saved-scene-preview';
import {ScenePreview} from './scene-preview';
import {DealerTimingAction} from './clip-timing';
import {DealerFilmedProfilePanel} from './dealer-filmed-profile';

type Props={part:'head'|'tail';dealerId:string;tab:string;workspace:Workspace|null;saved:StudioProject|null;onMaterialChanged?:()=>void};
const base=(dealerId:string)=>'/admin/dealers/'+encodeURIComponent(dealerId);
type Coverage=ReturnType<typeof dealerCoverage>;
function Meter({label,part}:{label:string;part:{bound:number;total:number}}) {
  const share=part.total?part.bound/part.total:0;
  return <div className="grid min-w-[120px] flex-1 gap-1.5"><div className="flex items-baseline justify-between text-xs text-sg-muted"><span>{label}</span><b className="font-semibold tabular-nums text-sg-text">{part.bound}/{part.total}</b></div>
    <div className="h-1.5 overflow-hidden rounded-full bg-sg-hover"><div className={cn('h-full rounded-full',share>=1?'bg-sg-ok':'bg-sg-warn')} style={{width:`${Math.round(share*100)}%`}}/></div></div>;
}

// The dealer nav: header with portrait, status and actions, the five steps, tabs. The clip map (Klippkarta,
// Röst och tal, Inställningar) is mounted by entry.tsx between head and tail so one instance serves all three tabs.
export function DealerHub({part,dealerId,tab,workspace,saved,onMaterialChanged}:Props) {
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
    {label:adminDealerSteps[3],done:Boolean(coverage&&coverage.speech.total>0&&coverage.speech.bound===coverage.speech.total),href:href('tal')},
    {label:adminDealerSteps[4],done:uses.operators.length>0,href:uses.operators[0]?`/admin/companies/${encodeURIComponent(uses.operators[0].id)}?flik=tilldelning`:'/admin/companies'},
  ];
  const technical:[string,string][]=dealer?[['Dealer-id',dealer.id],['Lagringsmapp',`dealers/${dealer.id}/`],...templates.map(lane=>['Miljö '+lane.label,lane.id] as [string,string])]:[];
  const usedBy=uses.operators.length?`Används av ${uses.operators.map(row=>row.name).join(', ')}`:'Inte tilldelad något bolag';
  if(part==='head')return <HubPage wide continued
    title={<span className="inline-flex items-center gap-4">{dealer?<DealerAvatar dealer={dealer} still={dealerStill(workspace!.project,workspace!.inventory,dealer.id)} size={60}/>:null}<span>{label}</span></span>}
    chip={coverage?<Chip tone={coverage.complete?'ok':'warn'} dot>{coverage.complete?'Redo för spel':'Klipp saknas'}</Chip>:trashed?<Chip tone="danger">I papperskorgen</Chip>:undefined}
    eyebrow={<Crumbs items={[{label:'Dealers',href:'/admin/dealers'},{label}]}/>}
    intro={workspace?dealer?`${usedBy} · ${plural(uses.rooms.length,'spelbord','spelbord')} · tillåten i ${plural(templates.length,'miljö','miljöer')}`:trashed?'Dealern ligger i papperskorgen. Återställ den under Dealers.':'Dealern finns inte i registret.':'Läser register…'}
    actions={<>
      {tab==='klipp'&&dealer&&<Link className={buttonVariants({variant:'primary'})} href={href('klipp',{panel:'intake'})}><Upload aria-hidden="true"/>Lägg till klipp</Link>}
      {dealer&&<ActionMenu name={label} actions={[
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
      {/* Spelbordet publiceras bara med uppmätta klipp; mätningen ger inget nytt bild- eller talgodkännande. */}
      <div className="ml-auto"><DealerTimingAction inventory={workspace?.inventory} dealerId={dealerId} onDone={onMaterialChanged}/></div>
    </div>}
    {tab==='installningar'&&coverage&&<ApprovalCard coverage={coverage} templates={templates}/>}
    {tab==='installningar'&&dealer&&<TechnicalDetails items={technical}/>}
  </HubPage>;
  // Tail: what each tab shows below (or instead of) the clip map.
  if(!dealer)return null;
  return <div className={cn(pageClass,'max-w-none pt-0')}>
    {tab==='klipp'&&<DealerPreview dealerId={dealer.id} templates={templates} saved={saved} workspace={workspace}/>}
    {talVisited&&<div className="mt-5 grid gap-4" hidden={tab!=='tal'}>
      <Note tone="warn">Talkedjan byggs om, likadant för alla dealers: text, röst och läppsynk. Verktygen nedan fungerar som i dag.</Note>
      <Card title="Taldrift" aside="Talets GPU-läge"><TaldriftPanel dealerId={dealer.id}/></Card>
      <Card title="Svarsbibliotek" aside="Dealerns inspelade svar i kategorier"><WorkspaceTool section="replies" overrides={{dealer:dealer.id}}/></Card>
      <Card title="Dialogtest" aside="Chatta med dealern">{query.get('verktyg')==='dialog'?<WorkspaceTool section="dealer-agent" overrides={{dealer:dealer.id}}/>:<p className="m-0 flex flex-wrap items-center gap-3"><Link className={buttonVariants()} href={href('tal',{verktyg:'dialog'})}>Öppna Dialogtest</Link><span className="text-[12.5px] text-sg-muted">Chattar med dealerns sparade AI-inställningar, inte med inspelade tagningar.</span></p>}</Card>
    </div>}
    {tab==='landningar'&&<DealerLandings dealerId={dealer.id} templates={templates} saved={saved} workspace={workspace} onSaved={onMaterialChanged}/>}
    {tab==='anvands'&&<div className="mt-5 grid gap-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Spelbord">{uses.rooms.length?<div className="grid">{uses.rooms.map(room=><Row key={room.id} chip={<Chip tone={room.state==='live'?'ok':'warn'} dot>{room.state==='live'?'öppet':'pausat'}</Chip>} title={room.name} text={`${workspace!.catalog.administration.operators.find(row=>row.id===room.operatorId)?.name??'Okänt bolag'} · ${room.published?'publicerat':'inte publicerat'}`} href={`/admin/rooms/${encodeURIComponent(room.id)}`}/>)}</div>:<p className="m-0 text-[12.5px] text-sg-muted">Inga spelbord använder dealern.</p>}</Card>
        <Card title="Bolag">{uses.operators.length?<div className="grid">{uses.operators.map(operator=><Row key={operator.id} chip={<Chip>{operator.packageRevision===null?'ingen version':`version ${operator.packageRevision}`}</Chip>} title={operator.name} text="via spelbordens miljöer" href={`/admin/companies/${encodeURIComponent(operator.id)}?flik=tilldelning`}/>)}</div>:<p className="m-0 text-[12.5px] text-sg-muted">Inte tilldelad något bolag.</p>}</Card>
        <Card title="Miljöer">{templates.length?<div className="grid">{templates.map(lane=><Row key={lane.id} chip={<Chip tone={lane.isDefault?'accent':''}>{lane.isDefault?'förval':'tillåten'}</Chip>} title={lane.label} text={lane.isDefault?'Dealern är förvald i miljön':'Dealern kan väljas i miljön'} href={`/admin/scenes?tab=miljoer&composition=${encodeURIComponent(lane.id)}&dealer=${encodeURIComponent(dealer.id)}`}/>)}</div>:<p className="m-0 text-[12.5px] text-sg-muted">Ingen miljö tillåter dealern ännu.</p>}</Card>
      </div>
      <Card title="Alla kopplingar" aside={<AsideLink href={'/admin/system?flik=beroenden&dealer='+encodeURIComponent(dealer.id)}>Beroenden under System</AsideLink>}><ResourceConnections embedded context={'?dealer='+encodeURIComponent(dealer.id)}/></Card>
    </div>}
    {(tab==='landningar'||tab==='anvands')&&<TechnicalDetails items={technical}/>}
  </div>;
}

function ApprovalCard({coverage,templates}:{coverage:Coverage;templates:{id:string}[]}) {
  const rows:[string,boolean][]=[
    [`Hela givbanken (${coverage.deal.bound}/${plural(coverage.deal.total,'fack','fack')})`,coverage.deal.total>0&&coverage.deal.bound===coverage.deal.total],
    [`Vila (${coverage.idle.bound}/${coverage.idle.total})`,coverage.idle.total>0&&coverage.idle.bound===coverage.idle.total],
    [`Talfack med standardtagning (${coverage.speech.bound}/${coverage.speech.total})`,coverage.speech.total>0&&coverage.speech.bound===coverage.speech.total],
    [`Tillåten i minst en miljö (${templates.length})`,templates.length>0],
  ];
  return <Card title="Redo för spel" aside="Det som krävs innan dealern tilldelas" className="mt-3">
    <div className="grid">{rows.map(([text,ok])=><Row key={text} chip={ok?<Chip tone="ok">klart</Chip>:<Chip tone="danger">saknas</Chip>} title={text}/>)}</div>
    <Footnote>Checklistan visar läget. Dealern tilldelas under bolagets flik Tilldelning i <Link href="/admin/companies" className={textLinkClass}>Bolag och spelbord</Link>.</Footnote>
  </Card>;
}

function DealerPreview({dealerId,templates,saved,workspace}:{dealerId:string;templates:{id:string;label:string}[];saved:StudioProject|null;workspace:Workspace|null}) {
  const [open,setOpen]=useState(false),[laneId,setLaneId]=useState('');
  const lane=templates.find(row=>row.id===laneId)??templates[0];
  return <PreviewFlyout title="Förhandsvisning · sparad scen" open={open} onOpenChange={setOpen}>
    {templates.length>1&&<label className="mb-3 grid gap-1.5 text-[13px] font-semibold">Miljö<select value={lane?.id??''} onChange={event=>setLaneId(event.target.value)} className="h-9 rounded-lg border border-sg-border bg-sg-surface px-2.5 font-normal text-sg-text">{templates.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>}
    {!templates.length&&<Empty chip={null} title="Ingen miljö tillåter dealern" action={<Link className={buttonVariants()} href="/admin/scenes?tab=miljoer">Till Miljöer</Link>}/>}
    {lane&&<ScenePreview active={open} laneId={lane.id} dealerId={dealerId} game="blackjack" revision={saved?.revision} saved={workspace?{project:saved??workspace.project,inventory:workspace.inventory}:null}/>}
    <Footnote>Visar den sparade miljön med dealerns vila, på dator. Mobilvyn kommer senare.</Footnote>
  </PreviewFlyout>;
}

function DealerLandings({dealerId,templates,saved,workspace,onSaved}:{dealerId:string;templates:{id:string;label:string}[];saved:StudioProject|null;workspace:Workspace|null;onSaved?:()=>void}) {
  const [open,setOpen]=useState(false);
  return <div className="mt-5 grid gap-4">
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Var dealerns hand landar">
        <Footnote className="mb-3 mt-0">Profilen kopplar varje givklipp till kortets bana, landning och handens poser.</Footnote>
        <DealerFilmedProfilePanel key={dealerId} dealerId={dealerId} workspace={workspace} saved={saved} onSaved={onSaved}/>
      </Card>
      <Card title="Så ser det ut i scenen" aside="Dator">
        {templates.length?<><button type="button" className={buttonVariants()} onClick={()=>setOpen(value=>!value)} aria-expanded={open}>{open?'Stäng förhandsvisningen':'Provspela sparad scen'}</button>{open&&<div className="mt-3"><SavedScenePreview active presentationLaneId={templates[0].id} revision={saved?.revision} dealerId={dealerId} game="blackjack"/></div>}</>:<Empty chip={null} title="Ingen miljö tillåter dealern ännu" action={<Link className={buttonVariants()} href="/admin/scenes?tab=miljoer">Till Miljöer</Link>}/>}
        <Footnote>Bordsgrafiken ritas efter dealern, inte tvärtom. Lagrens storlek och läge ändras under <Link href="/admin/scenes?tab=miljoer" className={textLinkClass}>Miljöer</Link>.</Footnote>
      </Card>
    </div>
    <Card title={`Miljöer som tillåter dealern (${templates.length})`} aside={<AsideLink href="/admin/scenes?tab=miljoer">Miljöer</AsideLink>}>
      {templates.length?<div className="grid">{templates.map(lane=><Row key={lane.id} chip={<Chip>miljö</Chip>} title={lane.label} text="Dealern kan väljas i miljön" href={`/admin/scenes?tab=miljoer&composition=${encodeURIComponent(lane.id)}&dealer=${encodeURIComponent(dealerId)}`}/>)}</div>:<Empty chip={null} title="Ingen miljö tillåter dealern ännu"/>}
    </Card>
  </div>;
}
