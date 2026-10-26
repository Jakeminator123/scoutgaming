'use client';

import React from 'react';
import { studioHistory } from '../../lib/studio-history.mjs';
import { initialPartnerRoomSelection, partnerRoomRequest, partnerRoomQuery } from '../../lib/partner-room-selection.mjs';
import { Mark } from './views/shared.jsx';
import { PartnerLiveOverview } from './views/overview.jsx';
import { PartnerRoomWorkspace } from './views/rooms.jsx';
import { PartnerDisconnected } from './views/integration.jsx';
import { TeamView } from './views/team.jsx';
import { createPartnerWorkspaceContext, operatorPackageRevision, validatePartnerSnapshot } from './partner-workspace-context.mjs';
import { normalizeView } from './navigation.mjs';
import { resolveWorkspaceSurfacePath, workspaceSurfacePath } from '../../../../packages/navigation/workspace-surfaces.mjs';
import { partnerPackageProfiles } from '../../lib/partner-package-view.mjs';
import { partnerTeamView } from '../partner-team-loader.mjs';
import { partnerNavigation, usePartnerPreferences } from './partner-copy.mjs';
import { PartnerSessionActions } from '../partner-session-actions';
import { createPartnerLeaveGuard, partnerWorkspaceView } from './partner-navigation-guard.mjs';
import './views/live.css';
import './preview.css';
import './john-foundation.css';

class ViewBoundary extends React.Component {
  state = { failed:false };
  static getDerivedStateFromError() { return {failed:true}; }
  render() {
    return this.state.failed ? <div className="page-b"><section className="panel"><div className="panel-h"><h2>Vyn kunde inte visas</h2></div><div className="note">Denna del behöver färdigställas. Ingen ändring har gjorts i spelet.</div></section></div> : this.props.children;
  }
}

// Only the authorized live partner projection enters this client workspace.
// Remount before a changed operator or account can paint the old context.
export function PartnerOperatorWorkspace(props) {
  if(props.surface!=='partner'||props.initialSnapshot?.preview!==false)throw Error('En verklig partnerarbetsyta krävs.');
  return <PartnerSession key={`${props.surface}:${props.initialSnapshot?.operator?.id}:${props.user}`} {...props}/>;
}

