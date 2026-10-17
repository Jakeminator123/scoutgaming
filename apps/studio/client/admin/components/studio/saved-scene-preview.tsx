import {useEffect,useRef,useState} from 'react';
import {createStudioPreview,type StudioPreviewSession} from '../../../../lib/studio-preview-client.mjs';

export type SavedScenePreviewProps={
  active:boolean; presentationLaneId?:string; revision?:string; dealerId?:string; game?:string;
  blocked?:boolean; reason?:string; onStart?:()=>void;
};

export function SavedScenePreview(props:SavedScenePreviewProps){
  const {active,presentationLaneId,revision,dealerId,game,blocked=false,reason,onStart}=props;
  const [session,setSession]=useState<StudioPreviewSession|null>(null),[starting,setStarting]=useState(false);
  const [message,setMessage]=useState(''),[error,setError]=useState('');
  const frame=useRef<HTMLIFrameElement>(null),mounted=useRef(true),generation=useRef(0);
  const pending=useRef(false),currentSession=useRef<StudioPreviewSession|null>(null);
  const contextKey=JSON.stringify([presentationLaneId,revision,dealerId,game]);
  const latest=useRef({active,blocked,contextKey});latest.current={active,blocked,contextKey};
  const unavailable=game!=='blackjack'?'Provspelningen stöder Blackjack.'
    :!presentationLaneId?'Välj en sparad sammansättning för att provspela.'
    :!revision?'Läs in den sparade projektrevisionen först.'
    :blocked?reason||'Spara eller avsluta det pågående arbetet före provspelning.':'';

  async function closeSession(value:StudioPreviewSession){
    const response=await fetch('/api/studio-preview/'+value.sessionId,{method:'DELETE',credentials:'same-origin',cache:'no-store',redirect:'error',keepalive:true});
    if(!response.ok&&![404,410].includes(response.status))throw Error('Uppspelningen är stoppad, men servern kunde inte bekräfta stängningen. Sessionen upphör automatiskt.');
  }
  function stop(note='Provspelningen är stoppad.'){
    const value=currentSession.current,hadWork=Boolean(value)||pending.current,epoch=++generation.current;
    currentSession.current=null;
    if(mounted.current){setSession(null);if(hadWork)setMessage(note);}
    if(value)void closeSession(value).catch(cause=>{if(mounted.current&&generation.current===epoch)setError(cause instanceof Error?cause.message:'Serverns stängning kunde inte bekräftas.');});
  }
  const stopRef=useRef(stop);stopRef.current=stop;
  useEffect(()=>{mounted.current=true;const hidden=()=>{if(document.hidden)stopRef.current();};
    const requested=(event:MessageEvent)=>{
      const value=currentSession.current;
      if(value&&event.origin===location.origin&&event.source===frame.current?.contentWindow
        &&event.data?.type==='croupier:studio-preview-close'&&event.data.sessionId===value.sessionId)stopRef.current();
    };
    document.addEventListener('visibilitychange',hidden);window.addEventListener('message',requested);
    return()=>{mounted.current=false;document.removeEventListener('visibilitychange',hidden);window.removeEventListener('message',requested);stopRef.current();};
  },[]);
  useEffect(()=>{stopRef.current();},[active,blocked,contextKey]);

  async function start(){
    if(!active||unavailable||pending.current||currentSession.current||document.hidden)return;
    const epoch=++generation.current,key=contextKey;
    pending.current=true;setStarting(true);setError('');setMessage('Startar sparad scen…');
    try{
      onStart?.();
      // Read the response even after hiding: an allocated session must be closed.
      const value=await createStudioPreview({presentationLaneId:presentationLaneId!,expectedProjectRevision:revision!});
      if(!mounted.current||epoch!==generation.current||latest.current.contextKey!==key||!latest.current.active||latest.current.blocked||document.hidden){
        await closeSession(value);return;
      }
      currentSession.current=value;setSession(value);setMessage('Laddar provspelet…');
    }catch(cause){if(mounted.current&&epoch===generation.current){setError(cause instanceof Error?cause.message:'Provspelningen kunde inte startas.');setMessage('');}}
    finally{pending.current=false;if(mounted.current)setStarting(false);}
  }
  function frameLoaded(){
    const value=currentSession.current;if(!value||!frame.current)return;
    try{
      const page=frame.current.contentWindow,raw=frame.current.contentDocument?.documentElement.dataset.studioPreview;
      const bound=raw?JSON.parse(raw):null;
      if(page?.location.pathname!==value.entryUrl||bound?.sessionId!==value.sessionId||bound.projectRevision!==value.projectRevision||bound.presentationLaneId!==value.presentationLaneId)throw Error();
      setMessage('Sparad scen öppnad · Blackjack med separat testsaldo.');
    }catch{stop('');setError('Provspelet kunde inte laddas eller sessionen har gått ut. Starta igen efter att du kontrollerat inloggningen.');}
  }
  return <section className="saved-scene-preview" aria-label="Provspela sparad scen">
    <div className="saved-scene-preview-actions"><button type="button" className="studio-button" disabled={!active||Boolean(unavailable)||starting||Boolean(session)} onClick={()=>void start()}>{starting?'Startar provspelning…':'Provspela sparad scen'}</button>
      {(session||starting)&&<button type="button" className="studio-button" onClick={()=>stop()}>Stoppa provspelning</button>}</div>
    {unavailable&&<p>{unavailable}</p>}{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
    {session&&active&&!blocked&&<iframe ref={frame} title="Sparad scen · Blackjack med testsaldo" src={session.entryUrl} onLoad={frameLoaded} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin"/>}
    <details><summary>Detaljer</summary><p>Provar den sparade sammansättningens startdealer och bibliotek i ett separat provspel. Ingen publicering sker. Chatt och genererat tal är avstängda.</p><p>Projektrevision: {session?.projectRevision??revision??'Ej inläst'}.</p></details>
  </section>;
}
