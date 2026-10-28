import { useEffect, useState, type ReactNode } from 'react';
import {usePathname,useSearchParams} from '../../../runtime/navigation';
import {TaldriftPanel} from './taldrift-panel';
import {readAdminSession} from '../../lib/admin-session';
export {readAdminSession} from '../../lib/admin-session';
import {studioNavigationContextFromQuery,studioNavigationHref} from '../../../../lib/studio-navigation.mjs';
import { OpenClawWorkspace } from '../../../../components/openclaw-workspace';
import { NativeAdministration } from '../../../../components/native-administration';
import { StudioAdministration, StudioAdminUiError } from '../../../../components/studio-administration';
import adminStyles from '../../../../components/studio-administration.module.css';
import { ConnectedEconomy } from './connected-economy';

const groups: Record<string,string> = {
  '/admin/admin/accounts':'accounts', '/admin/admin/players':'accounts',
  '/admin/admin/api':'partners',
};
/** The accounts group is one server document; a page may show only players (nivå 3) or staff users (nivå 1). */
export type AccountsSection='players'|'users';

// Keep the shared Studio context and explicit ambiguous room/operator selectors
// for the destination to validate. Only the path and query are returned.
export function adminContextHref(target:string,query:URLSearchParams) {
  const url=new URL(studioNavigationHref(target,studioNavigationContextFromQuery(query)),'https://studio.invalid');
  for(const key of ['operator','table','room'])if(query.has(key)){
    url.searchParams.delete(key);for(const value of query.getAll(key))url.searchParams.append(key,value);
  }
  return url.pathname+url.search;
}

export function AgentModelsPanel() {
  return <div className="admin-system-page admin-workspace-tool admin-system-models"><OpenClawWorkspace embedded/></div>;
}

// A tab may hide a panel, but must not discard unsaved native drafts.
export function ServiceTabs({path,label,tabs}:{path:string;label:string;tabs:{id:string;label:string;content:ReactNode}[]}) {
  const pathname=usePathname(),query=useSearchParams();
  const requested=tabs.find(tab=>tab.id===query.get('tab'))?.id??tabs[0].id;
  const [lastSelected,setLastSelected]=useState(requested);
  const selected=pathname===path?requested:lastSelected;
  const [visited,setVisited]=useState<string[]>([selected]);
  useEffect(()=>{if(pathname===path){setLastSelected(selected);setVisited(current=>current.includes(selected)?current:[...current,selected]);}},[pathname,path,selected]);
  return <div className="admin-system-page admin-service-page"><nav className="sg-tabs" aria-label={label}>{tabs.map(tab=><a key={tab.id} href={adminContextHref(path+'?tab='+tab.id,query)} aria-current={selected===tab.id?'page':undefined}>{tab.label}</a>)}</nav>
    {tabs.filter(tab=>tab.id===selected||visited.includes(tab.id)).map(tab=><div key={tab.id} hidden={selected!==tab.id}>{tab.content}</div>)}
  </div>;
}

function Administration({group,section}:{group:string;section?:AccountsSection}) {
  const [actions,setActions]=useState<string[]|null>(null);
  const [gameOrigin,setGameOrigin]=useState<string>();
  const [error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const controller=new AbortController(); setActions(null);setError('');
    void (async()=>{
      try {
        const response=await fetch('/studio/api/auth/session',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal});
        if(!response.ok)throw Error([401,403].includes(response.status)?'Din N1-session saknas eller har gått ut. Logga in igen.':'Administrationen kunde inte nås.');
        const value=await response.json();
        if(!Array.isArray(value.availableActions)||!value.availableActions.every((action:unknown)=>typeof action==='string'))throw Error('Serverns administrationsbehörigheter kunde inte verifieras.');
        let origin:string|undefined;
        try{const approved=new URL(value.gameOrigin);if(approved.protocol==='https:'&&approved.origin===value.gameOrigin)origin=approved.origin;}catch{/* A missing configuration cannot enable launch-link actions. */}
        if(!controller.signal.aborted){setGameOrigin(origin);setActions(origin?value.availableActions:value.availableActions.filter((action:string)=>action!=='POST apikeys/launch'));}
      }catch(cause){if(!controller.signal.aborted)setError((cause as Error).message);}
    })();
    return()=>controller.abort();
  },[refresh]);
  // Keep the native readers, authorization and writes on their existing contracts.
  const content=group==='operations'
    ?<div className={adminStyles.embedded}><StudioAdministration key={group} apiBase="/studio/api/admin" session={readAdminSession} availableActions={actions??undefined} gameOrigin={gameOrigin} initialGroup={group} readIdentity="response-headers-v1" roomsHref="/admin/rooms" companyTeamLabel="Bolag & team" showGroupNavigation={false}/></div>
    :<NativeAdministration key={group} embedded apiBase="/studio/api/admin" availableActions={actions??[]} gameOrigin={gameOrigin} initialGroup={group}/>;
  return <section className="admin-system-page" data-admin-view={section}>{error?<div role="alert"><p>{error}</p><button className="studio-button" onClick={()=>setRefresh(value=>value+1)}>Försök igen</button></div>:actions===null?<p role="status">Läser session och anslutna funktioner…</p>:content}</section>;
}

export function ConnectedServices({path,section}:{path:string;section?:AccountsSection}) {
  if(path==='/admin/ekonomi')return <ServiceTabs path={path} label="Ekonomi" tabs={[
    {id:'overview',label:'Översikt',content:<ConnectedEconomy/>},
    {id:'payments',label:'Betalningar',content:<Administration group="finance"/>},
  ]}/>;
  if(path==='/admin/drift')return <ServiceTabs path={path} label="Drift" tabs={[
    {id:'status',label:'Spelstatus',content:<Administration group="operations"/>},
    {id:'speech',label:'Taldrift',content:<TaldriftPanel/>},
  ]}/>;
  if(path==='/admin/ai/models')return <AgentModelsPanel/>;
  if(groups[path])return <Administration group={groups[path]} section={groups[path]==='accounts'?section:undefined}/>;
  return <section className="admin-system-page" aria-labelledby="unknown-service-title"><header className="admin-system-header"><div><p className="sg-eyebrow">System</p><h1 id="unknown-service-title">Tjänsten finns inte</h1><p>Den här adressen har ingen ansluten administrationstjänst.</p></div></header><nav className="admin-system-actions" aria-label="Tillgängliga verktyg"><a className="studio-button" href="/admin">Till översikten</a></nav></section>;
}
