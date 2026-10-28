'use client';

import React from 'react';
import { studioHistory } from '../../lib/studio-history.mjs';
import { initialPartnerRoomSelection, partnerRoomRequest, partnerRoomQuery } from '../../lib/partner-room-selection.mjs';
import { PartnerOverview } from './views/overview.jsx';
import { PartnerRoomWorkspace } from './views/rooms.jsx';
import { PartnerPlayers } from './views/players.jsx';
import { PartnerReports } from './views/reports.jsx';
import { PartnerIntegration } from './views/integration.jsx';
import { PartnerHelp } from './views/help.jsx';
import { TeamView } from './views/team.jsx';
import { Btn, Card, Chip } from './views/ui.jsx';
import { createPartnerWorkspaceContext, operatorPackageRevision, validatePartnerSnapshot } from './partner-workspace-context.mjs';
import { partnerView, resolveWorkspaceSurfacePath, workspaceSurfacePath } from '../../../../packages/navigation/workspace-surfaces.mjs';
import { partnerPackageProfiles } from '../../lib/partner-package-view.mjs';
import { partnerTeamView } from '../partner-team-loader.mjs';
import { partnerNavigation, usePartnerPreferences } from './partner-copy.mjs';
import { PartnerSessionActions } from '../partner-session-actions';
import { createPartnerLeaveGuard } from './partner-navigation-guard.mjs';
import './partner-portal.css';

class ViewBoundary extends React.Component {
  state = { failed:false };
  static getDerivedStateFromError() { return {failed:true}; }
  render() {
    return this.state.failed ? <div className="page"><Card role="alert"><h2>Vyn kunde inte visas</h2><p className="muted">Ladda om sidan. Ingen ändring har gjorts i spelet.</p></Card></div> : this.props.children;
  }
}

// Only the authorized live partner projection enters this client workspace.
// Remount before a changed operator or account can paint the old context.
export function PartnerOperatorWorkspace(props) {
  if(props.surface!=='partner'||props.initialSnapshot?.preview!==false)throw Error('En verklig partnerarbetsyta krävs.');
  return <PartnerSession key={`${props.surface}:${props.initialSnapshot?.operator?.id}:${props.user}`} {...props}/>;
}

function PartnerSession({initialSnapshot,apiBase,user,initialRoomId,initialRoomScope,initialView='overview',denied=null}) {
  const preferences=usePartnerPreferences(),{copy,language,theme}=preferences;
  const [snapshot,setSnapshot]=React.useState(()=>validatePartnerSnapshot(initialSnapshot));
  // The server rendered this view (or its 403 card); the client never reloads it on mount.
  const served=partnerView(initialView)??'overview';
  const [view,setView]=React.useState(served);
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
  const allowed=id=>navigation.some(item=>item.id===id);
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
      const candidate=raw?partnerView(raw):route?.view;
      if(!candidate){if(raw)setMessage(copy.notConnected);return;}
      // A view the role may not open is the server's decision: let it render the 403 card.
      if(!allowed(candidate)){if(candidate!==served)window.location.reload();return;}
      const request=partnerRoomRequest(new URLSearchParams(window.location.search));
      setView(candidate);setMessage('');setRoomRequest(request);
      const destination=workspaceSurfacePath('partner',candidate,snapshot.operator.slug)+partnerRoomQuery(request);
      if(window.location.pathname+window.location.search!==destination||raw)history.replaceContext(destination);
    };
    const unsubscribe=history.subscribe(navigate);navigate();
    return()=>{unsubscribe();releaseGuard();};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[snapshot.operator.slug,snapshot.tables,snapshot.permissions]);
  React.useEffect(()=>{
    const beforeUnload=event=>leaveGuard.current.beforeUnload(event);
    const reset=()=>leaveGuard.current.reset();
    window.addEventListener('beforeunload',beforeUnload);window.addEventListener('pageshow',reset);return()=>{window.removeEventListener('beforeunload',beforeUnload);window.removeEventListener('pageshow',reset);};
  },[]);

  const go=(id,request=roomRequest)=>{
    const next=partnerView(id);if(!next)return;
    const destination=viewPath(next,request);if(!destination)return;
    if(!allowed(next)){if(leaveGuard.current.requestLeave())window.location.assign(destination);return;}
    if(initialPartnerRoomSelection(snapshot,request.roomId,request.scope).unavailable&&!leaveGuard.current.requestLeave())return;
    setView(next);setMessage('');setRoomRequest(request);
    if(window.location.pathname+window.location.search!==destination||window.location.hash)studioHistory(window).push(destination);
  };
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
    const destination=next&&workspaceSurfacePath('partner',view,next.slug);
    if(destination&&leaveGuard.current.requestLeave())window.location.assign(destination);
  };
  const revision=operatorPackageRevision(snapshot),assignment=snapshot.assignment;
  const role=snapshot.role?.label??(admin?copy.admin:copy.member);
  const summary=assignment?[[assignment.dealers.length,copy.dealers],[assignment.lanes.length,copy.lanes],[assignment.tables.length,copy.tables],[assignment.backgrounds.length,copy.backgrounds]].map(([count,word])=>`${count} ${word}`).join(' · '):null;
  const deniedHere=denied&&denied.view===view?denied:null;
  return <div className="partner-portal" onClick={navigateLink} data-surface="partner" data-theme={theme} lang={language}>
    <div className="shell">
      <aside className="side">
        <div className="brand"><span className="mark" aria-hidden="true">S</span><div><div className="name">{snapshot.operator.name}</div><div className="sub">{copy.portal}</div></div></div>
        <div className="context">
          <span className="small">{copy.assignmentFrom}</span>
          <b>{revision?`${copy.revision} ${revision}`:copy.packageMissing}</b>
          {summary?<span className="small">{summary}</span>:null}
          {snapshot.operators.length>1?<select id="partner-operator" aria-label={copy.switchCompany} value={snapshot.operator.id} onChange={event=>switchOperator(event.target.value)}>{snapshot.operators.map(operator=><option key={operator.id} value={operator.id}>{operator.name}</option>)}</select>:null}
        </div>
        <nav aria-label={copy.menu}>{navigation.map(item=><a href={viewPath(item.id)} key={item.id} className="nav" aria-current={view===item.id?'page':undefined} onClick={event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();go(item.id);}}>{item.label}</a>)}</nav>
        <div className="foot">
          <div className="who"><span className="avatar" aria-hidden="true">{user.slice(0,2).toUpperCase()}</span><div><div><b>{user}</b></div><div className="small">{role}</div></div></div>
          <PartnerSessionActions apiBase={apiBase} accessClass={snapshot.accessClass} language={language} returnTo={viewPath(view)} beforeNavigate={()=>leaveGuard.current.requestLeave()} onNavigationCancelled={()=>leaveGuard.current.reset()}/>
          <div className="prefs">
            <label>{copy.language}<select value={language} onChange={event=>preferences.setLanguage(event.target.value)}><option value="sv">Svenska</option><option value="en">English</option></select></label>
            <label>{copy.theme}<select value={theme} onChange={event=>preferences.setTheme(event.target.value)}><option value="light">{copy.light}</option><option value="dark">{copy.dark}</option></select></label>
            {admin&&<><a href="/admin">{copy.control} ↗</a>{lobbyHref?<a href={lobbyHref} onClick={leaveWorkspace}>{copy.player} ↗</a>:<span aria-disabled="true">{copy.player} ↗</span>}</>}
          </div>
        </div>
      </aside>
      <main className="main">
        {appearanceDirty&&view!=='rooms'&&<div className="page" style={{marginBottom:16}}><div className="note warn" role="status"><a href={viewPath('rooms')} style={{textDecoration:'underline'}}>{copy.draftKept} →</a></div></div>}
        {deniedHere?<DeniedView denied={deniedHere} copy={copy} href={viewPath('overview')}/>
          :<ViewBoundary key={`workspace:${snapshot.operator.id}:${snapshot.generatedAt}`}><PartnerOperatorView roomSelection={roomSelection} onRoomSelectionChange={onRoomSelectionChange} runtime={runtime} view={view} copy={copy} language={language} notify={notify} apiBase={apiBase} user={user} onAppearanceDirty={onAppearanceDirty} onAppearanceSaved={saved=>setSnapshot(current=>{
            if(current?.preview!==false||current.operator.id!==saved.operatorId||!saved.presentation)return current;
            const previous=Number(current.packageRevision??current.operator.packageRevision);
            if(Number.isSafeInteger(previous)&&saved.packageRevision<=previous)return current;
            return {...current,packageRevision:String(saved.packageRevision),operator:{...current.operator,packageRevision:String(saved.packageRevision)},draft:null,
              branding:saved.branding,presentation:saved.presentation,presentations:partnerPackageProfiles(saved.presentation,saved.branding,current.operator.id)};
          })}/></ViewBoundary>}
      </main>
    </div>
    {message&&<div className="toast" role="status">{message}</div>}
  </div>;
}

