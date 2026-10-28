import {useEffect,useState} from 'react';
import {Building2,LayoutGrid,Plus,Presentation,Table2,Upload,UserRound,Users} from 'lucide-react';
import {Bar,BarChart,CartesianGrid,XAxis,YAxis} from 'recharts';
import Link from '../../../runtime/navigation';
import {HubPage,Card,Chip,Row,Empty,KV} from '../ui/hub';
import {buttonVariants,cn,plural,Stat} from '../ui/kit';
import {ChartContainer,ChartTooltip,ChartTooltipContent} from '../ui/chart';
import {createStudioClient,type Workspace} from '../../lib/connected-studio.mjs';
import {dealerCoverage,dealerStill} from '../../lib/dealer-coverage.mjs';
import {journalType} from '../../lib/economy-journal.mjs';
import {readAdminSession} from '../../lib/admin-session';
import {createStudioAdminClient,studioAdminActor} from '../../../../components/studio-administration';
import {DealerAvatar} from './dealer-identity-portrait';

const client=createStudioClient();
type Pending={kind:'warn'|'danger'|'info'|'accent';type:string;title:string;text:string;href:string};
type Overview={players:number|null;rooms:number|null;tx:{type:string;n:number}[]};
const txConfig={n:{label:'Händelser',color:'var(--sg-info)'}};

// The overview read (players and journal events per type) through the same admin client and session as System › Drift.
function useOverview() {
  const [state,setState]=useState<{status:'loading'}|{status:'ready';value:Overview}|{status:'unavailable'}>({status:'loading'});
  useEffect(()=>{
    const controller=new AbortController();
    void (async()=>{try{
      const session=await readAdminSession(controller.signal);
      if(!studioAdminActor(session)||!Array.isArray(session.availableActions)||!session.availableActions.includes('GET overview'))throw Error('unavailable');
      const admin=createStudioAdminClient({apiBase:'/studio/api/admin',session:async()=>session,availableActions:session.availableActions as string[]});
      const {payload}=await admin.request('GET','overview',undefined,controller.signal) as {payload:Record<string,unknown>};
      const count=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:null;
      const tx=Array.isArray(payload.tx)?payload.tx.filter((row):row is {type:string;n:number}=>Boolean(row)&&typeof row.type==='string'&&typeof row.n==='number').map(row=>({type:row.type,n:row.n})):[];
      if(!controller.signal.aborted)setState({status:'ready',value:{players:count(payload.players),rooms:count(payload.rooms),tx}});
    }catch{if(!controller.signal.aborted)setState({status:'unavailable'});}})();
    return()=>controller.abort();
  },[]);
  return state;
}

