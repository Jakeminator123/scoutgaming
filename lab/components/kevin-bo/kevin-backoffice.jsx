'use client';

import React from 'react';
import { labUrl } from '../../lib/lab-url.mjs';
import { assetUrl } from './assets.mjs';
import { createOriginalViews } from './original-views.jsx';
import { TeamView } from './views/team.jsx';
import { createPreviewRuntime, operatorPackageRevision, sectionNotConnected, validatePreviewSnapshot } from './preview-runtime.mjs';
import { destinationsFor, normalizeView, INTERNAL_LINKS } from './navigation.mjs';
import { resolveWorkspaceSurfacePath, workspaceSurfacePath } from '../../lib/workspace-surfaces.mjs';
import { PartnerAppearanceLoader } from '../partner-appearance-loader.mjs';
import { partnerPackageProfiles } from '../../lib/partner-package-view.mjs';
import { PartnerPackageView } from '../partner-package-view.mjs';
import { partnerTeamView } from '../partner-team-loader.mjs';
import { partnerNavigation, usePartnerPreferences } from './partner-copy.mjs';
import { PartnerSessionActions } from '../partner-session-actions';
import { createPartnerLeaveGuard, partnerWorkspaceView } from './partner-navigation-guard.mjs';
import './original.css';
import './preview.css';
import './john-foundation.css';

class ViewBoundary extends React.Component {
  state = { failed:false };
  static getDerivedStateFromError() { return {failed:true}; }
  render() {
    return this.state.failed ? <div className="page-b"><section className="panel"><div className="panel-h"><h2>Vyn kunde inte visas</h2></div><div className="note">Denna del behöver färdigställas. Ingen ändring har gjorts i spelet.</div></section></div> : this.props.children;
  }
}

const DISCONNECTED = {
  players: ['Spelare', 'Spelarkonton för den här operatören är inte anslutna.', '/control/administration', 'Öppna administration'],
  tx: ['Transaktioner', 'Transaktioner för den här operatören är inte anslutna.', '/control/administration', 'Öppna administration'],
  reports: ['Rapporter', 'Rapporter för den här operatören är inte anslutna.', null, 'Öppna integrationer'],
};

function dataSection(view) {
  return view === 'tx' ? 'transactions' : view;
}

// Remount on a server-side context change before the old context can paint.
export function KevinBackoffice(props) {
  return <PreviewSession key={`${props.surface}:${props.initialSnapshot?.operator?.id}:${props.user}`} {...props}/>;
}