// The server refused this view for the role (partner-data.mjs `denied`); the shell stays,
// the view's data was never read, and the card names the role and the permission.
function DeniedView({denied,copy,href}) {
  return <div className="page"><Card className="denied" role="alert">
    <Chip tone="danger">403</Chip>
    <h2>{copy.deniedTitle}</h2>
    <p className="muted">{copy.deniedBody.replace('{role}',denied.role?.label??'—').replace('{permission}',denied.permission)}</p>
    <Btn href={href}>{copy.toOverview}</Btn>
  </Card></div>;
}

export function PartnerOperatorView({runtime,view,copy,language,notify,apiBase,user,initialRoomId,roomSelection,onRoomSelectionChange,onAppearanceSaved,onAppearanceDirty}) {
  const [roomsVisited,setRoomsVisited]=React.useState(view==='rooms');
  React.useEffect(()=>{if(view==='rooms')setRoomsVisited(true);},[view]);
  const Team=runtime.teamView,snapshot=runtime.snapshot;
  return <>
    {(roomsVisited||view==='rooms')&&<div hidden={view!=='rooms'}><PartnerRoomWorkspace initialRoomId={initialRoomId} selection={roomSelection} onSelectionChange={onRoomSelectionChange} active={view==='rooms'} snapshot={snapshot} copy={copy} language={language} apiBase={apiBase} onSaved={onAppearanceSaved} onDirtyChange={onAppearanceDirty}/></div>}
    {view==='overview'?<PartnerOverview snapshot={snapshot} copy={copy} language={language}/>
      :view==='team'&&typeof Team==='function'?<Team snapshot={snapshot} runtime={runtime} surface={runtime.surface} toast={notify} language={language} copy={copy}/>
      :view==='players'?<PartnerPlayers snapshot={snapshot} copy={copy} language={language}/>
      :view==='reports'?<PartnerReports snapshot={snapshot} copy={copy} language={language}/>
      :view==='integration'?<PartnerIntegration snapshot={snapshot} copy={copy} language={language}/>
      :view==='help'?<PartnerHelp snapshot={snapshot} copy={copy} language={language} user={user}/>:null}
  </>;
}

export { PartnerOverview, PartnerRoomWorkspace };
