import {useEffect,useState} from 'react';
import Link, {navigate,useSearchParams} from '../../../runtime/navigation';
import {HubPage,Crumbs,Tabs,Chip,Card,Row,Empty,KV,Note,Steps,ActionMenu,PreviewFlyout} from '../ui/hub';
import {adminDealerTabs,adminDealerSteps} from '../../lib/admin-navigation';
import type {Workspace} from '../../lib/connected-studio.mjs';
import type {StudioProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import {dealerCoverage,dealerTemplates,dealerUses} from '../../lib/dealer-coverage.mjs';
import {DealerIdentityPortrait} from './dealer-identity-portrait';
import {WorkspaceTool} from './workspace-tools';
import {TaldriftPanel} from './taldrift-panel';
import {ResourceConnections} from './resource-connections';
import {SavedScenePreview} from './saved-scene-preview';

type Props={part:'head'|'tail';dealerId:string;tab:string;workspace:Workspace|null;saved:StudioProject|null};
const base=(dealerId:string)=>'/admin/dealers/'+encodeURIComponent(dealerId);

// The dealer nav: header with status, the seven steps, tabs. The clip map (Klippkarta, Röst och tal,
// Inställningar) is mounted by entry.tsx between head and tail so one instance serves all three tabs.
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
  const label=dealer?.label??trashed?.dealer.label??dealerId;
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
  if(part==='head')return <HubPage wide title={<><span className="hub-portrait big">{dealer?<DealerIdentityPortrait dealer={dealer} className="h-14 w-14"/>:label.slice(0,2).toUpperCase()}</span>{label}</>}
    chip={coverage?<Chip tone={coverage.complete?'ok':'warn'} dot>{coverage.complete?'Klipp och tal räcker för spel':'Inte godkänd'}</Chip>:trashed?<Chip tone="danger">I papperskorgen</Chip>:undefined}
    eyebrow={<Crumbs items={[{label:'Dealers',href:'/admin/dealers'},{label}]}/>}
    intro={workspace?dealer?`${uses.operators.length?`Används av ${uses.operators.map(row=>row.name).join(', ')}`:'Inte tilldelad något bolag'} · ${uses.rooms.length} spelbord · ${templates.length} scenmallar`:trashed?'Dealern ligger i papperskorgen. Återställ den under Dealers.':`Dealern ${dealerId} finns inte i registret.`:'Läser register…'}
    actions={<>
      {tab==='klipp'&&dealer&&<Link className="hub-btn primary" href={href('klipp',{panel:'intake'})}>Lägg till klipp</Link>}
      {dealer&&<ActionMenu name={label} actions={[
        {id:'approve',label:'Godkänn dealern',disabled:'Ett godkänd-fält finns inte i projektet ännu; checklistan under Inställningar visar vad som återstår.',onSelect:()=>{}},
        {id:'archive',label:'Arkivera',onSelect:()=>navigate(href('installningar'))},
        {id:'delete',label:'Radera permanent',tone:'danger',disabled:uses.rooms.length?`Används av ${uses.rooms.length} spelbord`:undefined,onSelect:()=>navigate(href('installningar'))},
      ]}/>}
    </>}>
    {dealer&&<Steps steps={steps}/>}
    <Tabs items={adminDealerTabs} active={tab} counts={coverage?{klipp:`${coverage.deal.bound+coverage.idle.bound+coverage.speech.bound}/${coverage.deal.total+coverage.idle.total+coverage.speech.total}`,anvands:uses.rooms.length}:{}}/>
    {tab==='klipp'&&coverage&&<p className="hub-coverage" style={{marginBottom:12}}><span>Krävs för publicering:</span><span>Giv <b>{coverage.deal.bound}/{coverage.deal.total}</b></span><span>Talfack <b>{coverage.speech.bound}/{coverage.speech.total}</b></span><span>Vila <b>{coverage.idle.bound}/{coverage.idle.total}</b></span><span className="hub-faint">· skoövergångar och {coverage.optional.total} repliker är frivilliga</span></p>}
    {tab==='installningar'&&coverage&&<ApprovalCard coverage={coverage} templates={templates}/>}
  </HubPage>;
  // Tail: what each tab shows below (or instead of) the clip map.
  if(!dealer)return null;
  return <div className="hub-page is-wide" style={{paddingTop:0}}>
    {tab==='klipp'&&<DealerPreview dealerId={dealer.id} templates={templates} saved={saved}/>}
    {talVisited&&<div className="hub-stack hub-mt-l" hidden={tab!=='tal'}>
      <Note tone="warn">Talkedjan är pausad till efter O03 och byggs då lika för alla dealers (text → röst → läppsynk per dealer). Dagens verktyg visas oförändrade ovan.</Note>
      <div className="hub-grid c2">
        <Card title="Tal vid inaktivitet" aside="Av · Automatiskt klipp · AI-tal"><Empty title="Inte anslutet · kommer med talkedjan efter O03" text="Fältet probePolicy finns bara på projektnivå (Astrids prob), inte per dealer. Inget sparas här förrän talkedjan generaliserats."/></Card>
        <Card title="Taldrift" aside="GPU-läget för tal i den här miljön"><TaldriftPanel/></Card>
      </div>
      <Card title="Svarsbibliotek" aside="dealerns inspelade svar i kategorier"><WorkspaceTool section="replies" overrides={{dealer:dealer.id}}/></Card>
      <Card title="Dialogtest" aside="chatten mot dealern">{query.get('verktyg')==='dialog'?<WorkspaceTool section="dealer-agent" overrides={{dealer:dealer.id}}/>:<p><Link className="hub-btn" href={href('tal',{verktyg:'dialog'})}>Öppna Dialogtest</Link> <span className="hub-small hub-muted">Chattar med dealerns sparade AI-inställningar, inte med inspelade tagningar.</span></p>}</Card>
    </div>}
    {tab==='landningar'&&<DealerLandings dealerId={dealer.id} templates={templates} saved={saved} dealTotal={coverage?.deal.total??0} dealBound={coverage?.deal.bound??0}/>}
    {tab==='anvands'&&<div className="hub-mt-l">
      <div className="hub-grid c3" style={{marginBottom:16}}>
        <Card title="Spelbord">{uses.rooms.length?<div className="hub-rows">{uses.rooms.map(room=><Row key={room.id} chip={<Chip tone={room.state==='live'?'ok':'warn'} dot>{room.state==='live'?'öppet':'pausat'}</Chip>} title={room.name} text={`${workspace!.catalog.administration.operators.find(row=>row.id===room.operatorId)?.name??room.operatorId} · ${room.published?'publicerat':'inte publicerat'}`} href={`/admin/rooms/${encodeURIComponent(room.id)}`}/>)}</div>:<p className="hub-muted hub-small">Inga spelbord använder dealern.</p>}</Card>
        <Card title="Bolag">{uses.operators.length?<div className="hub-rows">{uses.operators.map(operator=><Row key={operator.id} chip={<Chip>{operator.packageRevision===null?'ingen version':`version ${operator.packageRevision}`}</Chip>} title={operator.name} text="via spelbordens scenmallar" href={`/admin/companies/${encodeURIComponent(operator.id)}?flik=tilldelning`}/>)}</div>:<p className="hub-muted hub-small">Inte tilldelad något bolag.</p>}</Card>
        <Card title="Scenmallar">{templates.length?<div className="hub-rows">{templates.map(lane=><Row key={lane.id} chip={<Chip tone={lane.isDefault?'accent':''}>{lane.isDefault?'förval':'tillåten'}</Chip>} title={lane.label} text="layers.dealer.allowed" href={`/admin/scenes?tab=mallar&composition=${encodeURIComponent(lane.id)}&dealer=${encodeURIComponent(dealer.id)}`}/>)}</div>:<p className="hub-muted hub-small">Ingen scenmall tillåter dealern ännu.</p>}</Card>
      </div>
      <Card title="Alla kopplingar" aside="samma läsning som System › Beroenden"><ResourceConnections embedded context={'?dealer='+encodeURIComponent(dealer.id)}/></Card>
    </div>}
  </div>;
}