function PartnerSession({initialSnapshot,apiBase,user,initialRoomId,initialRoomScope,initialView='ops'}) {
  const preferences=usePartnerPreferences(),{copy,language,theme}=preferences;
  const [snapshot,setSnapshot]=React.useState(()=>validatePartnerSnapshot(initialSnapshot));
  const [view,setView]=React.useState(()=>partnerWorkspaceView(normalizeView(initialView,'partner')||'ops'));
  const [message,setMessage]=React.useState('');
  const [roomRequest,setRoomRequest]=React.useState(()=>({roomId:initialRoomId,scope:initialRoomScope}));
  const roomSelection=initialPartnerRoomSelection(snapshot,roomRequest.roomId,roomRequest.scope);
  const notify=React.useCallback(value=>setMessage(value),[]);
  const [appearanceDirty,setAppearanceDirty]=React.useState(false);
  const dirtyRef=React.useRef(false),copyRef=React.useRef(copy),leaveGuard=React.useRef(null);
  copyRef.current=copy;
  if(!leaveGuard.current)leaveGuard.current=createPartnerLeaveGuard({isDirty:()=>dirtyRef.current,confirmLeave:()=>window.confirm(copyRef.current.unsavedLeave)});
  const onAppearanceDirty=React.useCallback(dirty=>{dirtyRef.current=dirty;setAppearanceDirty(dirty);leaveGuard.current.reset();},[]);
  const runtime=React.useMemo(()=>createPartnerWorkspaceContext(snapshot,{surface:'partner',user,notify,teamView:partnerTeamView(apiBase,TeamView)}),[snapshot,user,notify,apiBase]);
  const admin=snapshot.accessClass==='internal-admin';
  const navigation=partnerNavigation(language,snapshot.permissions);
  const groups=[...new Set(navigation.map(item=>item.group))];
  const viewPath=(id,request=roomRequest)=>{const path=workspaceSurfacePath('partner',id,snapshot.operator.slug);return path?path+partnerRoomQuery(request):null;};
  const lobbyQuery=new URLSearchParams({operator:snapshot.operator.slug});
  if(roomSelection.roomId)lobbyQuery.set('room',roomSelection.roomId);
  const lobbyHref=roomSelection.unavailable?null:'/lobby?'+lobbyQuery;

  React.useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),6000);return()=>clearTimeout(timer);},[message]);
  React.useEffect(()=>{
    const history=studioHistory(window);
    const releaseGuard=history.guardTraversal(href=>{
      const url=new URL(href,window.location.href),route=resolveWorkspaceSurfacePath(url.pathname),request=partnerRoomRequest(url.searchParams);
      // Valid room switches share the complete draft; an unavailable scope unmounts it.
      return route?.surface==='partner'&&route.operatorSlug===snapshot.operator.slug&&!initialPartnerRoomSelection(snapshot,request.roomId,request.scope).unavailable||leaveGuard.current.requestLeave();
    });
    const navigate=()=>{
      const route=resolveWorkspaceSurfacePath(window.location.pathname);
      if(route?.operatorSlug&&route.operatorSlug!==snapshot.operator.slug){window.location.reload();return;}
      const raw=window.location.hash.slice(1);
      const candidate=raw?normalizeView(raw,'partner'):route?.view;
      const allowed=partnerWorkspaceView(candidate);
      if(!allowed){if(raw)setView('unavailable');return;}
      const request=partnerRoomRequest(new URLSearchParams(window.location.search));
      setView(allowed);setMessage('');setRoomRequest(request);
      const destination=workspaceSurfacePath('partner',allowed,snapshot.operator.slug)+partnerRoomQuery(request);
      if(window.location.pathname+window.location.search!==destination||raw)history.replaceContext(destination);
    };
    const unsubscribe=history.subscribe(navigate);navigate();
    return()=>{unsubscribe();releaseGuard();};
  },[snapshot.operator.slug,snapshot.tables]);
  React.useEffect(()=>{
    const beforeUnload=event=>leaveGuard.current.beforeUnload(event);
    const reset=()=>leaveGuard.current.reset();
    window.addEventListener('beforeunload',beforeUnload);window.addEventListener('pageshow',reset);return()=>{window.removeEventListener('beforeunload',beforeUnload);window.removeEventListener('pageshow',reset);};
  },[]);

  const go=(id,request=roomRequest)=>{const next=partnerWorkspaceView(id),destination=viewPath(next,request);if(!destination)return;if(initialPartnerRoomSelection(snapshot,request.roomId,request.scope).unavailable&&!leaveGuard.current.requestLeave())return;setView(next);setMessage('');setRoomRequest(request);if(window.location.pathname+window.location.search!==destination||window.location.hash)studioHistory(window).push(destination);};
  const onRoomSelectionChange=selection=>go(view,selection.roomId===''?{scope:'company'}:{roomId:selection.roomId});
  const leaveWorkspace=event=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;if(!leaveGuard.current.requestLeave())event.preventDefault();};
  const navigateLink=event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const anchor=event.target.closest?.('a[href]');if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download'))return;
    const url=new URL(anchor.href,window.location.href),route=resolveWorkspaceSurfacePath(url.pathname);
    if(url.origin===window.location.origin&&route?.surface==='partner'&&route.operatorSlug===snapshot.operator.slug&&route.view){event.preventDefault();go(route.view,url.searchParams.has('room')||url.searchParams.has('scope')?partnerRoomRequest(url.searchParams):roomRequest);}
  };
  const switchOperator=operatorId=>{
    const next=snapshot.operators.find(item=>item.id===operatorId);
    const destination=next&&workspaceSurfacePath('partner',normalizeView(view,'partner')||'ops',next.slug);
    if(destination&&leaveGuard.current.requestLeave())window.location.assign(destination);
  };
  const page=navigation.find(item=>item.id===view),revision=operatorPackageRevision(snapshot);
  return <div className="kevin-bo" onClick={navigateLink} data-surface="partner" data-preview="operator" data-theme={theme} lang={language}>
    <div className="app">
      <aside className="side">
        <div className="side-brand"><Mark/><div><div className="side-word">scout<span style={{color:'var(--steel)'}}>/</span>gaming</div><div className="side-sub">{copy.level}</div></div></div>
        <OperatorScope snapshot={snapshot} copy={copy} onOperatorChange={switchOperator}/>
        <nav className="side-nav" aria-label={copy.level}>{groups.map(group=><details className="nav-g" open key={group}><summary className="nav-gl">{group}</summary>{navigation.filter(item=>item.group===group).map(item=><a href={viewPath(item.id)} key={item.id} onClick={event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();go(item.id);}} className={`nav-i${view===item.id?' on':''}`} aria-current={view===item.id?'page':undefined}><span>{item.label}</span>{item.owner==='planned'&&<span className="kevin-planned">Planerat</span>}</a>)}</details>)}</nav>
        <div className="side-user"><div className="avatar">{user.slice(0,2).toUpperCase()}</div><div><b>{user}</b><div className="side-role">{admin?copy.admin:copy.member}</div></div></div>
      </aside>
      <main className="main">
        <header className="kevin-operator-header"><div className="kevin-context"><a href="/partner">{copy.directory}</a><span aria-hidden="true">/</span><strong>{snapshot.operator.name}</strong>{revision?<span className="kevin-package-revision">{copy.revision} {revision}</span>:null}</div><div className="kevin-header-actions">{admin&&<><a href="/admin">{copy.control} ↗</a>{lobbyHref?<a href={lobbyHref} onClick={leaveWorkspace}>{copy.player} ↗</a>:<span aria-disabled="true">{copy.player} ↗</span>}</>}<PartnerPreferences preferences={preferences}/><PartnerSessionActions apiBase={apiBase} accessClass={snapshot.accessClass} language={language} returnTo={viewPath(view)} beforeNavigate={()=>leaveGuard.current.requestLeave()} onNavigationCancelled={()=>leaveGuard.current.reset()}/></div></header>
        <div className="mobile-nav"><select className="select" aria-label={copy.menu} value={view} onChange={event=>go(event.target.value)}>{navigation.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
        {page&&<header className="kevin-page-header"><p className="kevin-eyebrow">{snapshot.operator.name}</p><h1 className="kevin-shell-heading">{page.label}</h1>{['ops','bj'].includes(view)&&<p className="kevin-page-intro">{view==='ops'?copy.overviewIntro:copy.tablesIntro}</p>}</header>}
        {appearanceDirty&&view!=='bj'&&<div className="kevin-draft-reminder" role="status"><a href={viewPath('bj')}>{copy.draftKept} →</a></div>}
        <ViewBoundary key={`workspace:${snapshot.operator.id}:${snapshot.generatedAt}`}><PartnerOperatorView roomSelection={roomSelection} onRoomSelectionChange={onRoomSelectionChange} runtime={runtime} view={view} copy={copy} language={language} notify={notify} apiBase={apiBase} onAppearanceDirty={onAppearanceDirty} onAppearanceSaved={saved=>setSnapshot(current=>{
          if(current?.preview!==false||current.operator.id!==saved.operatorId||!saved.presentation)return current;
          const previous=Number(current.packageRevision??current.operator.packageRevision);
          if(Number.isSafeInteger(previous)&&saved.packageRevision<=previous)return current;
          return {...current,packageRevision:String(saved.packageRevision),operator:{...current.operator,packageRevision:String(saved.packageRevision)},
            branding:saved.branding,presentation:saved.presentation,presentations:partnerPackageProfiles(saved.presentation,saved.branding,current.operator.id)};
        })}/></ViewBoundary>
      </main>
      {message&&<div className="toast" role="status">{message}</div>}
    </div>
  </div>;
}

