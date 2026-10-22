import {useEffect,useState} from 'react';
import {useSearchParams} from '../../../runtime/navigation';
import {MovingDriftControls,type MovingDriftTransport} from '../../../../components/moving-drift-controls';
import {createStudioAdminClient,studioAdminActor,StudioAdminUiError,type StudioAdminActor} from '../../../../components/studio-administration';
import {AgentModelsPanel,adminContextHref,readAdminSession} from './connected-services';
import {WorkspaceTool} from './workspace-tools';
import {AdminAssistantPage} from './dealer-assistant-shell';

export type OpenClawTabId='drift'|'models'|'agent'|'probe'|'assistant';
export type OpenClawTab={id:OpenClawTabId;label:string;href:string;/** Routes this tab replaces; keep them reachable as redirects. */formerly:readonly string[]};
const tabs:readonly OpenClawTab[]=Object.freeze([
  {id:'drift',label:'Driftläge',href:'/admin/openclaw?tab=drift',formerly:Object.freeze([])},
  {id:'models',label:'Agentmodeller',href:'/admin/openclaw?tab=models',formerly:Object.freeze(['/admin/ai/models'])},
  {id:'agent',label:'Dealerns agent',href:'/admin/openclaw?tab=agent',formerly:Object.freeze(['/admin/dealer-agent'])},
  {id:'probe',label:'Tal vid inaktivitet',href:'/admin/openclaw?tab=probe',formerly:Object.freeze(['/admin/probe'])},
  {id:'assistant',label:'Adminroboten',href:'/admin/openclaw?tab=assistant',formerly:Object.freeze(['/admin/ai/chat'])},
].map(tab=>Object.freeze(tab)) as OpenClawTab[]);
/** Menu descriptor: one System entry; the tabs select a part through ?tab=. */
export const OPENCLAW_ROUTE=Object.freeze({path:'/admin/openclaw',label:'OpenClaw',area:'System',description:'Taldrift, agentmodeller, dealerns agent och assistenter.',tabs});
export function openClawTab(value:string|null|undefined):OpenClawTabId {
  return tabs.some(tab=>tab.id===value)?value as OpenClawTabId:'drift';
}

type DriftState={status:'loading'}|{status:'error';message:string}|{status:'ready';client:MovingDriftTransport;actor:StudioAdminActor};
/** The same native moving-drift reader/writer Drift used, bound to the freshly read N1 actor. */
export function TaldriftPanel() {
  const [state,setState]=useState<DriftState>({status:'loading'}),[refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setState({status:'loading'});
    void (async()=>{
      try {
        const session=await readAdminSession(controller.signal),actor=studioAdminActor(session);
        if(!actor)throw new StudioAdminUiError(401);
        if(!Array.isArray(session.availableActions)||!session.availableActions.every((item:unknown)=>typeof item==='string'))throw new StudioAdminUiError(503);
        const client=createStudioAdminClient({apiBase:'/studio/api/admin',session:readAdminSession,availableActions:session.availableActions,readIdentity:'response-headers-v1'});
        if(!controller.signal.aborted)setState({status:'ready',client,actor});
      }catch(error){if(!controller.signal.aborted)setState({status:'error',message:error instanceof StudioAdminUiError?error.message:'Driftstyrningen kunde inte nås. Försök igen.'});}
    })();
    return()=>controller.abort();
  },[refresh]);
  return <section className="admin-openclaw-panel" aria-label="Taldrift">
    <p className="admin-openclaw-lead">GPU-läget för dealerns tal i den här miljön. Av och Sparläge är anslutna; ett sparat önskemål är ingen driftbekräftelse. Spelstatus och integritet finns kvar under Drift.</p>
    {state.status==='loading'&&<p role="status">Läser session och driftbehörighet…</p>}
    {state.status==='error'&&<div className="admin-system-card" role="alert"><p>{state.message}</p><button className="studio-button" type="button" onClick={()=>setRefresh(value=>value+1)}>Försök igen</button></div>}
    {state.status==='ready'&&<MovingDriftControls client={state.client} expectedActor={state.actor}/>}
  </section>;
}

export function OpenClawPage() {
  const query=useSearchParams(),tab=openClawTab(query.get('tab'));
  const [visited,setVisited]=useState<OpenClawTabId[]>([]);
  useEffect(()=>{setVisited(current=>current.includes(tab)?current:[...current,tab]);},[tab]);
  const href=(id:OpenClawTabId)=>adminContextHref(`${OPENCLAW_ROUTE.path}?tab=${id}`,query);
  const mounted=(id:OpenClawTabId)=>tab===id||visited.includes(id);
  return <div className="admin-system-page admin-openclaw-page">
    <header className="admin-system-header"><div><p className="sg-eyebrow">System</p><h1 id="openclaw-title">OpenClaw</h1>
      <p>Taldrift, agentmodeller, dealerns agent och assistenter på ett ställe. Klippens egna OpenClaw-val gör du i klippkartan och Scen &amp; lager.</p></div></header>
    <nav className="sg-tabs" aria-label="OpenClaw-delar">{tabs.map(item=><a key={item.id} href={href(item.id)} aria-current={item.id===tab?'page':undefined}>{item.label}</a>)}</nav>
    {/* Native service panels stay mounted once visited, as entry.tsx keeps service pages,
        so unsaved drift and model drafts survive a tab switch. Studio tools mount one
        at a time, exactly as WorkspaceTool does today. */}
    {mounted('drift')&&<div hidden={tab!=='drift'}><TaldriftPanel/></div>}
    {mounted('models')&&<div hidden={tab!=='models'}><AgentModelsPanel navigation={{models:href('models'),chat:href('agent'),assistant:href('assistant'),studio:adminContextHref('/admin/clips',query)}}/></div>}
    {tab==='agent'&&<WorkspaceTool section="dealer-agent"/>}
    {tab==='probe'&&<WorkspaceTool section="probe"/>}
    {tab==='assistant'&&<AdminAssistantPage embedded/>}
  </div>;
}
