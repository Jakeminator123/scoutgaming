import {useEffect,useState} from 'react';
import Link from '../../../runtime/navigation';
import {HubPage,Tabs,Card,Chip,Empty,KV} from '../ui/hub';
import {adminSystemTabs} from '../../lib/admin-navigation';
import {Administration,AgentModelsPanel,EconomyPanel} from './connected-services';
import {ResourceConnections} from './resource-connections';

// System: drift, AI-agenter, Scoutgamings personal, spelarkonton (support until step F), integration
// (keys are global until step F), beroenden and the internal lobby. Visited tabs stay mounted so the
// native forms keep their drafts.
export function SystemPage({active,tab}:{active:boolean;tab:string}) {
  const [visited,setVisited]=useState<string[]>([tab]);
  useEffect(()=>{if(active)setVisited(current=>current.includes(tab)?current:[...current,tab]);},[active,tab]);
  const panel=(id:string,content:React.ReactNode)=>visited.includes(id)?<div key={id} hidden={tab!==id}>{content}</div>:null;
  return <HubPage wide title="System" intro="Drift, AI-agenter, Scoutgamings personal, spelarkonton för support (alla bolag tills steg F), integration, beroenden och den interna lobbyn.">
    <Tabs items={adminSystemTabs} active={tab}/>
    {panel('drift',<Administration group="operations"/>)}
    {panel('agenter',<div className="hub-stack"><OpenAiCard active={active&&tab==='agenter'}/><AgentModelsPanel/></div>)}
    {panel('personal',<><p className="hub-small hub-muted">Bara Admins konton (croupier_auth.users, roll admin eller staff). Spelarkonton ligger under fliken Spelarkonton.</p><Administration group="accounts" section="users"/></>)}
    {panel('spelare',<><p className="hub-small hub-muted">Alla spelare oavsett bolag, för support. Spelare knyts till bolag i steg F efter O03; då flyttar vyn till Bolag › Spelare och ekonomi.</p><Administration group="accounts" section="players"/><EconomyPanel active={active&&tab==='spelare'}/></>)}
    {panel('integration',<><p className="hub-small hub-muted">API-nycklar och testsession. Nycklarna saknar bolag i dag (api_keys utan operator_id) och visas därför här, inte per bolag, tills steg F.</p><Administration group="partners"/></>)}
    {panel('beroenden',<ResourceConnections embedded/>)}
    {panel('lobby',<Card title="Intern lobby" aside="/admin/lobby · visar även pausade spelbord, bakom inloggning">
      <KV items={[['Adress',<code key="a">/admin/lobby</code>],['Visar','alla bolags spelbord ur katalogen oavsett läge; spelet startar mot publicerat paket'],['Publika lobbyn',<a key="l" href="/lobby">/lobby</a>]]}/>
      <p className="hub-mt"><a className="hub-btn" href="/admin/lobby">Öppna den interna lobbyn</a></p>
    </Card>)}
  </HubPage>;
}

// OPENAI_API_KEY is read by the clip-upload proposal (dealer-import-model.mjs) and the assistant.
// GET /studio/api/openclaw/admin now says whether it is configured (true/false, never the value).
function OpenAiCard({active}:{active:boolean}) {
  const [state,setState]=useState<{status:'loading'}|{status:'ready';configured:boolean|null}|{status:'error'}>({status:'loading'});
  useEffect(()=>{
    if(!active||state.status!=='loading')return;
    const controller=new AbortController();
    void (async()=>{
      try{
        const response=await fetch('/studio/api/openclaw/admin',{credentials:'same-origin',cache:'no-store',redirect:'error',headers:{accept:'application/json'},signal:controller.signal});
        const value=await response.json().catch(()=>null);
        if(controller.signal.aborted)return;
        if(!response.ok)setState({status:'error'});
        else setState({status:'ready',configured:typeof value?.openaiKeyConfigured==='boolean'?value.openaiKeyConfigured:null});
      }catch{if(!controller.signal.aborted)setState({status:'error'});}
    })();
    return()=>controller.abort();
  },[active,state.status]);
  return <Card title="OpenAI" aside="OPENAI_API_KEY · används av klippuppladdningens förslag och assistenten">
    <KV items={[['Nyckel',state.status==='loading'?'Läser…':state.status==='error'?<Chip tone="warn">oklart · agentpanelen svarade inte</Chip>:state.configured===null?<Chip tone="warn">oklart · svaret saknar flaggan</Chip>:state.configured?<Chip tone="ok" dot>konfigurerad</Chip>:<Chip tone="danger" dot>saknas</Chip>],['Var','Vercel (apps/studio); värdet visas aldrig i Admin']]}/>
  </Card>;
}
