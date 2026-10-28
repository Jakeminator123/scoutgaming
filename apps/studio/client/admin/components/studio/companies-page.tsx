import {useEffect,useState} from 'react';
import Link, {useSearchParams} from '../../../runtime/navigation';
import {HubPage,Crumbs,Tabs,Chip,Card,Row,Empty,KV,Note,PreviewFlyout} from '../ui/hub';
import {adminCompanyListTabs,adminCompanyTabs,adminRoomTabs,adminTabId} from '../../lib/admin-navigation';
import type {Catalog} from '../../lib/connected-studio.mjs';
import type {StudioProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import {RegisteredStudio} from './registered-studio';
import {WorkspaceTool} from './workspace-tools';
import {SavedScenePreview} from './saved-scene-preview';
import {ControlResourceLifecycle} from '../../../../components/control-resource-lifecycle';
import {PartnerJournal} from '../../../../components/partner-journal-loader.mjs';

type Props={page:'companies'|'company'|'room';id:string;active:boolean;disabled:boolean;onChanged:()=>void};
type Operator=Catalog['administration']['operators'][number];type Room=Catalog['administration']['rooms'][number];
const stateChip=(room:Room)=><Chip tone={room.state==='live'?'ok':'warn'} dot>{room.state==='live'?'öppet':'pausat'}</Chip>;
const operatorChip=(operator:Operator)=><Chip tone={operator.archivedAt?'danger':operator.status==='active'?'ok':'warn'} dot>{operator.archivedAt?'papperskorg':operator.status==='active'?'aktivt':'avstängt'}</Chip>;
const companyHref=(operator:Operator,flik='tilldelning')=>`/admin/companies/${encodeURIComponent(operator.id)}?flik=${flik}`;
const roomHref=(room:Room,flik='utseende')=>`/admin/rooms/${encodeURIComponent(room.id)}?flik=${flik}`;

// Bolag och spelbord: the company list and all rooms (two tabs), one nav per company and the room editor.
// Reads the registered catalog once per visit; the editors read their own contracts as before.
export function CompaniesPage({page,id,active,disabled,onChanged}:Props) {
  const query=useSearchParams();
  const [catalog,setCatalog]=useState<Catalog|null>(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
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
  const changed=()=>{setRefresh(value=>value+1);onChanged();};
  const operators=catalog?.administration.operators??[],rooms=catalog?.administration.rooms.filter(room=>room.state!=='archived')??[],compositions=catalog?.administration.compositions??[];
  const operatorName=(operatorId:string)=>operators.find(row=>row.id===operatorId)?.name??operatorId;
  const laneLabel=(laneId:string)=>compositions.find(row=>row.id===laneId)?.name??laneId;
  const status=error?<p role="alert" className="hub-note warn">{error} <button type="button" className="hub-btn small" onClick={()=>setRefresh(value=>value+1)}>Försök igen</button></p>:!catalog?<p role="status" className="hub-muted">Läser katalogen…</p>:null;

  if(page==='companies'){
    const tab=adminTabId('companies',query.get('tab')),filter=query.get('operator')??'',create=query.get('view')==='create';
    const list=filter?rooms.filter(room=>room.operatorId===filter):rooms;
    const createOperator=operators.find(row=>row.id===filter&&row.status==='active'&&!row.archivedAt)??operators.find(row=>row.status==='active'&&!row.archivedAt);
    return <HubPage wide title="Bolag och spelbord" intro="Ett nav per bolag: tilldelning, spelbord, spelare och ekonomi, team, integration, journal och inställningar. Alla bolags spelbord på en flik."
      actions={tab==='bolag'?<Link className="hub-btn primary" href="/admin/companies?tab=bolag&view=create">Nytt bolag</Link>:<Link className="hub-btn primary" href={'/admin/companies?tab=spelbord&view=create'+(filter?'&operator='+encodeURIComponent(filter):'')}>Nytt spelbord</Link>}>
      <Tabs items={adminCompanyListTabs} active={tab} param="tab" counts={catalog?{bolag:operators.filter(row=>!row.archivedAt).length,spelbord:rooms.length}:{}}/>
      {status}
      {tab==='bolag'&&<>
        {create&&<Card title="Nytt bolag" aside={<Link href="/admin/companies?tab=bolag">Stäng</Link>} className="hub-mt"><p className="hub-small hub-muted">Skapa bolaget och bjud in dess första administratör. Tilldelningen görs sedan under bolagets flik Tilldelning.</p><WorkspaceTool section="companies"/></Card>}
        {catalog&&<Card className="hub-mt"><div className="hub-table-wrap"><table className="hub-table"><thead><tr><th>Bolag</th><th>Status</th><th>Paket</th><th>Spelbord</th><th>Partnerportalen</th><th></th></tr></thead><tbody>
          {operators.map(operator=><tr key={operator.id}><td><Link className="hub-strong" href={companyHref(operator)}>{operator.name}</Link><div className="hub-small hub-muted"><code>{operator.slug}</code></div></td><td>{operatorChip(operator)}</td><td>{operator.packageRevision===null?'ingen publicering':`version ${operator.packageRevision}`}</td><td>{rooms.filter(room=>room.operatorId===operator.id).length}</td><td><a href={'/partner/'+encodeURIComponent(operator.slug)}>/partner/{operator.slug}</a></td><td className="num"><Link className="hub-btn small" href={companyHref(operator)}>Öppna</Link></td></tr>)}
          {!operators.length&&<tr><td colSpan={6} className="hub-muted">Inga bolag i registret.</td></tr>}
        </tbody></table></div></Card>}
      </>}
      {tab==='spelbord'&&<>
        <div className="hub-actions" style={{marginBottom:16}}><Link href="/admin/companies?tab=spelbord" className={'hub-chip '+(!filter?'ink':'')}>Alla bolag</Link>{operators.filter(row=>!row.archivedAt).map(operator=><Link key={operator.id} href={'/admin/companies?tab=spelbord&operator='+encodeURIComponent(operator.id)} className={'hub-chip '+(filter===operator.id?'ink':'')}>{operator.name}</Link>)}</div>
        {create&&(createOperator?<Card title={`Nytt spelbord hos ${createOperator.name}`} aside={<Link href={'/admin/companies?tab=spelbord'+(filter?'&operator='+encodeURIComponent(filter):'')}>Stäng</Link>} className="hub-mt"><p className="hub-small hub-muted">Byt bolag med filtret ovan. Spelbordet skapas med en scenmall och en kompatibel spellane; det är pausat tills tilldelningen är publicerad och spelbordet öppnas.</p><RegisteredStudio mode="create" operatorId={createOperator.id} disabled={disabled} onChanged={changed}/></Card>:<Empty chip={null} title="Inget aktivt bolag" text="Skapa ett bolag först."/>)}
        {catalog&&<Card className="hub-mt"><div className="hub-table-wrap"><table className="hub-table"><thead><tr><th>Spelbord</th><th>Bolag</th><th>Dealers</th><th>Scenmall</th><th>Läge</th><th>Publicerat</th><th></th></tr></thead><tbody>
          {list.map(room=><tr key={room.id}><td><Link className="hub-strong" href={roomHref(room)}>{room.name}</Link><div className="hub-small hub-muted">{room.game} · <code>{room.id}</code></div></td><td><Link href={companyHref(operators.find(row=>row.id===room.operatorId)??{id:room.operatorId} as Operator,'spelbord')}>{operatorName(room.operatorId)}</Link></td><td>{room.dealers.map(dealer=>dealer.name).join(', ')||'–'}</td><td>{laneLabel(room.compositionId)}</td><td>{stateChip(room)}</td><td>{room.published?<Chip tone="ok">publicerat</Chip>:<Chip tone="warn">inte publicerat</Chip>}</td><td className="num"><Link className="hub-btn small" href={roomHref(room)}>Öppna</Link></td></tr>)}
          {!list.length&&<tr><td colSpan={7} className="hub-muted">Inga spelbord{filter?' hos bolaget':''}.</td></tr>}
        </tbody></table></div></Card>}
      </>}
    </HubPage>;
  }

  if(page==='company'){
    const operator=operators.find(row=>row.id===id||row.slug===id);
    const tab=adminTabId('company',query.get('flik')),create=query.get('view')==='create';
    const own=operator?rooms.filter(room=>room.operatorId===operator.id):[];
    return <HubPage wide eyebrow={<Crumbs items={[{label:'Bolag och spelbord',href:'/admin/companies'},{label:operator?.name??id}]}/>} title={operator?.name??id} chip={operator?operatorChip(operator):undefined}
      intro={operator?`${operator.packageRevision===null?'Ingen publicerad tilldelning':`Tilldelning version ${operator.packageRevision}`} · ${own.length} spelbord · /partner/${operator.slug}`:catalog?`Bolaget ${id} finns inte i registret.`:'Läser katalogen…'}
      actions={operator&&<a className="hub-btn" href={'/partner/'+encodeURIComponent(operator.slug)}>Öppna Partnerportalen ↗</a>}>
      <Tabs items={adminCompanyTabs} active={tab} counts={operator?{spelbord:own.length}:{}}/>
      {status}
      {operator&&<>
        {tab==='tilldelning'&&<><Note tone="accent">Bolaget får en uppsättning scenmallar att välja bland, aldrig bara en. Dealers, bakgrunder och bordsgrafik följer med via scenmallarna. Upplåsning per val (dealer, bordsgrafik, bakgrund, språk, insatsprofil) kommer i steg A–C efter O03.</Note><div className="hub-mt"><RegisteredStudio mode="package" operatorId={operator.id} disabled={disabled} onChanged={changed}/></div></>}
        {tab==='spelbord'&&<Card title="Bolagets spelbord" aside={<Link className="hub-btn small primary" href={companyHref(operator,'spelbord')+'&view=create'}>Nytt spelbord för bolaget</Link>}>
          {create&&<div className="hub-mt" style={{marginBottom:16}}><RegisteredStudio mode="create" operatorId={operator.id} disabled={disabled} onChanged={changed}/></div>}
          {own.length?<div className="hub-table-wrap"><table className="hub-table"><thead><tr><th>Spelbord</th><th>Dealers · scenmall</th><th>Läge</th><th>Publicerat</th><th></th></tr></thead><tbody>
            {own.map(room=><tr key={room.id}><td><Link className="hub-strong" href={roomHref(room)}>{room.name}</Link><div className="hub-small hub-muted">{room.game} · <code>{room.id}</code></div></td><td>{room.dealers.map(dealer=>dealer.name).join(', ')||'–'} · {laneLabel(room.compositionId)}</td><td>{stateChip(room)}</td><td>{room.published?<Chip tone="ok">publicerat</Chip>:<Chip tone="warn">inte publicerat</Chip>}</td><td className="num"><Link className="hub-btn small" href={roomHref(room)}>Öppna</Link></td></tr>)}
          </tbody></table></div>:<Empty chip={null} title="Inga spelbord" text="Tilldela innehåll först, publicera tilldelningen, skapa sedan ett spelbord."/>}
        </Card>}
        {tab==='spelare'&&<div className="hub-grid c2">
          <Card title="Spelare"><Empty title="Inte anslutet · steg F" text="Spelare är inte knutna till bolag ännu (players saknar bolagskolumn). Byggs i steg F efter O03. Tills dess: alla spelarkonton under System." action={<Link className="hub-btn" href="/admin/system?flik=spelare">System › Spelarkonton</Link>}/></Card>
          <Card title="Rundor och omsättning per spelbord"><Empty title="Inte anslutet · steg F" text="Aggregat per spelbord ur shared_table_audit (wallet.settlement) läses inte i Admin ännu; ekonomin för alla bolag finns under System › Spelarkonton."/></Card>
        </div>}
        <div hidden={tab!=='team'}>{visited.includes('company:'+id+':team')&&<><p className="hub-small hub-muted">Team, roller och inbjudningar. Administratör utses bara av Admin och kan inte delegeras; den sista administratören kan inte stängas av.</p><WorkspaceTool section="companies" overrides={{operator:operator.id}}/></>}</div>
        {tab==='integration'&&<div className="hub-grid c2">
          <Card title="API-nycklar"><Empty title="Nycklarna är globala tills steg F" text="api_keys saknar operator_id, så nycklar visas och roteras för alla bolag under System › Integration." action={<Link className="hub-btn" href="/admin/system?flik=integration">System › Integration</Link>}/></Card>
          <Card title="Startadresser" aside="playUrl per spelbord ur katalogen">{own.filter(room=>room.playUrl).length?<KV items={own.filter(room=>room.playUrl).map(room=>[room.name,<code key={room.id}>{room.playUrl}</code>] as [string,React.ReactNode])}/>:<p className="hub-muted hub-small">Inget spelbart spelbord ännu.</p>}</Card>
        </div>}
        {tab==='journal'&&<Card title="Journal" aside="operator_audit_events och utseendeutkast"><PartnerJournal base="/studio/api/partner" operatorSlug={operator.slug} operatorId={operator.id}/></Card>}
        {tab==='installningar'&&<div className="hub-grid c2">
          <Card title="Bolag"><KV items={[['Namn',operator.name],['Slug',<code key="s">{operator.slug}</code>],['Status',operatorChip(operator)],['Tilldelning',operator.packageRevision===null?'ingen publicering':`version ${operator.packageRevision}`]]}/><p className="hub-small hub-muted hub-mt">Namn och slug ändras inte från Admin i dag (ingen sådan action finns).</p></Card>
          <Card title="Livscykel" aside="stäng av, papperskorg, återställ"><ControlResourceLifecycle operatorId={operator.id} kind="operator" available disabled={disabled} onChanged={changed}/></Card>
        </div>}
      </>}
    </HubPage>;
  }

  const room=rooms.find(row=>row.id===id)??catalog?.administration.rooms.find(row=>row.id===id);
  const operator=room?operators.find(row=>row.id===room.operatorId):undefined;
  const tab=adminTabId('room',query.get('flik'));
  return <HubPage wide eyebrow={<Crumbs items={[{label:'Bolag och spelbord',href:'/admin/companies?tab=spelbord'},...(operator?[{label:operator.name,href:companyHref(operator,'spelbord')}]:[]),{label:room?.name??id}]}/>}
    title={room?.name??id} chip={room?stateChip(room):undefined}
    intro={room?`${room.game} · ${room.dealers.map(dealer=>dealer.name).join(', ')||'ingen dealer'} · ${laneLabel(room.compositionId)} · ${room.published?'publicerat':'inte publicerat'}${operator?.packageRevision!=null?` · tilldelning version ${operator.packageRevision}`:''}`:catalog?`Spelbordet ${id} finns inte i registret.`:'Läser katalogen…'}
    actions={room?.playUrl?<a className="hub-btn" href={room.playUrl} target="_blank" rel="noopener">Öppna i spelet ↗</a>:undefined}>
    <Tabs items={adminRoomTabs} active={tab}/>
    {status}
    {room&&operator&&<>
      {tab==='utseende'&&<RegisteredStudio mode="room" section="appearance" operatorId={operator.id} roomId={room.id} disabled={disabled} onChanged={changed}/>}
      {tab==='dealer'&&<Card title="Dealer" aside={`${room.dealers.length} i spelbordets scenmall`}>
        <Note>Dealern väljs under Utseende tillsammans med bakgrund och bordsgrafik; det är ett utkast per bolag (operator_branding_drafts). Vilka dealers som kan väljas styrs av scenmallens tillåtna dealers.</Note>
        <div className="hub-rows hub-mt">{room.dealers.map(dealer=><Row key={dealer.id} chip={<Chip tone={room.dealerSource==='published'?'ok':''}>{room.dealerSource==='published'?'publicerad':'sparad'}</Chip>} title={dealer.name} text="klipp, tal och landningar på dealerns sida" href={`/admin/dealers/${encodeURIComponent(dealer.id)}?flik=klipp`}/>)}{!room.dealers.length&&<p className="hub-muted hub-small">Scenmallen tillåter ingen dealer ännu.</p>}</div>
      </Card>}
      {tab==='spel'&&<RegisteredStudio mode="room" section="game" operatorId={operator.id} roomId={room.id} disabled={disabled} onChanged={changed}/>}
      {tab==='tillganglighet'&&<><Note>Pausa gäller direkt: spelbordets namn och läge läses levande ur registret, inte ur paketet. Ett pausat spelbord syns inte i lobbyn och pågående rundor spelas klart.</Note><div className="hub-mt"><RegisteredStudio mode="room" section="state" operatorId={operator.id} roomId={room.id} disabled={disabled} onChanged={changed}/></div></>}
      {tab==='bolagets-val'&&<OperatorAdjustable laneId={room.compositionId} operator={operator} active={active&&tab==='bolagets-val'}/>}
      {tab==='historik'&&<Card title="Historik" aside="bolagets journal · publiceringar heter package.publish och draft.publish"><p className="hub-small hub-muted">Journalen är per bolag; raderna för det här spelbordet nämner dess id eller namn.</p><PartnerJournal base="/studio/api/partner" operatorSlug={operator.slug} operatorId={operator.id}/></Card>}
      <RoomPreview room={room}/>
    </>}
  </HubPage>;
}

// Read view of the scene template's operatorAdjustable: what the company may change on its rooms.
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
  const labels:Record<string,string>={'table.color':'Bordsfärg (visas inte i Admin)',table:'Bordsgrafik',background:'Bakgrund',dealer:'Dealer',branding:'Spelbordets utseende'};
  return <Card title="Vad bolaget får ändra på det här spelbordet" aside={<Link href={companyHref(operator,'tilldelning')}>Ändra under Bolag › Tilldelning →</Link>}>
    {state.status==='loading'&&<p role="status" className="hub-muted">Läser scenmallen…</p>}
    {state.status==='error'&&<Empty title="oklart" text="Projektet kunde inte läsas; scenmallens operatorAdjustable visas inte."/>}
    {state.status==='ready'&&(state.lane?<div className="hub-rows">{(['dealer','table','background','branding'] as const).map(key=>{const unlocked=state.lane!.operatorAdjustable?.includes(key)??false;return <Row key={key} chip={unlocked?<Chip tone="ok">upplåst</Chip>:<Chip tone="ink">låst</Chip>} title={labels[key]??key} text={unlocked?'bolaget väljer inom tilldelningen i Partnerportalen':'Låst av Scoutgaming'}/>;})}<Row chip={<Chip tone="ink">låst</Chip>} title="Bordsspråk och insatsprofil" text="sätts av Admin under Spelinställningar; upplåsning per bolag kommer i steg C efter O03"/></div>:<Empty title="oklart" text={`Scenmallen ${laneId} finns inte i det sparade projektet.`}/>)}
    <p className="hub-small hub-muted hub-mt">Läsvy av scenmallens operatorAdjustable. Valen gäller per scenmall i dag, inte per bolag; det ändras i steg C.</p>
  </Card>;
}

function RoomPreview({room}:{room:Room}) {
  const [open,setOpen]=useState(false);
  return <PreviewFlyout title={'Förhandsvisning · '+room.name} open={open} onOpenChange={setOpen}>
    {room.game==='blackjack'?<SavedScenePreview active={open} presentationLaneId={room.compositionId} dealerId={room.dealerIds[0]} game="blackjack"/>:<Empty chip={null} title="Provspelningen stöder Blackjack"/>}
    <p className="hub-small hub-muted hub-mt">Provar den sparade scenmallen med testsaldo, inte spelbordets publicerade val. Dator; mobilvy kommer efter O03.</p>
  </PreviewFlyout>;
}
