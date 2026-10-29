import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ArrowRight,ExternalLink,Plus,Presentation,RotateCcw} from 'lucide-react';
import Link, {navigate,useSearchParams} from '../../../runtime/navigation';
import {HubPage,Crumbs,Tabs,Chip,Card,Row,Empty,KV,Note,PreviewFlyout,ActionMenu,AsideLink} from '../ui/hub';
import {Button,buttonVariants,chipVariants,cn,EmptyState,Footnote,formatDate,formatNumber,Loading,plural,TechnicalDetails} from '../ui/kit';
import {Dialog,DialogSteps,Sheet} from '../ui/dialog';
import {fieldClass} from '../ui/form';
import {DataTable,type Column} from '../ui/data-table';
import {insetTableClass} from '../ui/table';
import {companyListGroups} from '../../lib/studio-resource-lifecycle.mjs';
import {adminCompanyListTabs,adminCompanyTabs,adminRoomTabs,adminTabId} from '../../lib/admin-navigation';
import {createStudioClient,type Catalog,type Workspace} from '../../lib/connected-studio.mjs';
import {dealerChoices,defaultLanguage,laneChoices,QUICK_CREATE_STEPS,quickCreateDefaults,roomName,runQuickCreate,type QuickChoice,type QuickMemo,type QuickStepId,type QuickStepStatus} from '../../lib/room-quick-create.mjs';
import {roomLimitProfiles} from '../../../../lib/room-limit-profiles.mjs';
import type {StudioProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import type {AppearanceRoomStatus} from '../../../../components/partner-appearance';
import {RegisteredStudio} from './registered-studio';
import {AssignmentField} from './assignment-field';
import {WorkspaceTool} from './workspace-tools';
import {ScenePreview} from './scene-preview';
import {RoomPicture} from './room-picture';
import {RoomSettingsWarning,RoomStateChip} from './room-settings-warning';
import {DealerAvatar,DealerFaces} from './dealer-identity-portrait';
import {ControlResourceLifecycle} from '../../../../components/control-resource-lifecycle';
import {PartnerJournal} from '../../../../components/partner-journal-loader.mjs';
import {TrashPermanentDelete} from './permanent-delete';

type Props={page:'companies'|'company'|'room';id:string;active:boolean;disabled:boolean;onChanged:()=>void};
type Operator=Catalog['administration']['operators'][number];type Room=Catalog['administration']['rooms'][number];
// Status chips in the direction's tones: live (öppet, aktivt, publicerat), warn (pausat, avstängt) and the
// neutral pair for a draft or the trash (hollow dot), never the error tone for an ordinary state.
// An open room without published game settings reads "förbereds" (room-settings-warning.tsx).
const stateChip=(room:Room)=><RoomStateChip room={room}/>;
const publishedChip=(room:Room)=>room.published?<Chip tone="live">publicerat</Chip>:<Chip tone="draft">inte publicerat</Chip>;
const operatorChip=(operator:Operator)=><Chip tone={operator.archivedAt?'off':operator.status==='active'?'live':'warn'} dot>{operator.archivedAt?'i papperskorgen':operator.status==='active'?'aktivt':'avstängt'}</Chip>;
const companyHref=(operator:Pick<Operator,'id'>,flik='tilldelning')=>`/admin/companies/${encodeURIComponent(operator.id)}?flik=${flik}`;
const roomHref=(room:Room,flik='utseende')=>`/admin/rooms/${encodeURIComponent(room.id)}?flik=${flik}`;
const games:Record<string,string>={blackjack:'Blackjack',roulette:'Roulette'};
const gameLabel=(game:string|undefined)=>games[game??'']??'Spel';
const version=(operator:Operator)=>operator.packageRevision===null?'ingen publicering':`version ${operator.packageRevision}`;
const linkClass='font-semibold text-sg-text no-underline hover:underline';
const pill=(on:boolean)=>chipVariants({selected:on});
const trashBase='/admin/companies?tab=papperskorg';

// Bolag och spelbord: the company list and all rooms (two tabs), one nav per company and the room editor.
// Reads the registered catalog once per visit; the editors read their own contracts as before.
export function CompaniesPage({page,id,active,disabled,onChanged}:Props) {
  const query=useSearchParams();
  const [catalog,setCatalog]=useState<Catalog|null>(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
  const [roomStatus,setRoomStatus]=useState<AppearanceRoomStatus|null>(null);
  // Embedded tools with their own drafts (Team) stay mounted once visited while this page is shown.
  const tabKey=page+':'+id+':'+(query.get('flik')??'');
  const [visited,setVisited]=useState<string[]>([]);
  useEffect(()=>{if(active)setVisited(current=>current.includes(tabKey)?current:[...current,tabKey]);},[active,tabKey]);
  useEffect(()=>{
    if(!active)return;
    const controller=new AbortController();setError('');
    void (async()=>{try{
      const response=await fetch('/admin/_data/catalog',{credentials:'same-origin',cache:'no-store',redirect:'error',headers:{accept:'application/json'},signal:controller.signal});
      if(!response.ok)throw Error([401,403].includes(response.status)?'Din inloggning saknas eller har gått ut.':'Katalogen kunde inte läsas.');
      const value=await response.json();
      if(value.source!=='registered'||!Array.isArray(value.administration?.operators))throw Error('Katalogens form kunde inte verifieras.');
      if(!controller.signal.aborted)setCatalog(value);
    }catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Katalogen kunde inte läsas.');}})();
    return()=>controller.abort();
  },[active,refresh,page,id]);
  useEffect(()=>{setRoomStatus(null);},[page,id]);
  const changed=()=>{setRefresh(value=>value+1);onChanged();};
  const operators=catalog?.administration.operators??[],compositions=catalog?.administration.compositions??[];
  // The saved project revision that "Provspela sparad scen" starts against (room preview and Nytt spelbord).
  const revision=catalog?.administration.revisions?.project;
  // Archived rooms stay with their company until restored through the rooms lifecycle; companies in the
  // trash (archivedAt) are listed only under Papperskorg, beside the archived rooms.
  const groups=companyListGroups(operators,catalog?.administration.rooms??[]);
  const rooms=groups.rooms,archived=groups.trashRooms,liveOperators=groups.companies,archivedOperators=groups.trashCompanies;
  const operatorName=(operatorId:string)=>operators.find(row=>row.id===operatorId)?.name??'Okänt bolag';
  const laneLabel=(laneId:string)=>compositions.find(row=>row.id===laneId)?.name??'Okänd miljö';
  const status=error?<p role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-sg-warn-bg px-3.5 py-2.5 text-[13px] text-sg-warn">{error} <button type="button" className={buttonVariants({size:'sm'})} onClick={()=>setRefresh(value=>value+1)}>Försök igen</button></p>:!catalog?<div className="mb-4 rounded-xl border border-sg-border bg-sg-surface p-5 shadow-sg"><Loading label="Läser katalogen…" rows={4}/></div>:null;
  const roomColumns=(withOperator:boolean):Column<Room>[]=>[
    {id:'name',header:'Spelbord',sort:room=>room.name,cell:room=><span className="flex items-center gap-3"><RoomPicture room={room} className="h-10 w-16 max-md:h-9 max-md:w-14"/><span className="min-w-0"><Link className={linkClass} href={roomHref(room)}>{room.name}</Link><span className="block text-[12.5px] text-sg-muted">{gameLabel(room.game)}</span></span></span>},
    ...(withOperator?[{id:'operator',header:'Bolag',sort:(room:Room)=>operatorName(room.operatorId),cell:(room:Room)=><Link className="text-sg-text no-underline hover:underline" href={companyHref({id:room.operatorId},'spelbord')}>{operatorName(room.operatorId)}</Link>}]:[]),
    {id:'dealers',header:'Dealer',sort:room=>room.dealers.map(dealer=>dealer.name).join(', '),cell:room=><DealerFaces dealers={room.dealers.map(dealer=>({id:dealer.id,label:dealer.name}))}/>},
    {id:'scene',header:'Miljö',sort:room=>laneLabel(room.compositionId),cell:room=>laneLabel(room.compositionId)},
    {id:'state',header:'Läge',sort:room=>room.state,cell:room=><span className="grid justify-items-start gap-1">{stateChip(room)}<RoomSettingsWarning room={room} compact/></span>},
    {id:'published',header:'Publicerat',sort:room=>room.published?1:0,cell:publishedChip},
    {id:'open',header:<span className="sr-only">Åtgärder</span>,align:'right',cell:room=><Link className={buttonVariants({size:'sm'})} href={roomHref(room)}>Öppna</Link>},
  ];

  if(page==='companies'){
    const tab=adminTabId('companies',query.get('tab')),filter=query.get('operator')??'',create=query.get('view')==='create';
    const list=filter?rooms.filter(room=>room.operatorId===filter):rooms;
    const createOperator=operators.find(row=>row.id===filter&&row.status==='active'&&!row.archivedAt)??operators.find(row=>row.status==='active'&&!row.archivedAt);
    const filters=(base:string,choices:Operator[],className='mb-4')=><div className={cn('flex flex-wrap gap-2',className)} role="group" aria-label="Filtrera på bolag"><Link href={base} className={pill(!filter)} aria-current={!filter?'true':undefined}>Alla bolag</Link>{choices.map(operator=><Link key={operator.id} href={base+'&operator='+encodeURIComponent(operator.id)} className={pill(filter===operator.id)} aria-current={filter===operator.id?'true':undefined}>{operator.name}</Link>)}</div>;
    // Papperskorg: no status chip (the tab says it), the archive date and count on one quiet line, Återställ
    // as a ghost action. A room is restored in the side panel (restore=<company>) through the rooms lifecycle.
    const trashOwners=operators.filter(row=>archived.some(room=>room.operatorId===row.id));
    const trashList=filter?archived.filter(room=>room.operatorId===filter):archived;
    const archivedRooms=(operatorId:string)=>archived.filter(room=>room.operatorId===operatorId).length;
    const trashHref=(extra='')=>trashBase+(filter?'&operator='+encodeURIComponent(filter):'')+extra;
    const restoring=tab==='papperskorg'?operators.find(row=>row.id===query.get('restore')):undefined;
    const ghost=buttonVariants({variant:'ghost',size:'sm'});
    return <HubPage eyebrow="Bolag" title="Bolag och spelbord" intro="Varje bolag har ett eget nav: tilldelning, spelbord, spelare, team, integration och journal. Alla bolags spelbord finns på en flik."
      actions={tab==='bolag'?<Link className={buttonVariants({variant:'primary'})} href="/admin/companies?tab=bolag&view=create"><Plus aria-hidden="true"/>Nytt bolag</Link>:tab==='spelbord'?<Link className={buttonVariants({variant:'primary'})} href={'/admin/companies?tab=spelbord&view=create'+(filter?'&operator='+encodeURIComponent(filter):'')}><Plus aria-hidden="true"/>Nytt spelbord</Link>:undefined}
      tabs={<Tabs items={adminCompanyListTabs} active={tab} param="tab" counts={catalog?groups.counts:{}}/>}
      note={tab==='papperskorg'?'Arkiverat ligger kvar tills det återställs. Ett bolag återställs under bolagets Inställningar; ett spelbord kommer tillbaka pausat och öppnas under Tillgänglighet.':undefined}>
      {status}
      {tab==='bolag'&&<>
        <Dialog open={create} size="lg" title="Nytt bolag" description="Skapa bolaget och bjud in dess första administratör. Sedan väljer du vad bolaget får använda under Tilldelning." onClose={()=>navigate('/admin/companies?tab=bolag')}
          footer={<><Button onClick={()=>navigate('/admin/companies?tab=bolag')}>Stäng</Button>{operators[0]&&<Link className={buttonVariants({variant:'primary'})} href={companyHref(operators[operators.length-1])}>Till bolagets tilldelning<ArrowRight aria-hidden="true"/></Link>}</>}>
          <DialogSteps steps={['Namn och administratör','Tilldelning']} current={0}/>{create&&<WorkspaceTool section="companies"/>}
        </Dialog>
        {catalog&&<Card><DataTable label="Bolag" rows={liveOperators} rowKey={row=>row.id} filter={{placeholder:'Sök bolag',text:row=>row.name}} initialSort={{id:'name',dir:'asc'}} empty={archivedOperators.length?'Inga aktiva bolag. Arkiverade bolag finns under Papperskorg.':'Inga bolag i registret.'} columns={[
          {id:'name',header:'Bolag',sort:row=>row.name,cell:operator=><Link className={linkClass} href={companyHref(operator)}>{operator.name}</Link>},
          {id:'status',header:'Status',sort:row=>row.status==='active'?0:1,cell:operatorChip},
          {id:'package',header:'Tilldelning',sort:row=>row.packageRevision??-1,cell:version},
          {id:'rooms',header:'Spelbord',numeric:true,sort:row=>rooms.filter(room=>room.operatorId===row.id).length,cell:operator=>formatNumber(rooms.filter(room=>room.operatorId===operator.id).length)},
          {id:'actions',header:<span className="sr-only">Åtgärder</span>,align:'right',cell:operator=><span className="inline-flex items-center gap-2"><a className={buttonVariants({variant:'ghost',size:'sm'})} href={'/partner/'+encodeURIComponent(operator.slug)}>Partnerportalen<ExternalLink aria-hidden="true"/></a><Link className={buttonVariants({size:'sm'})} href={companyHref(operator)}>Öppna</Link></span>},
        ]}/></Card>}
      </>}
      {tab==='spelbord'&&<>
        {filters('/admin/companies?tab=spelbord',operators.filter(row=>!row.archivedAt))}
        {create&&!createOperator&&<Empty chip={null} title="Inget aktivt bolag" text="Skapa ett bolag först."/>}
        <CreateRoomDialog open={create&&Boolean(createOperator)} operators={operators.filter(row=>row.status==='active'&&!row.archivedAt)} initialOperator={createOperator?.id??''} disabled={disabled} onChanged={changed}
          onClose={()=>navigate('/admin/companies?tab=spelbord'+(filter?'&operator='+encodeURIComponent(filter):''))}/>
        {catalog&&<Card><DataTable label="Spelbord" rows={list} rowKey={row=>row.id} columns={roomColumns(true)} filter={{placeholder:'Sök spelbord, bolag eller dealer',text:room=>[room.name,operatorName(room.operatorId),...room.dealers.map(dealer=>dealer.name),laneLabel(room.compositionId)].join(' ')}} empty={`Inga spelbord${filter?' hos bolaget':''}.`}/></Card>}
      </>}
      {tab==='papperskorg'&&catalog&&<div className="grid gap-4" data-trash="">
        {!archivedOperators.length&&!archived.length&&<EmptyState title="Papperskorgen är tom" text="Arkiverade bolag och spelbord hamnar här och kan återställas." action={<Link className={buttonVariants({size:'sm'})} href="/admin/companies?tab=spelbord">Till alla spelbord</Link>}/>}
        {archivedOperators.length>0&&<Card flush title="Arkiverade bolag" aside={plural(archivedOperators.length,'bolag','bolag')}><DataTable label="Arkiverade bolag" className={insetTableClass} rows={archivedOperators} rowKey={row=>row.id} initialSort={{id:'name',dir:'asc'}} columns={[
          {id:'name',header:'Bolag',sort:row=>row.name,cell:operator=><><Link className={linkClass} href={companyHref(operator,'installningar')}>{operator.name}</Link>
            <div className="text-[12.5px] text-sg-muted">{[operator.archivedAt?'Arkiverat '+formatDate(operator.archivedAt):'',plural(archivedRooms(operator.id),'spelbord','spelbord')].filter(Boolean).join(' · ')}</div></>},
          {id:'restore',header:<span className="sr-only">Åtgärder</span>,align:'right',cell:operator=><Link className={ghost} href={companyHref(operator,'installningar')} aria-label={'Återställ '+operator.name}><RotateCcw aria-hidden="true"/>Återställ</Link>},
        ]}/></Card>}
        {archived.length>0&&<Card flush title="Arkiverade spelbord" aside={trashOwners.length>1||filter?filters(trashBase,trashOwners,''):plural(archived.length,'spelbord','spelbord')}>{trashList.length?<DataTable label="Arkiverade spelbord" className={insetTableClass} rows={trashList} rowKey={row=>row.id} initialSort={{id:'name',dir:'asc'}} columns={[
          {id:'name',header:'Spelbord',sort:room=>room.name,cell:room=><><span className="font-semibold">{room.name}</span><div className="text-[12.5px] text-sg-muted">{gameLabel(room.game)} · {laneLabel(room.compositionId)}</div></>},
          {id:'operator',header:'Bolag',sort:room=>operatorName(room.operatorId),cell:room=><Link className="text-sg-text no-underline hover:underline" href={companyHref({id:room.operatorId},'spelbord')}>{operatorName(room.operatorId)}</Link>},
          {id:'restore',header:<span className="sr-only">Åtgärder</span>,align:'right',cell:room=><Link className={ghost} href={trashHref('&restore='+encodeURIComponent(room.operatorId))} aria-label={'Återställ '+room.name}><RotateCcw aria-hidden="true"/>Återställ</Link>},
        ]}/>:<EmptyState className="m-5" title="Bolaget har inga arkiverade spelbord" action={<Link className={buttonVariants({size:'sm'})} href={trashBase}>Visa alla bolag</Link>}/>}</Card>}
        {archivedOperators.length>0&&!archived.length&&<EmptyState title="Inga arkiverade spelbord" text="Ett arkiverat spelbord hamnar här och kommer tillbaka pausat när det återställs." action={<Link className={buttonVariants({size:'sm'})} href="/admin/companies?tab=spelbord">Till alla spelbord</Link>}/>}
        <Sheet open={Boolean(restoring)} title={'Återställ hos '+(restoring?.name??'bolaget')} description="Spelbordet kommer tillbaka pausat." onClose={()=>navigate(trashHref())}>
          {restoring&&<RoomTrash key={restoring.id} operatorId={restoring.id} disabled={disabled} onChanged={changed}/>}
        </Sheet>
        <TrashPermanentDelete disabled={disabled} onChanged={changed}/>
      </div>}
    </HubPage>;
  }

  if(page==='company'){
    const operator=operators.find(row=>row.id===id||row.slug===id);
    const tab=adminTabId('company',query.get('flik')),create=query.get('view')==='create';
    const own=operator?rooms.filter(room=>room.operatorId===operator.id):[];
    return <HubPage eyebrow={<Crumbs items={[{label:'Bolag och spelbord',href:'/admin/companies'},{label:operator?.name??'Bolag'}]}/>} title={operator?.name??'Bolag'} chip={operator?operatorChip(operator):undefined}
      intro={operator?`${operator.packageRevision===null?'Ingen publicerad tilldelning':`Tilldelning version ${operator.packageRevision}`} · ${plural(own.length,'spelbord','spelbord')}`:catalog?<span data-not-found="company">{`Bolaget ${id} finns inte i registret.`}</span>:'Läser katalogen…'}
      actions={operator&&<><Link className={buttonVariants()} href="/admin/demo"><Presentation aria-hidden="true"/>Skapa demo</Link><a className={buttonVariants()} href={'/partner/'+encodeURIComponent(operator.slug)}>Öppna Partnerportalen<ExternalLink aria-hidden="true"/></a></>}>
      <Tabs items={adminCompanyTabs} active={tab} counts={operator?{spelbord:own.length}:{}}/>
      {status}
      {operator&&<>
        {tab==='tilldelning'&&<><Note tone="accent" className="mb-4">Bolaget får en uppsättning miljöer att välja bland. Dealers, bakgrunder och bordsgrafik följer med via miljöerna. Vad bolaget får ändra själv väljer du under Tilldelat bolaget.</Note><div className="mb-4"><AssignmentField operatorId={operator.id} revision={operator.packageRevision} view={operator.assignment} disabled={disabled} onChanged={changed}/></div><RegisteredStudio mode="package" operatorId={operator.id} disabled={disabled} onChanged={changed}/></>}
        {tab==='spelbord'&&<Card title="Bolagets spelbord" aside={<Link className={buttonVariants({variant:'primary',size:'sm'})} href={companyHref(operator,'spelbord')+'&view=create'}><Plus aria-hidden="true"/>Nytt spelbord</Link>}>
          <CreateRoomDialog open={create} operators={[operator]} initialOperator={operator.id} fixedOperator disabled={disabled} onChanged={changed} onClose={()=>navigate(companyHref(operator,'spelbord'))}/>
          {own.length?<DataTable label="Bolagets spelbord" rows={own} rowKey={row=>row.id} columns={roomColumns(false)}/>:<Empty chip={null} title="Inga spelbord" text="Nytt spelbord väljer dealer, miljö och språk åt dig och publicerar allt i ett steg."/>}
        </Card>}
        {tab==='spelbord'&&<Card title="Papperskorg" aside={`${plural(archived.filter(room=>room.operatorId===operator.id).length,'arkiverat spelbord','arkiverade spelbord')} · återställs pausade`} className="mt-4"><RoomTrash operatorId={operator.id} disabled={disabled} onChanged={changed}/></Card>}
        {tab==='spelare'&&<div className="grid gap-4 md:grid-cols-2">
          <Card title="Spelare"><Empty title="Inte anslutet ännu" text="Spelare är inte knutna till bolag ännu; det kommer senare. Tills dess finns alla spelarkonton under System." action={<Link className={buttonVariants()} href="/admin/system?flik=spelare">Spelarkonton under System</Link>}/></Card>
          <Card title="Rundor och omsättning per spelbord"><Empty title="Inte anslutet ännu" text="Rundor och insatser per spelbord visas inte i Admin ännu. Ekonomin för alla bolag finns under System, fliken Spelarkonton."/></Card>
        </div>}
        <div hidden={tab!=='team'}>{visited.includes('company:'+id+':team')&&<><Footnote className="mb-3 mt-0">Team, roller och inbjudningar. Administratören utses bara av Admin; den sista administratören kan inte stängas av.</Footnote><WorkspaceTool section="companies" overrides={{operator:operator.id}}/></>}</div>
        {tab==='integration'&&<div className="grid gap-4 md:grid-cols-2">
          <Card title="API-nycklar"><p className="m-0 text-[13.5px]">Varje nyckel hör till ett bolag. Bolaget väljer du när du skapar nyckeln under System, fliken Integration; listan visar bolaget per nyckel.</p><p className="mb-0 mt-3"><Link className={buttonVariants()} href="/admin/system?flik=integration">Integration under System</Link></p></Card>
          <Card title="Startadresser" aside="Per spelbord">{own.filter(room=>room.playUrl).length?<KV items={own.filter(room=>room.playUrl).map(room=>[room.name,<code key={room.id} className="break-all rounded bg-sg-surface-2 px-1.5 py-0.5 font-mono text-xs">{room.playUrl}</code>] as [string,ReactNode])}/>:<p className="m-0 text-[12.5px] text-sg-muted">Inget spelbart spelbord ännu.</p>}</Card>
        </div>}
        {tab==='journal'&&<Card title="Journal" aside="Bolagets händelser och utseendeutkast"><PartnerJournal base="/studio/api/partner" operatorSlug={operator.slug} operatorId={operator.id}/></Card>}
        {tab==='installningar'&&<div className="grid gap-4 md:grid-cols-2">
          <Card title="Bolag"><KV items={[['Namn',operator.name],['Status',operatorChip(operator)],['Tilldelning',version(operator)]]}/><Footnote>Namnet ändras inte från Admin i dag.</Footnote></Card>
          <Card title="Livscykel" aside="Stäng av, papperskorg, återställ"><ControlResourceLifecycle operatorId={operator.id} kind="operator" available disabled={disabled} onChanged={changed}/></Card>
        </div>}
        <TechnicalDetails items={[['Bolags-id',operator.id],['Adress i Partnerportalen','/partner/'+operator.slug]]}/>
      </>}
    </HubPage>;
  }

  const room=rooms.find(row=>row.id===id)??catalog?.administration.rooms.find(row=>row.id===id);
  const operator=room?operators.find(row=>row.id===room.operatorId):undefined;
  const tab=adminTabId('room',query.get('flik'));
  const status_=roomStatus&&room&&roomStatus.roomId===room.id?roomStatus:null;
  // One status line: game, dealer, scene template, the published version and whether a draft waits.
  const facts=room?[gameLabel(room.game),room.dealers.map(dealer=>dealer.name).join(', ')||'ingen dealer',laneLabel(room.compositionId),
    room.published?`publicerat${operator?.packageRevision!=null?` i version ${operator.packageRevision}`:''}`:'inte publicerat',
    ...(status_?[status_.draft?'sparat utkast väntar på publicering':'inget opublicerat utkast']:[])]:[];
  return <HubPage eyebrow={<Crumbs items={[{label:'Bolag och spelbord',href:'/admin/companies?tab=spelbord'},...(operator?[{label:operator.name,href:companyHref(operator,'spelbord')}]:[]),{label:room?.name??'Spelbord'}]}/>}
    title={room?<span className="inline-flex min-w-0 items-center gap-4"><RoomPicture room={room} className="h-12 w-20 max-md:h-10 max-md:w-16"/><span className="min-w-0">{room.name}</span></span>:'Spelbord'} chip={room?<>{stateChip(room)}{status_?.draft&&<Chip tone="info">utkast</Chip>}</>:undefined}
    intro={room?facts.join(' · '):catalog?<span data-not-found="room">{`Spelbordet ${id} finns inte i registret.`}</span>:'Läser katalogen…'}
    actions={room&&<>
      {room.playUrl&&<a className={buttonVariants()} href={room.playUrl} target="_blank" rel="noopener">Öppna i spelet<ExternalLink aria-hidden="true"/></a>}
      <ActionMenu name={room.name} actions={[
        {id:'state',label:room.state==='live'?'Pausa spelbordet':'Öppna spelbordet',onSelect:()=>navigate(roomHref(room,'tillganglighet'))},
        {id:'game',label:'Spelinställningar',onSelect:()=>navigate(roomHref(room,'spel'))},
        {id:'history',label:'Historik',onSelect:()=>navigate(roomHref(room,'historik'))},
        {id:'company',label:'Till bolaget',onSelect:()=>navigate(companyHref({id:room.operatorId},'spelbord'))},
      ]}/>
    </>}>
    <Tabs items={adminRoomTabs} active={tab}/>
    {status}
    {room&&tab!=='spel'&&<RoomSettingsWarning room={room} className="mb-4"/>}
    {room&&operator&&<>
      {tab==='utseende'&&<RegisteredStudio mode="room" section="appearance" operatorId={operator.id} roomId={room.id} disabled={disabled} onChanged={changed} onRoomStatus={setRoomStatus}/>}
      {tab==='dealer'&&<Card title="Dealer" aside={plural(room.dealers.length,'dealer','dealers')+' i spelbordets miljö'}>
        <Note>Dealern väljs under Utseende tillsammans med bakgrund och bordsgrafik, i bolagets utkast. Vilka dealers som kan väljas styrs av miljön.</Note>
        <div className="mt-3 grid">{room.dealers.map(dealer=><Row key={dealer.id} chip={<DealerAvatar dealer={{id:dealer.id,label:dealer.name}} size={44} motion={false}/>} title={<span className="inline-flex flex-wrap items-center gap-2">{dealer.name}<Chip tone={room.dealerSource==='published'?'ok':''}>{room.dealerSource==='published'?'publicerad':'sparad'}</Chip></span>} text="Klipp, tal och landningar finns på dealerns sida" href={`/admin/dealers/${encodeURIComponent(dealer.id)}?flik=klipp`}/>)}{!room.dealers.length&&<p className="m-0 text-[12.5px] text-sg-muted">Miljön tillåter ingen dealer ännu.</p>}</div>
      </Card>}
      {tab==='spel'&&<RegisteredStudio mode="room" section="game" operatorId={operator.id} roomId={room.id} disabled={disabled} onChanged={changed}/>}
      {tab==='tillganglighet'&&<><Note className="mb-4">Pausa gäller direkt. Ett pausat spelbord syns inte i lobbyn och pågående rundor spelas klart.</Note><RegisteredStudio mode="room" section="state" operatorId={operator.id} roomId={room.id} disabled={disabled} onChanged={changed}/></>}
      {tab==='bolagets-val'&&<OperatorAdjustable laneId={room.compositionId} operator={operator} active={active&&tab==='bolagets-val'}/>}
      {tab==='historik'&&<Card title="Historik" aside="Bolagets publiceringar och utkast"><Footnote className="mb-3 mt-0">Journalen gäller hela bolaget; raderna för det här spelbordet nämner dess namn.</Footnote><PartnerJournal base="/studio/api/partner" operatorSlug={operator.slug} operatorId={operator.id}/></Card>}
      <TechnicalDetails items={[['Spelbords-id',room.id],['Miljö-id',room.compositionId],['Spellane-id',room.laneId],['Bolags-id',room.operatorId]]}/>
      <RoomPreview room={room} revision={revision}/>
    </>}
  </HubPage>;
}

// Nytt spelbord på ett steg (lib/room-quick-create.mjs): allt är förvalt och går att ändra under Avancerat;
// Skapa och publicera kör kedjan (miljö → mät klipp → spelbord och tilldelning → spelinställningar) och
// stannar med en mening och en knapp. Spelbordet skapas öppet och spelbart när kedjan går igenom.
const limitLabels=Object.fromEntries(roomLimitProfiles().map(row=>[row.id,row.label]));
const stepChip:Record<QuickStepStatus,ReactNode>={running:<Chip tone="info">pågår</Chip>,done:<Chip tone="live">klart</Chip>,skipped:<Chip tone="draft">behövs inte</Chip>,stopped:<Chip tone="warn">hinder</Chip>};
type QuickResult=Awaited<ReturnType<typeof runQuickCreate>>;
// The page's own fetch, read at call time (tests run the page with a stubbed one).
const request:typeof fetch=(input,init)=>fetch(input,init);
export function CreateRoomDialog({open,operators,initialOperator,fixedOperator=false,disabled,onChanged,onClose}:{open:boolean;operators:Operator[];initialOperator:string;fixedOperator?:boolean;disabled:boolean;onChanged:()=>void;onClose:()=>void}) {
  const [operatorId,setOperatorId]=useState(initialOperator),[workspace,setWorkspace]=useState<Workspace|null>(null),[loadError,setLoadError]=useState(''),[reload,setReload]=useState(0);
  const [choice,setChoice]=useState<QuickChoice|null>(null),[steps,setSteps]=useState<Partial<Record<QuickStepId,{status:QuickStepStatus;text:string}>>>({});
  const [result,setResult]=useState<QuickResult|null>(null),[busy,setBusy]=useState(false);
  const memo=useRef<QuickMemo>({}),abort=useRef<AbortController|null>(null);
  useEffect(()=>{if(open)setOperatorId(initialOperator);},[open,initialOperator]);
  useEffect(()=>{
    if(!open)return;
    const controller=new AbortController();setWorkspace(null);setLoadError('');setSteps({});setResult(null);memo.current={};
    createStudioClient({fetchImpl:request}).load(controller.signal).then(value=>{if(!controller.signal.aborted)setWorkspace(value);},cause=>{if(!controller.signal.aborted)setLoadError(cause instanceof Error?cause.message:'Uppgifterna kunde inte läsas.');});
    return()=>controller.abort();
  },[open,reload]);
  useEffect(()=>{
    if(!workspace||!operatorId)return;
    const picked=quickCreateDefaults({catalog:workspace.catalog,project:workspace.project,inventory:workspace.inventory,operatorId});
    setChoice(picked);memo.current={};
    const controller=new AbortController();
    void defaultLanguage({catalog:workspace.catalog,operatorId},{fetchImpl:request,signal:controller.signal}).then(language=>{if(!controller.signal.aborted)setChoice(current=>current&&current.language===picked.language?{...current,language}:current);});
    return()=>controller.abort();
  },[workspace,operatorId]);
  const operator=workspace?.catalog.administration.operators.find(row=>row.id===operatorId)??operators.find(row=>row.id===operatorId);
  const dealers=workspace?dealerChoices(workspace.project,workspace.inventory):[];
  const dealerLabel=(id:string)=>dealers.find(row=>row.id===id)?.label??id;
  const lanes=workspace&&choice?laneChoices({catalog:workspace.catalog,project:workspace.project,operatorId,dealerId:choice.dealerId}):[];
  const finished=Boolean(result?.ok),locked=busy||finished;
  function change(patch:Partial<QuickChoice>){
    if(!workspace||!choice||locked)return;
    const next={...choice,...patch};
    if(patch.dealerId!==undefined)next.laneId=laneChoices({catalog:workspace.catalog,project:workspace.project,operatorId,dealerId:next.dealerId})[0]?.id??'';
    if(patch.dealerId!==undefined||patch.game!==undefined)next.name=roomName({catalog:workspace.catalog,operatorId,dealerId:next.dealerId,dealerLabel:dealerLabel(next.dealerId),game:next.game});
    memo.current={};setSteps({});setResult(null);setChoice(next);
  }
  async function start(){
    if(!choice||!operator||disabled||busy)return;
    const controller=new AbortController();abort.current=controller;setBusy(true);setResult(null);setSteps({});
    try{
      const value=await runQuickCreate({...choice,name:choice.name.trim()},{operator,memo:memo.current,signal:controller.signal,fetchImpl:request,onStep:(id,status,text)=>setSteps(current=>({...current,[id]:{status,text}}))});
      setResult(value);if(value.ok||memo.current.room)onChanged();
    }finally{setBusy(false);abort.current=null;}
  }
  const stop=result&&!result.ok?result:null;
  const select=(label:string,value:string,onChange:(value:string)=>void,options:[string,string][])=><label className="grid gap-1.5 text-[13px] font-semibold">{label}
    <select className={fieldClass} value={value} disabled={locked} onChange={event=>onChange(event.target.value)}>{options.map(([id,text])=><option key={id} value={id}>{text}</option>)}</select></label>;
  return <Dialog open={open} size="lg" busy={busy} title={operator?`Nytt spelbord hos ${operator.name}`:'Nytt spelbord'} onClose={()=>{abort.current?.abort();onClose();}}
    description="Allt är förvalt. Skapa och publicera gör resten: spelbordet blir öppet och spelbart, och visas som förbereds bara om ett steg stannar."
    footer={<>{busy?<Button onClick={()=>abort.current?.abort()}>Avbryt</Button>:<Button onClick={onClose}>{finished?'Stäng':'Avbryt'}</Button>}
      {result?.ok?<><Link className={buttonVariants()} href={result.roomHref}>Öppna spelbordet</Link><a className={buttonVariants({variant:'primary'})} href={result.playUrl} target="_blank" rel="noopener">Öppna i spelet<ExternalLink aria-hidden="true"/></a></>
        :stop?.href?<Link className={buttonVariants({variant:'primary'})} href={stop.href}>{stop.label}<ArrowRight aria-hidden="true"/></Link>
        :stop?.action?<Button variant="primary" disabled={disabled} onClick={()=>{if(stop.action==='reload')setReload(value=>value+1);else void start();}}>{stop.label}</Button>
        :<Button variant="primary" disabled={disabled||busy||!choice?.dealerId||!choice.name.trim()} onClick={()=>void start()}>{busy?'Skapar…':'Skapa och publicera'}</Button>}</>}>
    {loadError&&<p role="alert" className="m-0 flex flex-wrap items-center gap-3 rounded-lg bg-sg-warn-bg px-3.5 py-2.5 text-[13px] text-sg-warn">{loadError} <Button size="sm" onClick={()=>setReload(value=>value+1)}>Läs in igen</Button></p>}
    {disabled&&<Note className="mb-3">Klippkartan har osparade ändringar eller en import pågår. Spara eller vänta först.</Note>}
    {!workspace&&!loadError&&<Loading label="Väljer dealer, miljö och språk…" rows={3}/>}
    {workspace&&choice&&<div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label className="grid gap-1.5 text-[13px] font-semibold">Namn<input className={fieldClass} value={choice.name} maxLength={100} disabled={locked} onChange={event=>change({name:event.target.value})}/></label>
        <p className="m-0 self-end text-[13px] text-sg-muted">{[gameLabel(choice.game),dealerLabel(choice.dealerId)||'ingen dealer',lanes.find(row=>row.id===choice.laneId)?.label??'ny miljö',choice.language==='sv'?'svenska':'engelska',limitLabels[choice.limitPreset]??choice.limitPreset].join(' · ')}</p>
      </div>
      <details className="rounded-xl border border-sg-border bg-sg-surface-2 px-3.5 py-2.5"><summary className="cursor-pointer text-[13px] font-semibold">Avancerat</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {!fixedOperator&&operators.length>1&&select('Bolag',operatorId,value=>{if(!locked)setOperatorId(value);},operators.map(row=>[row.id,row.name]))}
          {select('Spel',choice.game,value=>change({game:value as QuickChoice['game']}),[['blackjack','Blackjack'],['roulette','Roulette · enkel nolla']])}
          {select('Dealer',choice.dealerId,value=>change({dealerId:value}),dealers.map(row=>[row.id,row.label+(row.complete?'':' · klippen räcker inte än')]))}
          {select('Miljö',choice.laneId,value=>change({laneId:value}),[...lanes.map(row=>[row.id,row.label] as [string,string]),['','Ny miljö för '+dealerLabel(choice.dealerId)]])}
          {choice.game==='blackjack'&&select('Bordsspråk',choice.language,value=>change({language:value as QuickChoice['language']}),[['en','Engelska'],['sv','Svenska']])}
          {choice.game==='blackjack'&&select('Insatsprofil',choice.limitPreset,value=>change({limitPreset:value as QuickChoice['limitPreset']}),Object.entries(limitLabels))}
        </div>
        <Footnote>En miljö som andra spelbord använder kopieras i stället för att ändras. Bakgrund och bordsgrafik följer miljöns standard.</Footnote>
      </details>
      {(busy||result)&&<ol className="m-0 grid list-none gap-1.5 p-0" aria-label="Kedjan">{QUICK_CREATE_STEPS.map(([id,label])=>{const row=steps[id];
        return <li key={id} data-step={id} className="flex flex-wrap items-center gap-2 text-[13px]">{row?stepChip[row.status]:<Chip tone="draft">väntar</Chip>}<span className="font-semibold">{label}</span>{row?.text&&<span className={row.status==='stopped'?'text-sg-warn':'text-sg-muted'}>{row.text}</span>}</li>;})}</ol>}
      {stop&&<p role="alert" className="m-0 text-[13px] text-sg-warn">{stop.text}</p>}
      {result?.ok&&<p role="status" className="m-0 text-[13px]"><strong className="font-semibold">{result.room.name} är öppet och publicerat.</strong> Spelare kan sätta sig nu.</p>}
    </div>}
  </Dialog>;
}

// The company's archived rooms with Återställ through the existing rooms lifecycle action. The lifecycle
// reader reports every read; only a new administration revision (a restore) refreshes the catalog, so
// mounting the trash never loops into another catalog read.
function RoomTrash({operatorId,disabled,onChanged}:{operatorId:string;disabled:boolean;onChanged:()=>void}) {
  const revision=useRef<string|null>(null);
  return <ControlResourceLifecycle operatorId={operatorId} kind="rooms" archiveOnly available disabled={disabled}
    onChanged={snapshot=>{if(revision.current!==null&&revision.current!==snapshot.administrationRevision)onChanged();revision.current=snapshot.administrationRevision;}}/>;
}

// Read view of what the scene template lets the company change on its rooms.
function OperatorAdjustable({laneId,operator,active}:{laneId:string;operator:Operator;active:boolean}) {
  const [state,setState]=useState<{status:'loading'}|{status:'error'}|{status:'ready';lane:NonNullable<StudioProject['lanes']>[number]|undefined}>({status:'loading'});
  useEffect(()=>{
    if(!active)return;
    const controller=new AbortController();
    void (async()=>{try{
      const response=await fetch('/studio/api/project',{credentials:'same-origin',cache:'no-store',redirect:'error',headers:{accept:'application/json'},signal:controller.signal});
      if(!response.ok)throw Error();
      const value=await response.json();
      if(!controller.signal.aborted)setState({status:'ready',lane:(value.project as StudioProject).lanes?.find(row=>row.id===laneId)});
    }catch{if(!controller.signal.aborted)setState({status:'error'});}})();
    return()=>controller.abort();
  },[active,laneId]);
  const labels:Record<string,string>={table:'Bordsgrafik',background:'Bakgrund',dealer:'Dealer',branding:'Spelbordets utseende'};
  return <Card title="Vad bolaget får ändra på det här spelbordet" aside={<AsideLink href={companyHref(operator,'tilldelning')}>Ändra i bolagets tilldelning</AsideLink>}>
    {state.status==='loading'&&<Loading label="Läser miljön…" rows={4}/>}
    {state.status==='error'&&<Empty title="Oklart" text="Projektet kunde inte läsas, så bolagets val visas inte."/>}
    {state.status==='ready'&&(state.lane?<div className="grid">{(['dealer','table','background','branding'] as const).map(key=>{const unlocked=state.lane!.operatorAdjustable?.includes(key)??false;return <Row key={key} chip={unlocked?<Chip tone="ok">upplåst</Chip>:<Chip tone="ink">låst</Chip>} title={labels[key]??key} text={unlocked?'Bolaget väljer inom tilldelningen i Partnerportalen':'Låst av Scoutgaming'}/>;})}<Row chip={<Chip tone="ink">per bolag</Chip>} title="Bordsspråk, insatsprofil och paus" text="Låses upp per bolag under Bolag › Tilldelat"/></div>:<Empty title="Oklart" text="Miljön finns inte i det sparade projektet."/>)}
    <Footnote>Miljön avgör vad som kan låsas upp. Under Bolag › Tilldelat kan du stänga ett val för just det här bolaget.</Footnote>
  </Card>;
}

function RoomPreview({room,revision}:{room:Room;revision?:string}) {
  const [open,setOpen]=useState(false);
  return <PreviewFlyout title={'Förhandsvisning · '+room.name} open={open} onOpenChange={setOpen}>
    <ScenePreview active={open} laneId={room.compositionId} dealerId={room.dealerIds[0]} game={room.game==='roulette'?'roulette':'blackjack'} revision={revision}/>
    <Footnote>Visar den sparade miljön, inte spelbordets publicerade val. Dator; mobilvyn kommer senare.</Footnote>
  </PreviewFlyout>;
}