// Översikt: the numbers that matter, what waits for Scoutgaming and where to start. Read from the same
// catalog and video register the other pages use, plus the overview read for players and game events.
export function AdminHome({workspace}:{workspace:Workspace|null}) {
  const [own,setOwn]=useState<Workspace|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(!workspace);
  const overview=useOverview();
  useEffect(()=>{
    if(workspace)return;
    const abort=new AbortController();setLoading(true);setError('');
    void client.load(abort.signal).then(value=>{if(!abort.signal.aborted)setOwn(value);})
      .catch(cause=>{if(!abort.signal.aborted)setError(cause instanceof Error?cause.message:'Registren kunde inte läsas.');})
      .finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>abort.abort();
  },[workspace]);
  const data=workspace??own;
  const registry=data?.catalog.administration;
  const pending:Pending[]=[];
  const dealers=data?.project.dealers??[];
  const ready=data?dealers.filter(dealer=>dealerCoverage(data.project,data.inventory,dealer.id).complete):[];
  if(data&&registry){
    for(const dealer of dealers){
      const coverage=dealerCoverage(data.project,data.inventory,dealer.id);
      if(!coverage.complete)pending.push({kind:'warn',type:'Klipp saknas',title:dealer.label,text:`Giv ${coverage.deal.bound}/${coverage.deal.total} · tal ${coverage.speech.bound}/${coverage.speech.total} · vila ${coverage.idle.bound}/${coverage.idle.total}`,href:`/admin/dealers/${encodeURIComponent(dealer.id)}?flik=klipp`});
    }
    for(const room of registry.rooms.filter(row=>row.state==='pending')){
      const operator=registry.operators.find(row=>row.id===room.operatorId);
      pending.push({kind:'info',type:'Pausat spelbord',title:room.name,text:`${operator?.name??'Okänt bolag'} · ${room.published?'publicerat':'inte publicerat'} · öppnas under Tillgänglighet`,href:`/admin/rooms/${encodeURIComponent(room.id)}?flik=tillganglighet`});
    }
    for(const room of registry.rooms.filter(row=>row.state!=='archived'&&!row.published)){
      const operator=registry.operators.find(row=>row.id===room.operatorId);
      pending.push({kind:'danger',type:'Ej publicerat',title:room.name,text:`${operator?.name??'Bolaget'} har inte publicerat spelbordet`,href:`/admin/companies/${encodeURIComponent(room.operatorId)}?flik=tilldelning`});
    }
    for(const operator of registry.operators.filter(row=>row.status==='active'&&!row.archivedAt&&row.packageRevision===null)){
      pending.push({kind:'accent',type:'Ingen tilldelning',title:operator.name,text:'Bolaget har ingen publicerad tilldelning ännu',href:`/admin/companies/${encodeURIComponent(operator.id)}?flik=tilldelning`});
    }
  }
  const activeOperators=registry?.operators.filter(row=>row.status==='active'&&!row.archivedAt)??[];
  const rooms=registry?.rooms.filter(row=>row.state!=='archived')??[];
  const live=rooms.filter(room=>room.state==='live');
  const players=overview.status==='ready'?overview.value.players:null;
  const tx=overview.status==='ready'?overview.value.tx.filter(row=>row.n>0).sort((a,b)=>b.n-a.n).slice(0,8).map(row=>({...row,label:journalType(row.type)})):[];
  const firstDealer=dealers[0];
  return <HubPage title="Översikt" intro="Det som väntar på Scoutgaming just nu. Varje rad leder till platsen där det åtgärdas.">
    <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Stat label="Dealers redo för spel" value={data?`${ready.length}/${dealers.length}`:'–'} hint={data?(dealers.length-ready.length?`${plural(dealers.length-ready.length,'dealer saknar','dealers saknar')} klipp`:'Alla har sina klipp'):'Läser…'} icon={<Users/>} tone={data&&ready.length===dealers.length?'ok':'warn'}/>
      <Stat label="Öppna spelbord" value={registry?`${live.length}/${rooms.length}`:'–'} hint={registry?`${plural(rooms.length-live.length,'pausat','pausade')}`:'Läser…'} icon={<Table2/>} tone="info"/>
      <Stat label="Aktiva bolag" value={registry?activeOperators.length:'–'} hint={registry?`${plural(activeOperators.filter(row=>row.packageRevision!==null).length,'med publicerad tilldelning','med publicerad tilldelning')}`:'Läser…'} icon={<Building2/>} tone="accent"/>
      <Stat label="Spelarkonton" value={players??'–'} hint={overview.status==='unavailable'?'Inte anslutet för din roll':players===null?'Läser…':'Alla bolag tills steg F'} icon={<UserRound/>}/>
    </div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] min-[1600px]:grid-cols-[minmax(0,1fr)_400px]">
      <div className="grid content-start gap-5">
        <Card title="Väntar på dig" aside={data?plural(pending.length,'sak','saker'):undefined}>
          {loading&&<p role="status" className="m-0 text-sg-muted">Läser register…</p>}
          {error&&<p role="alert" className="m-0 text-sg-muted">{error}</p>}
          {data&&!pending.length&&<Empty chip={null} title="Inget väntar" text="Alla dealers har sina klipp och alla spelbord är publicerade."/>}
          {pending.length>0&&<div className="grid">{pending.map(row=><Row key={row.type+row.title} chip={<Chip tone={row.kind}>{row.type}</Chip>} title={row.title} text={row.text} href={row.href}/>)}</div>}
        </Card>
        {registry&&<Card title="Bolag och spelbord" aside={<Link href="/admin/companies" className="font-semibold text-sg-accent-text no-underline hover:underline">Alla →</Link>}>
          {!activeOperators.length?<Empty chip={null} title="Inga aktiva bolag" action={<Link className={buttonVariants()} href="/admin/companies?view=create">Nytt bolag</Link>}/>:<div className="grid gap-3 md:grid-cols-2">
            {activeOperators.map(operator=>{const mine=rooms.filter(room=>room.operatorId===operator.id);return <div key={operator.id} className="rounded-xl border border-sg-line-2 bg-sg-surface-2 p-4">
              <div className="mb-2 flex items-center justify-between gap-2"><Link className="font-semibold text-sg-text no-underline hover:underline" href={`/admin/companies/${encodeURIComponent(operator.id)}`}>{operator.name}</Link><Chip>{operator.packageRevision===null?'ingen tilldelning':`version ${operator.packageRevision}`}</Chip></div>
              {mine.length?<ul className="m-0 grid list-none gap-1.5 p-0">{mine.map(room=><li key={room.id} className="flex items-center justify-between gap-2 text-[13px]"><Link className="min-w-0 truncate text-sg-text no-underline hover:underline" href={`/admin/rooms/${encodeURIComponent(room.id)}`}>{room.name}<span className="text-sg-faint"> · {room.dealers.map(dealer=>dealer.name).join(', ')||'ingen dealer'}</span></Link><Chip tone={room.state==='live'?'ok':'warn'} dot>{room.state==='live'?'öppet':'pausat'}</Chip></li>)}</ul>:<p className="m-0 text-[13px] text-sg-muted">Inga spelbord</p>}
            </div>;})}
          </div>}
        </Card>}
      </div>
      <div className="grid content-start gap-5">
        <Card title="Börja med"><div className="grid gap-2">
          <Link className={cn(buttonVariants({variant:'primary'}),'justify-start')} href={firstDealer?`/admin/dealers/${encodeURIComponent(firstDealer.id)}?flik=klipp&panel=intake`:'/admin/dealers'}><Upload aria-hidden="true"/>Lägg till klipp</Link>
          <Link className={cn(buttonVariants(),'justify-start')} href={activeOperators[0]?`/admin/companies/${encodeURIComponent(activeOperators[0].id)}?flik=tilldelning`:'/admin/companies'}><LayoutGrid aria-hidden="true"/>Tilldela innehåll</Link>
          <Link className={cn(buttonVariants(),'justify-start')} href="/admin/dealers?view=create"><Plus aria-hidden="true"/>Ny dealer</Link>
          <Link className={cn(buttonVariants(),'justify-start')} href="/admin/companies?tab=spelbord&view=create"><Table2 aria-hidden="true"/>Nytt spelbord</Link>
          <Link className={cn(buttonVariants(),'justify-start')} href="/admin/demo"><Presentation aria-hidden="true"/>Skapa demo</Link>
        </div></Card>
        {data&&dealers.length>0&&<Card title="Dealers" aside={<Link href="/admin/dealers" className="font-semibold text-sg-accent-text no-underline hover:underline">Alla →</Link>}>
          <ul className="m-0 grid list-none gap-2.5 p-0">{dealers.slice(0,5).map(dealer=>{const coverage=dealerCoverage(data.project,data.inventory,dealer.id);return <li key={dealer.id}><Link href={`/admin/dealers/${encodeURIComponent(dealer.id)}?flik=klipp`} className="flex items-center gap-3 rounded-lg text-sg-text no-underline hover:bg-sg-surface-2">
            <DealerAvatar dealer={dealer} still={dealerStill(data.project,data.inventory,dealer.id)} size={36}/><span className="min-w-0 flex-1 truncate font-semibold">{dealer.label}</span><Chip tone={coverage.complete?'ok':'warn'} dot>{coverage.complete?'redo':'klipp saknas'}</Chip></Link></li>;})}</ul>
        </Card>}
        <Card title="Spelhändelser" aside={<Link href="/admin/system?flik=drift" className="font-semibold text-sg-accent-text no-underline hover:underline">System →</Link>}>
          {overview.status==='loading'&&<p role="status" className="m-0 text-[13px] text-sg-muted">Läser…</p>}
          {overview.status==='unavailable'&&<Empty title="Inte anslutet för din roll" text="Siffrorna kräver administratörsbehörighet; drift och skor finns under System › Drift."/>}
          {overview.status==='ready'&&(tx.length?<ChartContainer config={txConfig} className="aspect-auto h-56 w-full" aria-label="Antal journalhändelser per typ">
            <BarChart accessibilityLayer data={tx} layout="vertical" margin={{left:0,right:12}}>
              <CartesianGrid horizontal={false}/><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false}/>
              <YAxis type="category" dataKey="label" width={130} tickLine={false} axisLine={false} tick={{fontSize:11}}/>
              <ChartTooltip content={<ChartTooltipContent formatter={value=>`${value} händelser`}/>}/><Bar dataKey="n" fill="var(--color-n)" radius={[0,4,4,0]} isAnimationActive={false}/>
            </BarChart>
          </ChartContainer>:<p className="m-0 text-[13px] text-sg-muted">Inga spelhändelser registrerade ännu.</p>)}
        </Card>
        <Card title="Så hänger det ihop">
          <KV items={[['Admin','skapar och tilldelar'],['Bolaget','väljer inom tilldelningen'],['Spelaren','ser bara det publicerade']]}/>
          <p className="mb-0 mt-3 text-[12.5px] text-sg-muted">Bolag → tilldelning → spelbord (scenmall, dealer, språk, insatsprofil) → spelet.</p>
        </Card>
      </div>
    </div>
  </HubPage>;
}