function PartnerPreferences({preferences:{copy,language,theme,setLanguage,setTheme}}) {
  return <div className="kevin-preferences"><label>{copy.language}<select className="select" value={language} onChange={event=>setLanguage(event.target.value)}><option value="sv">Svenska</option><option value="en">English</option></select></label><label>{copy.theme}<select className="select" value={theme} onChange={event=>setTheme(event.target.value)}><option value="light">{copy.light}</option><option value="dark">{copy.dark}</option></select></label></div>;
}

function OperatorScope({snapshot,copy,onOperatorChange}) {
  return <div className="side-op"><div className="side-opl"><span className="muted">{copy.company}</span><b>{snapshot.operator.name}</b></div>{snapshot.operators.length>1?<select id="kevin-operator" className="select side-scope" aria-label={copy.company} value={snapshot.operator.id} onChange={event=>onOperatorChange(event.target.value)}>{snapshot.operators.map(operator=><option key={operator.id} value={operator.id}>{operator.name}</option>)}</select>:null}</div>;
}

export function PartnerOperatorView({runtime,view,copy,language,notify,apiBase,initialRoomId,roomSelection,onRoomSelectionChange,onAppearanceSaved,onAppearanceDirty}) {
  const [roomsVisited,setRoomsVisited]=React.useState(view==='bj');
  React.useEffect(()=>{if(view==='bj')setRoomsVisited(true);},[view]);
  const Team=runtime.teamView;
  return <>
    {(roomsVisited||view==='bj')&&<div hidden={view!=='bj'} className="kevin-room-workspace"><PartnerRoomWorkspace initialRoomId={initialRoomId} selection={roomSelection} onSelectionChange={onRoomSelectionChange} active={view==='bj'} snapshot={runtime.snapshot} copy={copy} language={language} apiBase={apiBase} onSaved={onAppearanceSaved} onDirtyChange={onAppearanceDirty}/></div>}
    {view==='ops'?<PartnerLiveOverview snapshot={runtime.snapshot} copy={copy} language={language}/>:view==='team'&&typeof Team==='function'?<Team snapshot={runtime.snapshot} runtime={runtime} surface={runtime.surface} toast={notify} language={language}/>:view!=='bj'?<PartnerDisconnected snapshot={runtime.snapshot} view={view} copy={copy}/>:null}
  </>;
}

export { PartnerLiveOverview, PartnerRoomWorkspace };
