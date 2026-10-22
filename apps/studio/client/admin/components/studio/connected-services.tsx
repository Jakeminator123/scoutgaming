import { useEffect, useState } from 'react';
import {studioNavigationContextFromQuery,studioNavigationHref} from '../../../../lib/studio-navigation.mjs';
import { OpenClawWorkspace } from '../../../../components/openclaw-workspace';
import { NativeAdministration } from '../../../../components/native-administration';
import { StudioAdministration, StudioAdminUiError } from '../../../../components/studio-administration';
import adminStyles from '../../../../components/studio-administration.module.css';
import { ConnectedEconomy } from './connected-economy';
import type {Catalog} from '../../lib/connected-studio.mjs';
import {isActiveOperator} from '../../lib/studio-resource-lifecycle.mjs';

const groups: Record<string,string> = {
  '/admin/drift':'operations',
  '/admin/admin/accounts':'accounts', '/admin/admin/players':'accounts',
  '/admin/admin/payments':'finance', '/admin/admin/api':'partners',
  '/admin/media-review':'media-review',
};
/** The accounts group is one server document; a page may show only players (nivå 3) or staff users (nivå 1). */
export type AccountsSection='players'|'users';

/** Fresh N1 session for the native admin client: the same read NativeAdministration performs before every write. */
export async function readAdminSession(signal?:AbortSignal):Promise<Record<string,unknown>> {
  const response=await fetch('/studio/api/auth/session',{credentials:'same-origin',cache:'no-store',redirect:'error',signal,headers:{Accept:'application/json'}});
  if(!response.ok)throw new StudioAdminUiError(response.status);
  return response.json();
}

// Keep the shared Studio context and explicit ambiguous room/operator selectors
// for the destination to validate. Only the path and query are returned.
export function adminContextHref(target:string,query:URLSearchParams) {
  const url=new URL(studioNavigationHref(target,studioNavigationContextFromQuery(query)),'https://studio.invalid');
  for(const key of ['operator','table','room'])if(query.has(key)){
    url.searchParams.delete(key);for(const value of query.getAll(key))url.searchParams.append(key,value);
  }
  return url.pathname+url.search;
}

export type AgentModelsNavigation={models:string;chat:string;assistant:string;studio:string};
export function AgentModelsPanel({navigation}:{navigation:AgentModelsNavigation}) {
  return <div className="admin-system-page admin-workspace-tool admin-system-models"><nav className="admin-system-actions" aria-label="Hjälp med administration"><a href={navigation.assistant} className="studio-button">Öppna Adminroboten</a></nav><OpenClawWorkspace embedded navigation={{models:navigation.models,chat:navigation.chat,studio:navigation.studio}}/></div>;
}

function Administration({group,dealerId,section}:{group:string;dealerId?:string;section?:AccountsSection}) {
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
  // Drift keeps game status, shoe proof and integrity through the same native
  // reader; the taldrift controls live on the OpenClaw page.
  const content=group==='operations'
    ?<><nav className="admin-system-actions" aria-label="Taldrift"><a className="studio-button" href="/admin/openclaw?tab=drift">Driftläge för tal · OpenClaw</a></nav>
      <div className={adminStyles.embedded}><StudioAdministration key={group} apiBase="/studio/api/admin" session={readAdminSession} availableActions={actions??undefined} gameOrigin={gameOrigin} initialGroup={group} readIdentity="response-headers-v1" roomsHref="/admin/rooms" companyTeamLabel="Bolag & team" showGroupNavigation={false}/></div></>
    :<NativeAdministration key={group} embedded apiBase="/studio/api/admin" availableActions={actions??[]} gameOrigin={gameOrigin} initialGroup={group} initialDealerId={dealerId}/>;
  return <section className="admin-system-page" data-admin-view={section}>{error?<div role="alert"><p>{error}</p><button className="studio-button" onClick={()=>setRefresh(value=>value+1)}>Försök igen</button></div>:actions===null?<p role="status">Läser session och anslutna funktioner…</p>:content}</section>;
}

