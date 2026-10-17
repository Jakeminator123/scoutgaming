import {useEffect, useMemo, useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis} from 'recharts';
import {ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent} from '@/components/ui/chart';
import {Page, PageHeader, Panel, Kpis, inputClass} from '../ops/ui';
import {usePathname} from '../../../runtime/navigation';
import {createStudioAdminClient, studioAdminActor, StudioAdminUiError} from '../../../../components/studio-administration';
import {JOURNAL_LIMIT, journalType, formatJournalAmount, readEconomyJournal, summarizeEconomyJournal, type JournalRow} from '../../lib/economy-journal.mjs';

type State = {status:'loading'|'idle'} | {status:'error';message:string} | {status:'ready';journal:JournalRow[];readAt:number};
const flowConfig = {credit:{label:'Krediterat',color:'#d6ff3a'},debit:{label:'Debiterat',color:'#3ad6c4'}};
const countConfig = {count:{label:'Poster',color:'#3ad6c4'}};
const date = (value:string) => new Intl.DateTimeFormat('sv-SE',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(value));
const money = formatJournalAmount;

export function ConnectedEconomy() {
  const path = usePathname();
  const [state,setState] = useState<State>({status:'loading'});
  const [refresh,setRefresh] = useState(0), [currency,setCurrency] = useState(''), [days,setDays] = useState(0);
  useEffect(()=>{
    if(path!=='/admin/ekonomi'){setState({status:'idle'});return;}
    const controller = new AbortController(); setState({status:'loading'});
    void (async()=>{
      try {
        const response=await fetch('/studio/api/auth/session',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal,headers:{Accept:'application/json'}});
        if(!response.ok)throw new StudioAdminUiError(response.status);
        const session=await response.json(), actor=studioAdminActor(session);
        if(!actor)throw new StudioAdminUiError(401);
        if(!Array.isArray(session.availableActions)||!session.availableActions.every((item:unknown)=>typeof item==='string'))throw new StudioAdminUiError(503);
        const client=createStudioAdminClient({apiBase:'/studio/api/admin',session:async()=>session,availableActions:session.availableActions,readIdentity:'response-headers-v1'});
        const {payload}=await client.request('GET','transactions',undefined,controller.signal,actor);
        const journal=readEconomyJournal(payload);
        if(!controller.signal.aborted)setState({status:'ready',journal,readAt:Date.now()});
      }catch(error){if(!controller.signal.aborted)setState({status:'error',message:error instanceof StudioAdminUiError?error.message:'Journalen kunde inte läsas. Försök igen.'});}
    })();
    return()=>controller.abort();
  },[path,refresh]);
  const summary=useMemo(()=>state.status==='ready'?summarizeEconomyJournal(state.journal,{currency,days,now:state.readAt}):null,[state,currency,days]);
  const loading=state.status==='loading'||state.status==='idle';
  return <Page>
    <PageHeader eyebrow="Ekonomi" title="Ekonomisk översikt"
      description="Se kontorörelser och aktivitet. Öppna journalen när du behöver granska en enskild händelse."
      aside={<button type="button" className="studio-button inline-flex items-center gap-2" disabled={loading} onClick={()=>setRefresh(value=>value+1)}><RefreshCw className="size-3.5" aria-hidden/>{loading?'Läser…':'Uppdatera'}</button>}/>
    {loading&&<div role="status" className="rounded-lg border border-sg-line bg-sg-panel p-8 text-sm text-sg-muted">Läser ekonomins journal…</div>}
    {state.status==='error'&&<div role="alert" className="rounded-lg border border-sg-line bg-sg-panel p-6"><p>{state.message}</p><button type="button" className="studio-button mt-3" onClick={()=>setRefresh(value=>value+1)}>Försök igen</button></div>}
    {summary&&<>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-2xl text-xs leading-relaxed text-sg-muted">Underlaget är de {summary.sourceCount} senaste journalposterna (högst {JOURNAL_LIMIT})
          {summary.sourceFrom&&summary.sourceTo?`, ${date(summary.sourceFrom)}–${date(summary.sourceTo)}`:'.'} Diagrammen visar urvalet, inte en fullständig periodrapport.</p>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs text-sg-muted">Valuta<select className={inputClass} value={summary.currency??''} onChange={event=>setCurrency(event.target.value)} disabled={!summary.currencies.length}>
            {!summary.currencies.length&&<option value="">Ingen valuta</option>}{summary.currencies.map(item=><option key={item} value={item}>{item}</option>)}
          </select></label>
          <label className="flex flex-col gap-1 text-xs text-sg-muted">Period i urvalet<select className={inputClass} value={days} onChange={event=>setDays(Number(event.target.value))}>
            <option value={0}>Alla hämtade poster</option><option value={7}>Senaste 7 dagarna</option><option value={30}>Senaste 30 dagarna</option>
          </select></label>
        </div>
      </div>
      <Kpis items={[
        {label:'Journalposter',value:String(summary.count),hint:'I valt urval och valuta'},
        {label:'Debiterat',value:money(summary.debit,summary.currency),hint:'Belopp dragna från spelarkonton'},
        {label:'Krediterat',value:money(summary.credit,summary.currency),hint:'Verifierade rörelser till spelarkonton',tone:'lime'},
        {label:'Nettoförändring',value:money(summary.net,summary.currency),hint:'Krediterat minus debiterat i urvalet',tone:'amber'},
      ]}/>
      {!summary.count?<Panel title="Ingen aktivitet i urvalet"><p className="p-6 text-sm text-sg-muted">{summary.sourceCount?'Välj en annan valuta eller en längre period för att se journalposter.':'Det finns inga journalposter att visa ännu.'}</p></Panel>:<div className="grid min-w-0 gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Kontorörelser per dag" meta={summary.currency??undefined}>
          {!summary.daily.length ? <p className="p-6 text-sm text-sg-muted">Inga verifierade kontorörelser i urvalet.</p> :
          <ChartContainer config={flowConfig} className="aspect-auto h-72 w-full px-2 pb-2 pt-4" aria-label="Krediteringar och debiteringar per dag">
            <AreaChart accessibilityLayer data={summary.daily} margin={{left:4,right:12}}>
              <CartesianGrid vertical={false}/><XAxis dataKey="day" tickFormatter={date} minTickGap={28} tickLine={false} axisLine={false}/>
              <YAxis tickLine={false} axisLine={false} width={62} tickFormatter={value=>new Intl.NumberFormat('sv-SE',{notation:'compact'}).format(Number(value))}/>
              <ChartTooltip content={<ChartTooltipContent labelFormatter={value=>date(String(value))} formatter={(value,name)=>`${name==='credit'?'Krediterat':'Debiterat'}: ${money(Number(value),summary.currency)}`}/>}/>
              <ChartLegend content={<ChartLegendContent/>}/>
              <Area dataKey="credit" type="linear" stroke="var(--color-credit)" fill="var(--color-credit)" fillOpacity={0.16} strokeWidth={2} dot={{r:3}} isAnimationActive={false}/>
              <Area dataKey="debit" type="linear" stroke="var(--color-debit)" fill="var(--color-debit)" fillOpacity={0.12} strokeWidth={2} dot={{r:3}} isAnimationActive={false}/>
            </AreaChart>
          </ChartContainer>}
        </Panel>
        <Panel title="Händelser i urvalet" meta="Antal poster">
          <ChartContainer config={countConfig} className="aspect-auto h-72 w-full px-2 pb-2 pt-4" aria-label="Antal journalposter per händelsetyp">
            <BarChart accessibilityLayer data={summary.types} layout="vertical" margin={{left:4,right:22}}>
              <CartesianGrid horizontal={false}/><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false}/>
              <YAxis type="category" dataKey="label" width={148} tickLine={false} axisLine={false} tick={{fontSize:11}}/>
              <ChartTooltip content={<ChartTooltipContent formatter={value=>`${value} poster`}/>}/><Bar dataKey="count" fill="var(--color-count)" radius={[0,4,4,0]} isAnimationActive={false}/>
            </BarChart>
          </ChartContainer>
        </Panel>
      </div>}
      <p className="text-xs text-sg-muted">Beloppen summerar verifierade kontoändringar, inte bolagets intäkt. Öppningssaldo och valutabyte visas som saldoobservationer men räknas inte som rörelser. Okända händelsetyper finns kvar i journalen utan att påverka beloppen. GGR, avtal och revshare saknar ännu anslutet underlag. Datum visas i UTC.</p>
      <details className="rounded-lg border border-sg-line bg-sg-panel">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-sg-lime">Visa journal · {summary.count} {summary.count===1?'post':'poster'}</summary>
        <div className="overflow-x-auto border-t border-sg-line"><table className="w-full text-left text-xs">
          <caption className="sr-only">Journalposter bakom händelsediagrammet och verifierade kontorörelser</caption>
          <thead className="border-b border-sg-line text-sg-muted"><tr>{['Tid (UTC)','Händelse','Belopp','Spelare'].map(label=><th scope="col" key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-sg-line">{summary.rows.map(row=><tr key={row.key}><td className="whitespace-nowrap px-4 py-3">{row.at.slice(0,16).replace('T',' ')}</td><td className="px-4 py-3">{journalType(row.type)}</td><td className="whitespace-nowrap px-4 py-3 font-mono tabular-nums">{money(row.amount,row.currency)}</td><td className="px-4 py-3 font-mono text-sg-muted">{row.playerId}</td></tr>)}</tbody>
        </table>{!summary.count&&<p className="p-4 text-sm text-sg-muted">Inga journalposter i urvalet.</p>}</div>
      </details>
    </>}
  </Page>;
}
