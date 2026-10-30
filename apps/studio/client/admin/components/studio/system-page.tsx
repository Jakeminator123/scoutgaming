import {useEffect,useState} from 'react';
import Link from '../../../runtime/navigation';
import {HubPage,Tabs,Card,Chip,Empty,KV} from '../ui/hub';
import {buttonVariants,Footnote} from '../ui/kit';
import {adminSystemTabs} from '../../lib/admin-navigation';
import {Administration,AgentModelsPanel,EconomyPanel} from './connected-services';
import {ResourceConnections} from './resource-connections';

// System: drift, AI-agenter, Scoutgamings personal, spelarkonton (support until step F), integration
// (keys are global until step F) and beroenden. The internal lobby is a link in the page header.
// Visited tabs stay mounted so the native forms keep their drafts.
export function SystemPage({active,tab}:{active:boolean;tab:string}) {
  const [visited,setVisited]=useState<string[]>([tab]);
  useEffect(()=>{if(active)setVisited(current=>current.includes(tab)?current:[...current,tab]);},[active,tab]);
  const panel=(id:string,content:React.ReactNode)=>visited.includes(id)?<div key={id} hidden={tab!==id}>{content}</div>:null;
  return <HubPage wide title="System" intro="Drift, AI-agenter, personal, spelarkonton, integration och beroenden."
    actions={<a className={buttonVariants()} href="/admin/lobby" title="Alla bolags spelbord, även pausade. Bakom inloggning.">Intern lobby</a>}>
    <Tabs items={adminSystemTabs} active={tab}/>
    {panel('drift',<Administration group="operations"/>)}
    {panel('agenter',<div className="grid gap-4"><OpenAiCard active={active&&tab==='agenter'}/><AgentModelsPanel/></div>)}
    {panel('personal',<><Footnote className="mb-4 mt-0">Scoutgamings egna konton: administratörer och personal. Spelarnas konton finns under Spelarkonton.</Footnote><Administration group="accounts" section="users"/></>)}
    {panel('spelare',<><Footnote className="mb-4 mt-0">Alla spelare oavsett bolag, för support. Spelare knyts till bolag senare; då flyttar vyn till bolagets egen sida.</Footnote><Administration group="accounts" section="players"/><EconomyPanel active={active&&tab==='spelare'}/></>)}
    {panel('integration',<><Footnote className="mb-4 mt-0">API-nycklar och testsession. Varje nyckel hör till ett bolag; du väljer bolaget när du skapar nyckeln.</Footnote><Administration group="partners"/></>)}
    {panel('beroenden',<ResourceConnections embedded/>)}
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
  return <Card title="OpenAI" aside="Används av klippuppladdningens förslag och assistenten">
    <KV items={[['Nyckel',state.status==='loading'?'Läser…':state.status==='error'?<Chip tone="warn">oklart · svaret uteblev</Chip>:state.configured===null?<Chip tone="warn">oklart · svaret saknar uppgiften</Chip>:state.configured?<Chip tone="ok" dot>konfigurerad</Chip>:<Chip tone="danger" dot>saknas</Chip>],['Var','I driftmiljön; nyckeln visas aldrig i Admin']]}/>
  </Card>;
}