function ApprovalCard({coverage,templates}:{coverage:ReturnType<typeof dealerCoverage>;templates:{id:string}[]}) {
  const rows:[string,boolean|null][]=[
    [`Hela givbanken (${coverage.deal.bound}/${coverage.deal.total} fack)`,coverage.deal.total>0&&coverage.deal.bound===coverage.deal.total],
    [`Vila (${coverage.idle.bound}/${coverage.idle.total})`,coverage.idle.total>0&&coverage.idle.bound===coverage.idle.total],
    [`Talfack med standardtagning (${coverage.speech.bound}/${coverage.speech.total})`,coverage.speech.total>0&&coverage.speech.bound===coverage.speech.total],
    ['Landningar mätta (filmad profil)',null],
    [`Tillåten i minst en scenmall (${templates.length})`,templates.length>0],
  ];
  return <Card title="Godkännande" aside="krävs för att dealern ska kunna tilldelas" className="hub-mt">
    <div className="hub-rows">{rows.map(([text,ok])=><Row key={text} chip={ok===null?<Chip tone="warn">efter O03</Chip>:ok?<Chip tone="ok">klart</Chip>:<Chip tone="danger">saknas</Chip>} title={text}/>)}</div>
    <p className="hub-small hub-muted hub-mt">Checklistan är en läsvy. Projektet har inget fält för "godkänd" i dag, så inget sparas här; tilldelning sker under Bolag › Tilldelning. Landningarna mäts och sparas i Admin efter O03 (generaliseringsspåret); i dag ligger den filmade profilen i koden för dragan och paow.</p>
  </Card>;
}

