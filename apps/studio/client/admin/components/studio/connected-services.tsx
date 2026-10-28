import { useEffect, useState } from 'react';
import {readAdminSession} from '../../lib/admin-session';
export {readAdminSession} from '../../lib/admin-session';
import {studioNavigationContextFromQuery,studioNavigationHref} from '../../../../lib/studio-navigation.mjs';
import { OpenClawWorkspace } from '../../../../components/openclaw-workspace';
import { NativeAdministration } from '../../../../components/native-administration';
import { StudioAdministration, sharedStudioAdminRead, type SharedStudioAdminRead } from '../../../../components/studio-administration';
import adminStyles from '../../../../components/studio-administration.module.css';
import { ConnectedEconomy } from './connected-economy';

/** An accounts panel shows, and reads, only players (nivå 3) or only staff users (nivå 1). */
export type AccountsSection='players'|'users';

// A nav address names its company or room in the path; the query never repeats that selector.
const navSelectors:[RegExp,string[]][]=[[/^(?:\/studio)?\/admin\/companies\/[^/]+$/,['operator']],[/^(?:\/studio)?\/admin\/rooms\/[^/]+$/,['table','room']]];

// Keep the shared Studio context and explicit ambiguous room/operator selectors
// for the destination to validate. Only the path and query are returned.
export function adminContextHref(target:string,query:URLSearchParams) {
  const url=new URL(studioNavigationHref(target,studioNavigationContextFromQuery(query)),'https://studio.invalid');
  const named=navSelectors.find(([path])=>path.test(url.pathname))?.[1]??[];
  for(const key of ['operator','table','room']){
    if(named.includes(key))url.searchParams.delete(key);
    else if(query.has(key)){url.searchParams.delete(key);for(const value of query.getAll(key))url.searchParams.append(key,value);}
  }
  return url.pathname+url.search;
}

export function AgentModelsPanel() {
  return <div className="admin-system-page admin-workspace-tool admin-system-models"><OpenClawWorkspace embedded/></div>;
}

/** The native administration readers and writers on their existing contracts: Drift (operations),
 *  Scoutgamings personal (accounts/users), Spelarkonton (accounts/players), Integration (partners). */
export function Administration({group,section,sharedRead}:{group:string;section?:AccountsSection;sharedRead?:SharedStudioAdminRead}) {
  const [actions,setActions]=useState<string[]|null>(null);
  const [gameOrigin,setGameOrigin]=useState<string>();
  const [error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const controller=new AbortController(); setActions(null);setError('');
    void (async()=>{
      try {
        const response=await fetch('/studio/api/auth/session',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal});
        if(!response.ok)throw Error([401,403].includes(response.status)?'Din inloggning saknas eller har gått ut. Logga in igen.':'Administrationen kunde inte nås.');
        const value=await response.json();
        if(!Array.isArray(value.availableActions)||!value.availableActions.every((action:unknown)=>typeof action==='string'))throw Error('Serverns administrationsbehörigheter kunde inte verifieras.');
        let origin:string|undefined;
        try{const approved=new URL(value.gameOrigin);if(approved.protocol==='https:'&&approved.origin===value.gameOrigin)origin=approved.origin;}catch{/* A missing configuration cannot enable launch-link actions. */}
        if(!controller.signal.aborted){setGameOrigin(origin);setActions(origin?value.availableActions:value.availableActions.filter((action:string)=>action!=='POST apikeys/launch'));}
      }catch(cause){if(!controller.signal.aborted)setError((cause as Error).message);}
    })();
    return()=>controller.abort();
  },[refresh]);
  const content=group==='operations'
    ?<div className={adminStyles.embedded}><StudioAdministration key={group} apiBase="/studio/api/admin" session={readAdminSession} availableActions={actions??undefined} gameOrigin={gameOrigin} initialGroup={group} readIdentity="response-headers-v1" companyTeamLabel="Bolag och spelbord" showGroupNavigation={false}/></div>
    :<NativeAdministration key={group+(section??'')} embedded apiBase="/studio/api/admin" availableActions={actions??[]} gameOrigin={gameOrigin} initialGroup={group} sections={section?[section]:undefined} sharedRead={sharedRead}/>;
  return <section className="admin-system-page admin-accounts-page">{error?<div role="alert"><p>{error}</p><button className="studio-button" onClick={()=>setRefresh(value=>value+1)}>Försök igen</button></div>:actions===null?<p role="status">Läser session och anslutna funktioner…</p>:content}</section>;
}

// One journal read serves both the economy overview and the payment journal under System › Spelarkonton.
export function EconomyPanel({active}:{active:boolean}) {
  const [journal]=useState(()=>sharedStudioAdminRead(['transactions']));
  return <div className="hub-stack hub-mt-l"><ConnectedEconomy journal={journal} active={active}/><Administration group="finance" sharedRead={journal}/></div>;
}