function PreviewSession({surface,initialSnapshot,apiBase,user,initialView='ops'}) {
  const preferences=usePartnerPreferences(),{copy,language,theme}=preferences;
  const [snapshot,setSnapshot]=React.useState(()=>validatePreviewSnapshot(initialSnapshot));
  const [view,setView]=React.useState(()=>initialSnapshot?.preview===false?partnerWorkspaceView(normalizeView(initialView,surface)||'ops'):normalizeView(initialView,surface)||'ops');
  const [message,setMessage]=React.useState(''),[error,setError]=React.useState(''),[loading,setLoading]=React.useState(false);
  const request=React.useRef(null),sequence=React.useRef(0),refreshRef=React.useRef(null),runtimeRef=React.useRef(null);
  const notify=React.useCallback(value=>setMessage(value),[]);
  const [appearanceDirty,setAppearanceDirty]=React.useState(false);
  const dirtyRef=React.useRef(false),copyRef=React.useRef(copy),locationRef=React.useRef(null),leaveGuard=React.useRef(null);
  copyRef.current=copy;
  if(!leaveGuard.current)leaveGuard.current=createPartnerLeaveGuard({isDirty:()=>dirtyRef.current||Boolean(runtimeRef.current?.dirty),confirmLeave:()=>window.confirm(copyRef.current.unsavedLeave)});
  const onAppearanceDirty=React.useCallback(dirty=>{dirtyRef.current=dirty;setAppearanceDirty(dirty);leaveGuard.current.reset();},[]);
  const runtime=React.useMemo(()=>snapshot?createPreviewRuntime(snapshot,{surface,user,notify,assetUrl,studioUrl:labUrl,refresh:()=>refreshRef.current?.(),teamView:snapshot.preview===false&&surface==='partner'?partnerTeamView(apiBase,TeamView):TeamView}):null,[snapshot,surface,user,notify,apiBase]);
  runtimeRef.current=runtime;
  const original=React.useMemo(()=>runtime?createOriginalViews(runtime):null,[runtime]);
  const real=snapshot?.preview===false;
  const admin=real&&snapshot.accessClass==='internal-admin';
  const navigation=real&&surface==='partner'?partnerNavigation(language,snapshot.permissions):destinationsFor(surface);
  const groups=[...new Set(navigation.map(item=>item.group))];
  const surfaceName=surface==='partner'?'partner':'control';
  const viewPath=id=>workspaceSurfacePath(surfaceName,id,snapshot?.operator.slug);
  const previewMode=initialSnapshot?.preview===false?'operator':'fixture';

  React.useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),6000);return()=>clearTimeout(timer);},[message]);
  React.useEffect(()=>()=>{sequence.current++;request.current?.abort();},[]);
  React.useEffect(()=>{
    if(!snapshot)return;
    const navigate=()=>{
      const route=resolveWorkspaceSurfacePath(window.location.pathname);
      if(route?.operatorSlug&&route.operatorSlug!==snapshot.operator.slug){if(leaveGuard.current.requestLeave())window.location.reload();else if(locationRef.current)window.history.replaceState(window.history.state,'',locationRef.current);return;}
      const raw=window.location.hash.slice(1);
      const candidate=raw?normalizeView(raw,surface):route?.view;
      const allowed=snapshot.preview===false?partnerWorkspaceView(candidate):candidate;
      if(!allowed){if(raw)setView('unavailable');return;}
      setView(allowed);setMessage('');
      const destination=workspaceSurfacePath(surfaceName,allowed,snapshot.operator.slug);
      if(destination&&(window.location.pathname!==destination||raw))window.history.replaceState(window.history.state,'',destination);
      locationRef.current=destination;
    };
    navigate();window.addEventListener('hashchange',navigate);window.addEventListener('popstate',navigate);
    return()=>{window.removeEventListener('hashchange',navigate);window.removeEventListener('popstate',navigate);};
  },[surface,surfaceName,snapshot?.operator.slug]);
  React.useEffect(()=>{
    const beforeUnload=event=>leaveGuard.current.beforeUnload(event);
    const reset=()=>leaveGuard.current.reset();
    window.addEventListener('beforeunload',beforeUnload);window.addEventListener('pageshow',reset);return()=>{window.removeEventListener('beforeunload',beforeUnload);window.removeEventListener('pageshow',reset);};
  },[]);

  const load=React.useCallback(async(operatorId,{checkOnly=false}={})=>{
    if(snapshot?.preview===false)return;
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
      if(next.preview!==true)throw Error('Förhandsvisningen kunde inte hämtas. Inga gamla data visas.');
      if(next.viewer.user!==user)throw Error('Administratörskontot har ändrats. Förhandsvisningen har stängts. Ladda om och logga in igen.');
      if(next.operator.id!==operatorId)throw Error('Fel operatörskontext i svaret. Förhandsvisningen har stängts.');
      if(current!==sequence.current||controller.signal.aborted)return;
      if(!checkOnly){
        setSnapshot(next);
        if(surface==='partner'){
          const section=normalizeView(view,surface)||'ops';
          window.history.replaceState(window.history.state,'',workspaceSurfacePath('partner',section,next.operator.slug));
        }
      }
      setLoading(false);
    }catch(failure){if(controller.signal.aborted||current!==sequence.current)return;setSnapshot(null);setError(failure.message);setLoading(false);}
  },[apiBase,snapshot?.preview,surface,view,user]);
  refreshRef.current=()=>snapshot&&snapshot.preview!==false&&load(snapshot.operator.id);
  React.useEffect(()=>{
    if(!snapshot||snapshot.preview===false)return;
    const onFocus=()=>{const current=runtimeRef.current?.snapshot;if(current?.preview!==false)void load(current.operator.id,{checkOnly:true});};
    window.addEventListener('focus',onFocus);return()=>window.removeEventListener('focus',onFocus);
  },[load,snapshot?.preview]);
  const go=id=>{const next=real?partnerWorkspaceView(id):id;const destination=viewPath(next);if(!destination)return;setView(next);setMessage('');locationRef.current=destination;if(window.location.pathname!==destination||window.location.hash)window.history.pushState(window.history.state,'',destination);};
  const navigateLink=event=>{
    if(!real||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const anchor=event.target.closest?.('a[href]');if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download'))return;
    const url=new URL(anchor.href,window.location.href),route=resolveWorkspaceSurfacePath(url.pathname);
    if(url.origin===window.location.origin&&route?.surface==='partner'&&route.operatorSlug===snapshot.operator.slug&&route.view){event.preventDefault();go(route.view);}
  };
  const switchOperator=operatorId=>{
    const next=snapshot?.operators.find(item=>item.id===operatorId);
    const destination=next&&workspaceSurfacePath('partner',normalizeView(view,surface)||'ops',next.slug);
    if(destination&&leaveGuard.current.requestLeave())window.location.assign(destination);
  };
  const target=INTERNAL_LINKS[view];
  const description=surface==='partner'&&real?copy.level:surface==='partner'?'Nivå 2 · Partnerportal':'Nivå 1 · Kontrollpanel';
  const page=navigation.find(item=>item.id===view);
  const disconnected=Boolean(snapshot&&sectionNotConnected(snapshot,dataSection(view)));
  const revision=operatorPackageRevision(snapshot);
  return <div className="kevin-bo" onClick={navigateLink} data-surface={surface} data-preview={previewMode} data-theme={real?theme:undefined} lang={real?language:undefined}>
    {!snapshot||!runtime||!original?<div className="kevin-session-state" role={error?'alert':'status'}><h1>{error?'Förhandsvisningen är stängd':'Hämtar förhandsvisning…'}</h1>{error&&<><p>{error}</p><a className="btn" href={labUrl('/login')}>Till inloggning</a></>}</div>:<div className="app">
      <aside className="side">
        <div className="side-brand"><original.Mark/><div><div className="side-word">scout<span style={{color:'var(--steel)'}}>/</span>gaming</div><div className="side-sub">{description}</div></div></div>
        <OperatorScope snapshot={snapshot} surface={surface} loading={loading} copy={copy} onFixtureChange={operatorId=>void load(operatorId)} onOperatorChange={switchOperator}/>
        <nav className="side-nav" aria-label={description}>{groups.map(group=><NavigationGroup key={group} real={real&&surface==='partner'} group={group}>{navigation.filter(item=>item.group===group).map(item=><a href={viewPath(item.id)} key={item.id} onClick={event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();go(item.id);}} className={`nav-i${view===item.id?' on':''}`} aria-current={view===item.id?'page':undefined}><span>{item.label}</span>{item.owner==='planned'&&<span className="kevin-planned">Planerat</span>}</a>)}</NavigationGroup>)}</nav>
        <div className="side-user"><div className="avatar">{user.slice(0,2).toUpperCase()}</div><div><b>{user}</b><div className="side-role">{real?(admin?copy.admin:copy.member):'Intern administratör · förhandsvisning'}</div></div></div>
      </aside>
      <main className="main">
        {real?<header className="kevin-operator-header"><div className="kevin-context"><a href="/partner">{copy.directory}</a><span aria-hidden="true">/</span><strong>{snapshot.operator.name}</strong>{revision?<span className="kevin-package-revision">{copy.revision} {revision}</span>:null}</div><div className="kevin-header-actions">{admin&&<><a href="/control">{copy.control} ↗</a><a href="/play">{copy.player} ↗</a></>}<PartnerPreferences preferences={preferences}/>{surface==='partner'&&<PartnerSessionActions apiBase={apiBase} accessClass={snapshot.accessClass} language={language} returnTo={viewPath(view)} beforeNavigate={()=>leaveGuard.current.requestLeave()} onNavigationCancelled={()=>leaveGuard.current.reset()}/>}</div></header>:<div className="kevin-preview-banner" role="status"><div><strong>Intern förhandsvisning – exempeldata, inget ändras i spelet</strong><span>Lokala designutkast försvinner vid omladdning eller operatörsbyte. Verkliga spelare, pengar och personal är inte anslutna.</span></div><div className="kevin-preview-actions">{surface==='partner'&&<a className="btn sm" href="/partner">Partnerportal</a>}<a className="btn sm" href={surface==='partner'?'/control':'/partner'}>{surface==='partner'?'Visa nivå 1':'Visa nivå 2'}</a><a className="btn sm" href="/play">Spelaryta</a><button type="button" className="btn sm" onClick={()=>void load(snapshot.operator.id)} disabled={loading}>Hämta på nytt</button></div></div>}
        <div className="mobile-nav"><select className="select" aria-label={real?copy.menu:'Sida'} value={view} onChange={event=>go(event.target.value)}>{navigation.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
        {surface==='internal'&&target&&<div className="kevin-internal-link"><span>Detta arbetsverktyg hör till intern personal.</span><a href={labUrl(target[0])}>{target[1]} →</a></div>}
        {surface==='partner'&&!real&&['theme','design','background','bj','dealers','test'].includes(view)&&<section className="kevin-lane-status" aria-label="Presentationslane och spelkoppling"><div><strong>Visad presentationslane: {snapshot.presentations.map(profile=>profile.name).join(', ')||'Ingen tilldelad presentationslane'} <span>· exempel</span></strong><p>Ingen publicerad presentationslane är ansluten till denna förhandsvisning. Marker, kort, bord och bakgrund kan provas lokalt men skickas inte till spelet.</p></div><span className="kevin-connection-label">Spelkoppling saknas</span><p>Operatören väljer bland tilldelade, godkända presentationslanes. Klipp, masker, urvalsregler och publicering hanteras i Kontrollpanelen.</p></section>}
        {page&&(real?<header className="kevin-page-header"><p className="kevin-eyebrow">{snapshot.operator.name}</p><h1 className="kevin-shell-heading">{page.label}</h1>{['ops','bj'].includes(view)&&<p className="kevin-page-intro">{view==='ops'?copy.overviewIntro:copy.tablesIntro}</p>}</header>:!disconnected&&<h2 className="kevin-shell-heading">{page.label}</h2>)}
        {real&&appearanceDirty&&view!=='bj'&&<div className="kevin-draft-reminder" role="status"><a href={viewPath('bj')}>{copy.draftKept} →</a></div>}
        <ViewBoundary key={`${real?'workspace':view}:${snapshot.operator.id}:${snapshot.generatedAt}`}><PreviewView original={original} runtime={runtime} view={view} copy={copy} language={language} notify={notify} apiBase={apiBase} onAppearanceDirty={onAppearanceDirty} onAppearanceSaved={saved=>setSnapshot(current=>{
          if(current?.preview!==false||current.operator.id!==saved.operatorId||!saved.presentation)return current;
          const previous=Number(current.packageRevision??current.operator.packageRevision);
          if(Number.isSafeInteger(previous)&&saved.packageRevision<=previous)return current;
          return {...current,packageRevision:String(saved.packageRevision),operator:{...current.operator,packageRevision:String(saved.packageRevision)},
            branding:saved.branding,presentation:saved.presentation,presentations:partnerPackageProfiles(saved.presentation,saved.branding,current.operator.id)};
        })}/></ViewBoundary>
      </main>
      {message&&<div className="toast" role="status">{message}</div>}
    </div>}
  </div>;
}

