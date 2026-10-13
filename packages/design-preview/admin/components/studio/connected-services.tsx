import { useEffect, useState } from 'react';
import { OpenClawWorkspace } from '../../../../../lab/components/openclaw-workspace';
import { NativeAdministration } from '../../../../../lab/components/native-administration';

const groups: Record<string,string> = {
  '/control/drift':'operations', '/control/ekonomi':'finance',
  '/control/admin/accounts':'accounts', '/control/admin/players':'accounts',
  '/control/admin/payments':'finance', '/control/admin/api':'partners',
};

function Administration({group}:{group:string}) {
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
  return <section className="p-5">{error?<div role="alert"><p>{error}</p><button className="studio-button" onClick={()=>setRefresh(value=>value+1)}>Försök igen</button></div>:actions===null?<p role="status">Läser session och anslutna funktioner…</p>:<NativeAdministration key={group} apiBase="/studio/api/admin" availableActions={actions} gameOrigin={gameOrigin} initialGroup={group}/>}</section>;
}

export function ConnectedServices({path}:{path:string}) {
  if(path==='/control/ai/models')return <div className="p-5"><p className="studio-detail-panel p-4 text-sm">Gatewayinställningarna nedan gäller OpenClaw. <a href="/admin/ai/chat" className="text-sg-lime underline">Studioassistenten</a> har egna fasta roller: Luna 5.6 för samtal och Sol 5.6 High för klippkartläggning.</p><OpenClawWorkspace navigation={{models:'/admin/ai/models',chat:'/admin/ai/chat',studio:'/admin/clips'}}/></div>;
  if(groups[path])return <Administration group={groups[path]}/>;
  return <section className="studio-detail-panel p-5"><h1>Ändringslogg</h1><p>Den gemensamma ändringsloggen har ännu inget anslutet läs-API. Bolagets beständiga ändringsjournal finns i Bolag & team.</p></section>;
}
