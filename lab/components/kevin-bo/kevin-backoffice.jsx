'use client';

import React from 'react';
import { labUrl } from '../../lib/lab-url.mjs';
import { assetUrl } from './assets.mjs';
import { createOriginalViews } from './original-views.jsx';
import { createPreviewRuntime, validatePreviewSnapshot } from './preview-runtime.mjs';
import { destinationsFor, normalizeView, INTERNAL_LINKS } from './navigation.mjs';
import './original.css';
import './preview.css';

class ViewBoundary extends React.Component {
  state = { failed:false };
  static getDerivedStateFromError() { return {failed:true}; }
  render() {
    return this.state.failed ? <div className="page-b"><section className="panel"><div className="panel-h"><h2>Vyn kunde inte visas</h2></div><div className="note">Denna del behöver färdigställas. Ingen ändring har gjorts i spelet.</div></section></div> : this.props.children;
  }
}

// Remount on a server-side context change before the old context can paint.
export function KevinBackoffice(props) {
  return <PreviewSession key={`${props.surface}:${props.initialSnapshot?.operator?.id}:${props.user}`} {...props}/>;
}

function PreviewSession({surface,initialSnapshot,apiBase,user,initialView='ops'}) {
  const [snapshot,setSnapshot]=React.useState(()=>validatePreviewSnapshot(initialSnapshot));
  const [view,setView]=React.useState(()=>normalizeView(initialView,surface)||'ops');
  const [message,setMessage]=React.useState(''),[error,setError]=React.useState(''),[loading,setLoading]=React.useState(false);
  const request=React.useRef(null),sequence=React.useRef(0),refreshRef=React.useRef(null),runtimeRef=React.useRef(null);
  const notify=React.useCallback(value=>setMessage(value),[]);
  const runtime=React.useMemo(()=>snapshot?createPreviewRuntime(snapshot,{surface,user,notify,assetUrl,studioUrl:labUrl,refresh:()=>refreshRef.current?.()}):null,[snapshot,surface,user,notify]);
  runtimeRef.current=runtime;
  const original=React.useMemo(()=>runtime?createOriginalViews(runtime):null,[runtime]);
  const navigation=destinationsFor(surface);
  const groups=[...new Set(navigation.map(item=>item.group))];

  React.useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),6000);return()=>clearTimeout(timer);},[message]);
  React.useEffect(()=>()=>{sequence.current++;request.current?.abort();},[]);
  React.useEffect(()=>{
    const onHash=()=>{const raw=window.location.hash.slice(1);if(!raw)return;const allowed=normalizeView(raw,surface);if(allowed){setView(allowed);setMessage('');}else{setView('unavailable');}};
    onHash();window.addEventListener('hashchange',onHash);return()=>window.removeEventListener('hashchange',onHash);
  },[surface]);
  React.useEffect(()=>{
    const beforeUnload=event=>{if(runtimeRef.current?.dirty){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',beforeUnload);return()=>window.removeEventListener('beforeunload',beforeUnload);
  },[]);

  const load=React.useCallback(async(operatorId,{checkOnly=false}={})=>{
    if(!['/api/partner-preview','/studio/api/partner-preview'].includes(apiBase)) {setSnapshot(null);setError('Förhandsvisningens anslutning är inte tillgänglig.');return;}
    if(!checkOnly&&runtimeRef.current?.dirty&&!window.confirm('Lokala utkast försvinner vid byte eller omladdning. Fortsätt?'))return;
    const current=++sequence.current;request.current?.abort();const controller=new AbortController();request.current=controller;
    setLoading(true);setError('');
    // Do not leave the previous organisation visible while a new one is fetched.
    if(!checkOnly)setSnapshot(null);
    try {
      const response=await fetch(`${apiBase}?operator=${encodeURIComponent(operatorId)}`,{credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
      if(!response.ok)throw Error(response.status===401||response.status===403?'Din administratörssession är inte längre giltig. Logga in igen.':'Förhandsvisningen kunde inte hämtas. Inga gamla data visas.');
      const next=validatePreviewSnapshot(await response.json());
      if(next.viewer.user!==user)throw Error('Administratörskontot har ändrats. Förhandsvisningen har stängts. Ladda om och logga in igen.');
      if(next.operator.id!==operatorId)throw Error('Fel operatörskontext i svaret. Förhandsvisningen har stängts.');
      if(current!==sequence.current||controller.signal.aborted)return;
      if(!checkOnly){
        setSnapshot(next);
        if(surface==='partner'){
          const base=window.location.pathname.startsWith('/studio/')?'/studio':'';
          const section=normalizeView(view,surface)||'ops';
          window.history.replaceState(window.history.state,'',`${base}/partner/${encodeURIComponent(next.operator.slug)}/${section}${window.location.hash}`);
        }
      }
      setLoading(false);
    }catch(failure){if(controller.signal.aborted||current!==sequence.current)return;setSnapshot(null);setError(failure.message);setLoading(false);}
  },[apiBase,surface,view,user]);
  refreshRef.current=()=>snapshot&&load(snapshot.operator.id);
  React.useEffect(()=>{
    const onFocus=()=>{const current=runtimeRef.current?.snapshot;if(current)void load(current.operator.id,{checkOnly:true});};
    window.addEventListener('focus',onFocus);return()=>window.removeEventListener('focus',onFocus);
  },[load]);
  const go=id=>{if(!normalizeView(id,surface))return;setView(id);window.location.hash=id;};
  const target=INTERNAL_LINKS[view];
  const description=surface==='partner'?'Nivå 2 · Partnerportal':'Nivå 1 · Kontrollpanel';
  return <div className="kevin-bo" data-surface={surface} data-preview="fixture">
    {!snapshot||!runtime||!original?<div className="kevin-session-state" role={error?'alert':'status'}><h1>{error?'Förhandsvisningen är stängd':'Hämtar förhandsvisning…'}</h1>{error&&<><p>{error}</p><a className="btn" href={labUrl('/login')}>Till inloggning</a></>}</div>:<div className="app">
      <aside className="side">
        <div className="side-brand"><original.Mark/><div><div className="side-word">scout<span style={{color:'var(--steel)'}}>/</span>gaming</div><div className="side-sub">{description}</div></div></div>
        <div className="side-op"><label htmlFor="kevin-operator" className="side-opl"><span className="muted">Exempeloperatör</span><b>{snapshot.operator.name}</b></label>{surface==='partner'?<select id="kevin-operator" className="select side-scope" value={snapshot.operator.id} disabled={loading} onChange={event=>void load(event.target.value)}>{snapshot.operators.map(operator=><option key={operator.id} value={operator.id}>{operator.name}</option>)}</select>:<span className="muted">Byt exempeloperatör i nivå 2</span>}</div>
        <nav className="side-nav" aria-label={description}>{groups.map(group=><div className="nav-g" key={group}><div className="nav-gl">{group}</div>{navigation.filter(item=>item.group===group).map(item=><button type="button" key={item.id} onClick={()=>go(item.id)} className={`nav-i${view===item.id?' on':''}`} aria-current={view===item.id?'page':undefined}><span>{item.label}</span>{item.owner==='planned'&&<span className="kevin-planned">Planerat</span>}</button>)}</div>)}</nav>
        <div className="side-user"><div className="avatar">{user.slice(0,2).toUpperCase()}</div><div><b>{user}</b><div className="side-role">Intern administratör · förhandsvisning</div></div></div>
      </aside>
      <main className="main">
        <div className="kevin-preview-banner" role="status"><div><strong>Intern förhandsvisning – exempeldata, inget ändras i spelet</strong><span>Lokala designutkast försvinner vid omladdning eller operatörsbyte. Verkliga spelare, pengar och personal är inte anslutna.</span></div><div className="kevin-preview-actions"><a className="btn sm" href={labUrl(surface==='partner'?'/control':'/partner')}>{surface==='partner'?'Visa nivå 1':'Visa nivå 2'}</a><button type="button" className="btn sm" onClick={()=>void load(snapshot.operator.id)} disabled={loading}>Hämta på nytt</button></div></div>
        <div className="mobile-nav"><select className="select" aria-label="Page" value={view} onChange={event=>go(event.target.value)}>{navigation.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
        {surface==='internal'&&target&&<div className="kevin-internal-link"><span>Detta arbetsverktyg hör till intern personal.</span><a href={labUrl(target[0])}>{target[1]} →</a></div>}
        <ViewBoundary key={`${view}:${snapshot.operator.id}:${snapshot.generatedAt}`}><PreviewView original={original} runtime={runtime} view={view} notify={notify}/></ViewBoundary>
      </main>
      {message&&<div className="toast" role="status">{message}</div>}
    </div>}
  </div>;
}

function PreviewView({original,runtime,view,notify}) {
  const [tables,setTables]=React.useState(runtime.data.tables),[attention,setAttention]=React.useState([]);
  const View=original.views[view];
  if(!View)return <div className="page-b"><original.EmptyState title="Ytan hör inte till denna nivå" body="Välj en tillgänglig sida i menyn."/></div>;
  if(view==='api')return <><div className="kevin-internal-link">Integrationer, nyckelhantering, spelstarter och plånböcker är inte anslutna. Kontrollerna nedan visar den planerade ytan.</div><fieldset disabled className="kevin-disabled-surface"><View toast={notify} brand="scout" role={runtime.surface==='internal'?'superadmin':'admin'}/></fieldset></>;
  return <View toast={notify} brand="scout" tables={tables} setTables={setTables} attention={attention} setAttention={setAttention} role={runtime.surface==='internal'?'superadmin':'admin'}/>;
}