function NavigationGroup({real,group,children}) {
  return real?<details className="nav-g" open><summary className="nav-gl">{group}</summary>{children}</details>:<div className="nav-g"><div className="nav-gl">{group}</div>{children}</div>;
}

function PartnerPreferences({preferences:{copy,language,theme,setLanguage,setTheme}}) {
  return <div className="kevin-preferences"><label>{copy.language}<select className="select" value={language} onChange={event=>setLanguage(event.target.value)}><option value="sv">Svenska</option><option value="en">English</option></select></label><label>{copy.theme}<select className="select" value={theme} onChange={event=>setTheme(event.target.value)}><option value="light">{copy.light}</option><option value="dark">{copy.dark}</option></select></label></div>;
}

function OperatorScope({snapshot,surface,loading,copy,onFixtureChange,onOperatorChange}) {
  const many=snapshot.operators.length>1;
  if(snapshot.preview===false)return <div className="side-op"><div className="side-opl"><span className="muted">{copy.company}</span><b>{snapshot.operator.name}</b></div>{many?<select id="kevin-operator" className="select side-scope" aria-label={copy.company} value={snapshot.operator.id} disabled={loading} onChange={event=>onOperatorChange(event.target.value)}>{snapshot.operators.map(operator=><option key={operator.id} value={operator.id}>{operator.name}</option>)}</select>:null}</div>;
  return <div className="side-op"><label htmlFor="kevin-operator" className="side-opl"><span className="muted">Exempeloperatör</span><b>{snapshot.operator.name}</b></label>{surface==='partner'?<select id="kevin-operator" className="select side-scope" value={snapshot.operator.id} disabled={loading} onChange={event=>onFixtureChange(event.target.value)}>{snapshot.operators.map(operator=><option key={operator.id} value={operator.id}>{operator.name}</option>)}</select>:<span className="muted">Byt exempeloperatör i nivå 2</span>}</div>;
}

