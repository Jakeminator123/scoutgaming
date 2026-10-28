import {useEffect,useState} from 'react';
import Link from '../../../runtime/navigation';
import {HubPage,Card,Chip,Row,Empty,KV} from '../ui/hub';
import {createStudioClient,type Workspace} from '../../lib/connected-studio.mjs';
import {dealerCoverage} from '../../lib/dealer-coverage.mjs';

const client=createStudioClient();
type Pending={kind:'warn'|'danger'|'info'|'accent';type:string;title:string;text:string;href:string};

// Översikt: what waits for Scoutgaming, read from the same catalog and video register the other pages use.
export function AdminHome({workspace}:{workspace:Workspace|null}) {
  const [own,setOwn]=useState<Workspace|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(!workspace);
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
  if(data&&registry){
    for(const dealer of data.project.dealers){
      const coverage=dealerCoverage(data.project,data.inventory,dealer.id);
      if(!coverage.complete)pending.push({kind:'warn',type:'Klipp saknas',title:dealer.label,text:`Giv ${coverage.deal.bound}/${coverage.deal.total} · talfack ${coverage.speech.bound}/${coverage.speech.total} · vila ${coverage.idle.bound}/${coverage.idle.total}`,href:`/admin/dealers/${encodeURIComponent(dealer.id)}?flik=klipp`});
    }
    for(const room of registry.rooms.filter(row=>row.state==='pending')){
      const operator=registry.operators.find(row=>row.id===room.operatorId);
      pending.push({kind:'info',type:'Pausat spelbord',title:room.name,text:`${operator?.name??room.operatorId} · ${room.published?'publicerat':'inte publicerat'} · öppnas under Tillgänglighet`,href:`/admin/rooms/${encodeURIComponent(room.id)}?flik=tillganglighet`});
    }
    for(const room of registry.rooms.filter(row=>row.state!=='archived'&&!row.published)){
      const operator=registry.operators.find(row=>row.id===room.operatorId);
      pending.push({kind:'danger',type:'Ej publicerat',title:room.name,text:`${operator?.name??room.operatorId} saknar publicerat paket för spelbordet`,href:`/admin/companies/${encodeURIComponent(room.operatorId)}?flik=tilldelning`});
    }
    for(const operator of registry.operators.filter(row=>row.status==='active'&&!row.archivedAt&&row.packageRevision===null)){
      pending.push({kind:'accent',type:'Ingen tilldelning',title:operator.name,text:'Bolaget har ingen publicerad tilldelning ännu',href:`/admin/companies/${encodeURIComponent(operator.id)}?flik=tilldelning`});
    }
  }
  const activeOperators=registry?.operators.filter(row=>row.status==='active'&&!row.archivedAt)??[];
  const rooms=registry?.rooms.filter(row=>row.state!=='archived')??[];
  return <HubPage title="Översikt" intro="Det som väntar på Scoutgaming just nu. Varje rad leder till platsen där det åtgärdas.">
    <div className="hub-grid main-aside">
      <div className="hub-stack">
        <Card title="Väntar på dig" aside={data?`${pending.length} ${pending.length===1?'sak':'saker'}`:undefined}>
          {loading&&<p role="status" className="hub-muted">Läser register…</p>}
          {error&&<p role="alert" className="hub-muted">{error}</p>}
          {data&&!pending.length&&<Empty chip={null} title="Inget väntar" text="Alla dealers har sina krävda klipp och alla spelbord är publicerade."/>}
          {pending.length>0&&<div className="hub-rows">{pending.map(row=><Row key={row.type+row.title} chip={<Chip tone={row.kind}>{row.type}</Chip>} title={row.title} text={row.text} href={row.href}/>)}</div>}
          <p className="hub-small hub-muted hub-mt">Opublicerade ändringar per spelbord och väntande inbjudningar kan inte avgöras ur katalogen; de syns i spelbordets Historik och i bolagets Team.</p>
        </Card>
        {registry&&<Card title="Bolag och spelbord" aside={<Link href="/admin/companies">Alla →</Link>}>
          {!activeOperators.length?<Empty chip={null} title="Inga aktiva bolag" action={<Link className="hub-btn" href="/admin/companies?view=create">Nytt bolag</Link>}/>:<div className="hub-table-wrap"><table className="hub-table"><thead><tr><th>Bolag</th><th>Paket</th><th>Spelbord</th><th>Läge</th><th></th></tr></thead><tbody>
            {activeOperators.map(operator=>{const own=rooms.filter(room=>room.operatorId===operator.id);return own.length?own.map((room,index)=><tr key={room.id}>
              <td>{index===0&&<Link className="hub-strong" href={`/admin/companies/${encodeURIComponent(operator.id)}`}>{operator.name}</Link>}</td><td>{index===0&&(operator.packageRevision===null?'–':`version ${operator.packageRevision}`)}</td>
              <td><Link href={`/admin/rooms/${encodeURIComponent(room.id)}`}>{room.name}</Link><div className="hub-small hub-muted">{room.dealers.map(dealer=>dealer.name).join(', ')||'ingen dealer'} · {room.game}</div></td>
              <td><Chip tone={room.state==='live'?'ok':'warn'} dot>{room.state==='live'?'öppet':'pausat'}</Chip></td><td className="num"><Link className="hub-btn small" href={`/admin/rooms/${encodeURIComponent(room.id)}`}>Öppna</Link></td>
            </tr>):<tr key={operator.id}><td><Link className="hub-strong" href={`/admin/companies/${encodeURIComponent(operator.id)}`}>{operator.name}</Link></td><td>{operator.packageRevision===null?'–':`version ${operator.packageRevision}`}</td><td className="hub-muted" colSpan={3}>Inga spelbord</td></tr>;})}
          </tbody></table></div>}
        </Card>}
      </div>
      <div className="hub-stack">
        <Card title="Börja med"><div className="hub-stack">
          <Link className="hub-btn primary" href={data?.project.dealers[0]?`/admin/dealers/${encodeURIComponent(data.project.dealers[0].id)}?flik=klipp&panel=intake`:'/admin/dealers'}>Lägg till klipp</Link>
          <Link className="hub-btn" href={activeOperators[0]?`/admin/companies/${encodeURIComponent(activeOperators[0].id)}?flik=tilldelning`:'/admin/companies'}>Tilldela innehåll</Link>
          <Link className="hub-btn" href="/admin/dealers?view=create">Ny dealer</Link>
          <Link className="hub-btn" href="/admin/companies?tab=spelbord&view=create">Nytt spelbord</Link>
          <Link className="hub-btn" href="/admin/demo">Skapa demo</Link>
        </div></Card>
        <Card title="Drift just nu" aside={<Link href="/admin/system?flik=drift">System →</Link>}>
          <Empty title="Visas under System › Drift" text="Spelstatus, skor och det delade bordets prov läses där (A:overview, A:shoes); ingen extra läsning görs här."/>
        </Card>
        <Card title="Så hänger det ihop">
          <KV items={[['Admin','skapar och tilldelar'],['Bolaget','väljer inom tilldelningen'],['Spelaren','ser bara publicerat']]}/>
          <p className="hub-small hub-muted hub-mt">Bolag → paket (version) → spelbord (scenmall + dealer + språk + insatsprofil) → spelinställningar → motorns bord.</p>
        </Card>
      </div>
    </div>
  </HubPage>;
}