function DealerPreview({dealerId,templates,saved}:{dealerId:string;templates:{id:string;label:string}[];saved:StudioProject|null}) {
  const [open,setOpen]=useState(false),[laneId,setLaneId]=useState('');
  const lane=templates.find(row=>row.id===laneId)??templates[0];
  return <PreviewFlyout title={'Förhandsvisning · sparad scen'} open={open} onOpenChange={setOpen}>
    <label className="studio-field">Scenmall<select value={lane?.id??''} onChange={event=>setLaneId(event.target.value)}>{templates.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
    {!templates.length&&<Empty chip={null} title="Ingen scenmall tillåter dealern" action={<Link className="hub-btn" href="/admin/scenes?tab=mallar">Till Scenmallar</Link>}/>}
    {lane&&<SavedScenePreview active={open} presentationLaneId={lane.id} revision={saved?.revision} dealerId={dealerId} game="blackjack"/>}
    <p className="hub-small hub-muted hub-mt">Provar den sparade scenmallens förval och bibliotek som spelaren får dem (delat bord, dator). Mobilvy kommer med generaliseringsspåret efter O03.</p>
  </PreviewFlyout>;
}

function DealerLandings({dealerId,templates,saved,dealTotal,dealBound}:{dealerId:string;templates:{id:string;label:string}[];saved:StudioProject|null;dealTotal:number;dealBound:number}) {
  const [open,setOpen]=useState(false);
  return <div className="hub-mt-l">
    <div className="hub-grid c2">
      <Card title="Filmad profil · var dealerns hand landar" aside={<Chip tone="warn">efter O03</Chip>}>
        <p className="hub-small hub-muted">Korten ritas där handen landar i filmen: <code>positions</code> 1–7 och dealer som {'{cx, cy}'}, plane 1080×1920 vid 24 fps och <code>takes[]</code> per mål och variant. Landningarna mäts och sparas i Admin efter O03 (generaliseringsspåret). I dag ligger den filmade profilen i koden för dragan och paow.</p>
        <KV items={[['Giv-klipp',`${dealBound}/${dealTotal} fack kopplade`],['Mobilram','3 av 7 platser i ett glidande fönster, ingen zoom'],['Mätt ur','giv-klippen: contactFrame, landFrame, clearFrame']]}/>
        <div className="hub-actions hub-mt"><button type="button" className="hub-btn" disabled title="efter O03 (generaliseringsspåret)">Mät landningar</button><button type="button" className="hub-btn ink" disabled title="efter O03 (generaliseringsspåret)">Exportera landningsmall</button><span className="hub-small hub-muted">efter O03 (generaliseringsspåret)</span></div>
      </Card>
      <Card title="Så ser det ut i scenen" aside="dator">
        {templates.length?<><button type="button" className="hub-btn" onClick={()=>setOpen(value=>!value)} aria-expanded={open}>{open?'Stäng förhandsvisningen':'Provspela sparad scen'}</button>{open&&<SavedScenePreview active presentationLaneId={templates[0].id} revision={saved?.revision} dealerId={dealerId} game="blackjack"/>}</>:<Empty chip={null} title="Ingen scenmall tillåter dealern ännu" action={<Link className="hub-btn" href="/admin/scenes?tab=mallar">Till Scenmallar</Link>}/>}
        <p className="hub-small hub-muted hub-mt">Bordsgrafiken ritas efter dealern, inte dealern efter bordet. Lagrens skala och läge ändras under <Link href="/admin/scenes?tab=mallar">Scenmallar</Link>, inte här.</p>
      </Card>
    </div>
    <Card title="Scenmallar som tillåter dealern" className="hub-mt-l" aside={<Link href="/admin/scenes?tab=mallar">Scenmallar →</Link>}>
      {templates.length?<div className="hub-rows">{templates.map(lane=><Row key={lane.id} chip={<Chip>scenmall</Chip>} title={lane.label} text="layers.dealer.allowed" href={`/admin/scenes?tab=mallar&composition=${encodeURIComponent(lane.id)}&dealer=${encodeURIComponent(dealerId)}`}/>)}</div>:<Empty chip={null} title="Ingen scenmall tillåter dealern ännu"/>}
    </Card>
  </div>;
}