function DisconnectedSection({snapshot,view,copy}) {
  if(snapshot.preview===false)return <div className="page-b kevin-disconnected"><section className="panel"><div className="empty"><span className="kevin-status-pill">{copy.notConnected}</span><h2>{view==='api'?copy.api:copy.unavailable}</h2><p>{view==='api'?copy.apiBody:copy.unavailableBody}</p>{view==='api'&&<><h3>{copy.unavailable}</h3><p>{copy.unavailableBody}</p></>}</div></section></div>;
  const [title,body,href,action]=DISCONNECTED[view];
  const destination=href||workspaceSurfacePath('partner','api',snapshot.operator.slug)||'#api';
  return <div className="page-b kevin-disconnected"><section className="panel"><div className="empty"><h2>{title}</h2><p>{body}</p><a className="btn primary" href={destination}>{action}</a></div></section></div>;
}

export function PreviewView({original,runtime,view,copy,language,notify,apiBase,onAppearanceSaved,onAppearanceDirty}) {
  const [tables,setTables]=React.useState(runtime.data.tables),[attention,setAttention]=React.useState([]);
  const [roomsVisited,setRoomsVisited]=React.useState(view==='bj');
  React.useEffect(()=>{if(view==='bj')setRoomsVisited(true);},[view]);
  if(runtime.surface==='partner'&&runtime.snapshot.preview===false){
    const Team=runtime.teamView;
    return <>
      {(roomsVisited||view==='bj')&&<div hidden={view!=='bj'} className="kevin-room-workspace"><PartnerRoomWorkspace active={view==='bj'} snapshot={runtime.snapshot} copy={copy} language={language} apiBase={apiBase} onSaved={onAppearanceSaved} onDirtyChange={onAppearanceDirty}/></div>}
      {view==='ops'?<PartnerLiveOverview snapshot={runtime.snapshot} copy={copy}/>:view==='team'&&typeof Team==='function'?<Team snapshot={runtime.snapshot} runtime={runtime} surface={runtime.surface} toast={notify} language={language}/>:view!=='bj'?<DisconnectedSection snapshot={runtime.snapshot} view={view} copy={copy}/>:null}
    </>;
  }
  if(DISCONNECTED[view]&&sectionNotConnected(runtime.snapshot,dataSection(view)))return <DisconnectedSection snapshot={runtime.snapshot} view={view} copy={copy}/>;
  if(view==='team'&&typeof runtime.teamView==='function'){
    const Team=runtime.teamView;
    return <Team snapshot={runtime.snapshot} runtime={runtime} surface={runtime.surface} toast={notify} language={language}/>;
  }
  // Unimplemented real views never fall through to Kevin's fixture runtime.
  if(runtime.surface==='partner'&&runtime.snapshot.preview===false)return <DisconnectedSection snapshot={runtime.snapshot} view={view} copy={copy}/>;
  const View=original.views[view];
  if(!View)return <div className="page-b"><original.EmptyState title="Ytan hör inte till denna nivå" body="Välj en tillgänglig sida i menyn."/></div>;
  if(view==='api')return <><div className="kevin-internal-link">Integrationer, nyckelhantering, spelstarter och plånböcker är inte anslutna. Kontrollerna nedan visar den planerade ytan.</div><fieldset disabled className="kevin-disabled-surface"><View toast={notify} brand="scout" role={runtime.surface==='internal'?'superadmin':'admin'}/></fieldset></>;
  return <View toast={notify} brand="scout" tables={tables} setTables={setTables} attention={attention} setAttention={setAttention} role={runtime.surface==='internal'?'superadmin':'admin'}/>;
}