type CompanyJournalOperator=Pick<Catalog['administration']['operators'][number],'id'|'name'|'slug'|'status'|'archivedAt'>;
type CompanyJournalState={status:'loading'}|{status:'error';message:string}|{status:'ready';operators:CompanyJournalOperator[]};
function CompanyJournal() {
  const [state,setState]=useState<CompanyJournalState>({status:'loading'}),[refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setState({status:'loading'});
    void (async()=>{
      try {
        const response=await fetch('/admin/_data/catalog',{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal,headers:{Accept:'application/json'}});
        if(!response.ok)throw Error([401,403].includes(response.status)?'N1-behörigheten saknas eller har gått ut. Logga in igen.':'Bolagsregistret kunde inte läsas. Försök igen.');
        const catalog=await response.json().catch(()=>null),operators=catalog?.administration?.operators;
        if(catalog?.source!=='registered'||!Array.isArray(operators)||!operators.every((row:CompanyJournalOperator)=>row
          &&typeof row.id==='string'&&row.id.length>0&&typeof row.name==='string'&&row.name.trim().length>0
          &&typeof row.slug==='string'&&typeof row.status==='string'&&(row.archivedAt===null||typeof row.archivedAt==='string'))
          ||new Set(operators.map((row:CompanyJournalOperator)=>row.id)).size!==operators.length)throw Error('Bolagsregistret kunde inte verifieras.');
        if(!controller.signal.aborted)setState({status:'ready',operators:operators.filter(isActiveOperator)});
      }catch(cause){if(!controller.signal.aborted)setState({status:'error',message:cause instanceof Error?cause.message:'Bolagen kunde inte läsas. Försök igen.'});}
    })();
    return()=>controller.abort();
  },[refresh]);
  return <section className="admin-system-page" aria-labelledby="company-journal-title">
    <header className="admin-system-header"><div><p className="sg-eyebrow">System</p><h1 id="company-journal-title">Bolagsjournal</h1>
      <p>Välj bolag för teamets ändringar och publiceringar. Gemensam historik för hela Admin finns ännu inte.</p></div>
      <button className="studio-button" type="button" disabled={state.status==='loading'} onClick={()=>setRefresh(value=>value+1)}>Uppdatera</button>
    </header>
    {state.status==='loading'&&<p role="status">Läser registrerade bolag…</p>}
    {state.status==='error'&&<div className="admin-system-card" role="alert"><p>{state.message}</p><button className="studio-button" type="button" onClick={()=>setRefresh(value=>value+1)}>Försök igen</button></div>}
    {state.status==='ready'&&(state.operators.length?<><p>På bolagets teamsida väljer du <strong>Visa journal</strong>.</p>
      <ul className="admin-system-grid" aria-label="Bolagsjournaler">{state.operators.map(operator=>{
        const hasAddress=typeof operator.slug==='string'&&operator.slug.length<=63&&/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(operator.slug);
        return <li className="admin-system-card" key={operator.id}><h2>{operator.name}</h2>{hasAddress
          ?<a className="studio-button" href={'/partner/'+encodeURIComponent(operator.slug)+'/team?scope=company'}>Öppna team &amp; journal</a>
          :<p>Bolagets registrerade adress saknas eller är ogiltig.</p>}</li>;
      })}</ul></>:<p>Inga aktiva registrerade bolag.</p>)}
  </section>;
}

export function ConnectedServices({path,dealerId,section}:{path:string;dealerId?:string;section?:AccountsSection}) {
  if(path==='/admin/ekonomi')return <ConnectedEconomy/>;
  if(groups[path])return <Administration group={groups[path]} dealerId={dealerId} section={groups[path]==='accounts'?section:undefined}/>;
  if(path==='/admin/admin/log')return <CompanyJournal/>;
  return <section className="admin-system-page" aria-labelledby="unknown-service-title"><header className="admin-system-header"><div><p className="sg-eyebrow">System</p><h1 id="unknown-service-title">Tjänsten finns inte</h1><p>Den här adressen har ingen ansluten administrationstjänst.</p></div></header><nav className="admin-system-actions" aria-label="Tillgängliga verktyg"><a className="studio-button" href="/admin/tools">Öppna Fördjupning</a></nav></section>;
}
