import { useEffect, useState } from 'react';
import { OpenClawWorkspace } from '../../../../../lab/components/openclaw-workspace';
import { NativeAdministration } from '../../../../../lab/components/native-administration';
import { ConnectedEconomy } from './connected-economy';
import type {Catalog} from '../../lib/connected-studio.mjs';
import {isActiveOperator} from '../../lib/studio-resource-lifecycle.mjs';

const groups: Record<string,string> = {
  '/admin/drift':'operations',
  '/admin/admin/accounts':'accounts', '/admin/admin/players':'accounts',
  '/admin/admin/payments':'finance', '/admin/admin/api':'partners',
  '/admin/media-review':'media-review',
};

function Administration({group,dealerId}:{group:string;dealerId?:string}) {
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
  return <section className="admin-system-page">{error?<div role="alert"><p>{error}</p><button className="studio-button" onClick={()=>setRefresh(value=>value+1)}>Försök igen</button></div>:actions===null?<p role="status">Läser session och anslutna funktioner…</p>:<NativeAdministration key={group} embedded apiBase="/studio/api/admin" availableActions={actions} gameOrigin={gameOrigin} initialGroup={group} initialDealerId={dealerId}/>}</section>;
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

export function ConnectedServices({path,dealerId}:{path:string;dealerId?:string}) {
  if(path==='/admin/ekonomi')return <ConnectedEconomy/>;
  if(path==='/admin/ai/models')return <div className="admin-system-page admin-workspace-tool admin-system-models"><nav className="admin-system-actions" aria-label="Hjälp med administration"><a href="/admin/ai/chat" className="studio-button">Öppna Adminroboten</a></nav><OpenClawWorkspace embedded navigation={{models:'/admin/ai/models',chat:'/admin/dealer-agent',studio:'/admin/clips'}}/></div>;
  if(groups[path])return <Administration group={groups[path]} dealerId={dealerId}/>;
  if(path==='/admin/admin/log')return <CompanyJournal/>;
  return <section className="admin-system-page" aria-labelledby="unknown-service-title"><header className="admin-system-header"><div><p className="sg-eyebrow">System</p><h1 id="unknown-service-title">Tjänsten finns inte</h1><p>Den här adressen har ingen ansluten administrationstjänst.</p></div></header><nav className="admin-system-actions" aria-label="Tillgängliga verktyg"><a className="studio-button" href="/admin/tools">Öppna Verktyg</a></nav></section>;
}
