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

function AgentChat() {
  const [message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [dealer,setDealer]=useState(''),[dealers,setDealers]=useState<{id:string;label:string}[]>([]);
  const [messages,setMessages]=useState<{role:string;text:string}[]>([]);
  const [conversationId,setConversationId]=useState(()=>`studio-admin-${crypto.randomUUID()}`);
  useEffect(()=>{const leave=(event:BeforeUnloadEvent)=>{if(message.trim()||busy){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',leave);return()=>window.removeEventListener('beforeunload',leave);},[message,busy]);
  function changeDealer(id:string){if((message.trim()||messages.length)&&!confirm('Starta en ny konversation för den andra dealern?'))return;setDealer(id);setMessages([]);setMessage('');setConversationId(`studio-admin-${crypto.randomUUID()}`);}
  useEffect(()=>{const controller=new AbortController();void (async()=>{try{
    const response=await fetch('/studio/api/project',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal});
    if(!response.ok)throw Error('Dealers kunde inte läsas. Kontrollera din N1-session.');
    const value=await response.json();if(!Array.isArray(value.project?.dealers))throw Error('Dealerregistret saknas.');
    if(!controller.signal.aborted){setDealers(value.project.dealers);const requested=new URLSearchParams(location.search).get('dealer');setDealer(value.project.dealers.find((row:{id:string})=>row.id===requested)?.id??value.project.dealers[0]?.id??'');}
  }catch(cause){if(!controller.signal.aborted)setError((cause as Error).message);}})();return()=>controller.abort();},[]);
  async function send(){if(busy||!dealer||!message.trim())return;const text=message.trim();setBusy(true);setError('');try{
    const response=await fetch('/studio/api/chat',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(45000),headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,conversationId,dealerId:dealer})});
    const result=await response.json();if(!response.ok||typeof result.reply!=='string'||!result.reply.trim())throw Error([401,403].includes(response.status)?'Sessionen eller chattbehörigheten saknas.':'Agentanslutningen kunde inte ge ett svar. Ditt meddelande finns kvar.');
    setMessages(current=>[...current,{role:'Du',text},{role:'Agent',text:result.reply}]);setMessage('');
  }catch(cause){setError((cause as Error).message);}finally{setBusy(false);}}
  return <section className="studio-detail-panel p-5"><h1>Intern agentchatt</h1><label className="studio-field">Dealer<select value={dealer} disabled={busy} onChange={event=>changeDealer(event.target.value)}>{dealers.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label><div aria-live="polite">{messages.map((row,index)=><p key={index}><strong>{row.role}: </strong>{row.text}</p>)}</div><form onSubmit={event=>{event.preventDefault();void send();}}><label className="studio-field">Meddelande<textarea value={message} disabled={busy} maxLength={4000} onChange={event=>setMessage(event.target.value)}/></label><button className="studio-button" disabled={busy||!dealer||!message.trim()}>{busy?'Väntar på agent…':'Skicka till agenten'}</button></form>{error&&<p role="alert">{error}</p>}</section>;
}

export function ConnectedServices({path}:{path:string}) {
  if(path==='/control/ai/models')return <div className="p-5"><OpenClawWorkspace navigation={{models:'/admin/ai/models',chat:'/admin/ai/chat',studio:'/admin/clips'}}/></div>;
  if(path==='/control/ai/chat')return <AgentChat/>;
  if(groups[path])return <Administration group={groups[path]}/>;
  return <section className="studio-detail-panel p-5"><h1>Ändringslogg</h1><p>Den gemensamma ändringsloggen har ännu inget anslutet läs-API. Bolagets beständiga ändringsjournal finns i Bolag & team.</p></section>;
}