export function PartnerLiveOverview({snapshot,copy,tablesOnly=false}) {
  const revision=operatorPackageRevision(snapshot),profiles=snapshot.presentations;
  const path=view=>workspaceSurfacePath('partner',view,snapshot.operator.slug);
  return <div className="page-b kevin-live-overview">
    {!tablesOnly&&<><div className="kevin-summary-grid"><section className="panel kevin-summary"><span>{copy.revision}</span><strong>{revision||'—'}</strong><small>{revision?copy.package:copy.packageMissing}</small></section><section className="panel kevin-summary"><span>{copy.profiles}</span><strong>{profiles.length}</strong><small>{copy.package}</small></section><section className="panel kevin-summary"><span>{copy.tableCount}</span><strong>{snapshot.tables.length}</strong><small>{copy.company}</small></section></div>
      <div className="kevin-live-grid"><section className="panel kevin-package-card"><h2>{revision?copy.package:copy.packageMissing}</h2><p>{revision?copy.readOnlyScope:copy.packageMissingBody}</p>{profiles.length>0&&<ul>{profiles.map(profile=><li key={profile.id}>{profile.name}</li>)}</ul>}<a className="btn primary" href={path('bj')}>{copy.roomSettings} →</a></section><section className="panel kevin-package-card"><span className="kevin-status-pill">{copy.notConnected}</span><h2>{copy.unavailable}</h2><p>{copy.unavailableBody}</p></section></div></>}
    <section className="panel kevin-table-panel"><div className="panel-h"><h2>{copy.tables}</h2>{!tablesOnly&&<a href={path('bj')}>{copy.tables} →</a>}</div>
      {snapshot.tables.length?<div className="scroll-x"><table className="tbl"><thead><tr><th>{copy.tables}</th><th>{copy.game}</th><th>{copy.status}</th><th>{copy.profile}</th></tr></thead><tbody>{snapshot.tables.map(table=><tr key={table.id}><td><strong>{table.name}</strong></td><td>{table.game==='blackjack'?'Blackjack':table.game}</td><td><span className="kevin-status-pill">{table.status==='active'?copy.configured:table.status==='draft'?copy.draft:table.status||'—'}</span></td><td>{profiles.find(profile=>profile.id===table.presentationId)?.name||table.presentationId||'—'}</td></tr>)}</tbody></table></div>:<div className="empty"><h3>{copy.noTables}</h3><p>{copy.noTablesBody}</p></div>}
    </section>
  </div>;
}

export function PartnerRoomWorkspace({snapshot,copy,language,apiBase,onSaved,onDirtyChange,active=true}) {
  const [roomId,setRoomId]=React.useState(()=>snapshot.tables.find(room=>room.operatorId===snapshot.operator.id)?.id??'');
  return <div className="page-b kevin-room-content">
    <label className="kevin-room-picker">{copy.tables}<select aria-label={copy.tables} value={roomId} onChange={event=>setRoomId(event.target.value)}><option value="">{copy.roomDefault}</option>{snapshot.tables.filter(room=>room.operatorId===snapshot.operator.id).map(room=><option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
    <PartnerPackageView snapshot={snapshot} view="test" roomId={roomId} language={language}/>
    <PartnerAppearanceLoader apiBase={apiBase} operatorId={snapshot.operator.id} operatorSlug={snapshot.operator.slug} section="all" language={language} active={active} roomId={roomId} onRoomChange={setRoomId} onDirtyChange={onDirtyChange} onSaved={onSaved}/>
  </div>;
}
