import {legacyControlBookmarkHref} from '../../lib/control-workspace.mjs';
import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { StudioSidebar } from './components/studio/studio-sidebar';
import Link, { navigate, previewHref, usePathname, useSearchParams } from '../runtime/navigation';
import {isStudioAdminRoute,adminToolName} from '../runtime/admin-routing.mjs';
import { RegisteredStudio } from './components/studio/registered-studio';
import { ConnectedClipMap } from './components/studio/connected-clip-map';
import { ConnectedServices } from './components/studio/connected-services';
import { RegisteredMaterialLibrary } from './components/studio/registered-material-library';
import Clips from './app/control/(studio)/clips/page';
import { AdminHome } from './components/studio/admin-home';
import { DealerDirectory } from './components/studio/dealer-directory';
import { ResourceConnections } from './components/studio/resource-connections';
import {WorkspaceTool} from './components/studio/workspace-tools';
import {adminDocumentHref} from '../../../../packages/navigation/admin-workspace-routes.mjs';
import {PlayerAccountsPage,AdminStaffPage} from './components/studio/accounts-pages';
import {adminNavigationGroups,adminSystemGroups,adminPageLabels} from './lib/admin-navigation';

// Native readers and mutations keep their existing session, scopes and revisions.
const servicePaths = new Set(['/admin/drift','/admin/ekonomi','/admin/admin/api']);
// Pages that stay mounted once visited so their drafts survive menu changes.
const mountedPages:Record<string,()=>ReactElement>={'/admin/ai/models':()=><ConnectedServices path="/admin/ai/models"/>,'/admin/players':()=><PlayerAccountsPage/>,'/admin/admin/accounts':()=><AdminStaffPage/>};

const pages=adminPageLabels;
const menuPaths=new Set(['/admin',...adminNavigationGroups.flatMap(group=>group.links.map(link=>link.href)),...adminSystemGroups.flatMap(group=>group.links.map(link=>link.href))]);

function App() {
  const path = usePathname();
  const search=useSearchParams().toString();
  const studio=isStudioAdminRoute(path,search);
  const workspaceTool=adminToolName(path);
  // Retired pages: old bookmarks keep their query and fragment on the page that replaced them.
  const requested=path+(search?'?'+search:'');
  const canonical=adminDocumentHref(requested);
  const retired=canonical!==requested?canonical:null;
  const redirected=Boolean(retired);
  useEffect(()=>{
    if(!retired)return;
    navigate(retired+location.hash,true);
  },[retired,search]);
  const [studioDirty,setStudioDirty]=useState(false),[studioRefresh,setStudioRefresh]=useState(0);
  const [studioRevision,setStudioRevision]=useState('');
  const [importBusy,setImportBusy]=useState(false);
  const [dealersVisited,setDealersVisited]=useState(path==='/admin/dealers');
  useEffect(()=>{if(path==='/admin/dealers')setDealersVisited(true);},[path]);
  const materialChanged=useCallback(()=>setStudioRefresh(value=>value+1),[]);
  const [studioVisited,setStudioVisited]=useState(studio);
  useEffect(()=>{if(studio)setStudioVisited(true);},[studio]);
  const [libraryVisited,setLibraryVisited]=useState(path==='/admin/assets');
  useEffect(()=>{if(path==='/admin/assets')setLibraryVisited(true);},[path]);
  const [visited,setVisited]=useState<string[]>(()=>servicePaths.has(path)?[path]:[]);
  useEffect(()=>{if(servicePaths.has(path))setVisited(current=>current.includes(path)?current:[...current,path]);},[path]);
  const [visitedPages,setVisitedPages]=useState<string[]>(()=>path in mountedPages?[path]:[]);
  useEffect(()=>{if(path in mountedPages)setVisitedPages(current=>current.includes(path)?current:[...current,path]);},[path]);
  const isolatedPreview = document.querySelector('meta[name="croupier-environment"]')?.getAttribute('content')==='isolated-qa';
  return <div className="preview-admin flex bg-sg-bg text-sg-text" onClick={event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const anchor=(event.target as Element).closest('a');if(!anchor||anchor.target)return;
    const url=new URL(anchor.href,location.origin);
    if(url.origin===location.origin&&/^\/admin(?:\/|$)/.test(url.pathname)&&!url.pathname.startsWith('/admin/lobby')){event.preventDefault();navigate(url.pathname+url.search+url.hash);}
  }}>
    <StudioSidebar /><main className="flex min-w-0 flex-1 flex-col overflow-auto">
      <header className="studio-portal-bar"><span>Scoutgaming <span className="studio-portal-divider">/</span> {studio?'Klippkarta':pages[path]??'System'}</span><nav aria-label="Portaler"><Link href="/admin" aria-current="page"><b>1</b> Admin</Link><a href="/partner"><b>2</b> Spelbolag</a><a href="/lobby"><b>3</b> Spelarlobby</a></nav></header>
      {isolatedPreview&&<div className="border-b border-sg-line bg-sg-panel px-5 py-2 text-xs text-sg-muted" role="note">Isolerad förhandsvisning · testdata · inga produktionsskrivningar</div>}
      <label className="preview-mobile-nav">Sida <select value={studio ? '/admin/clips' : retired ? retired.split('?')[0] : path} onChange={event => navigate(previewHref(event.target.value))}>
        <option value="/admin">Översikt</option>
        {adminNavigationGroups.map(group=><optgroup key={group.id} label={group.label}>{group.links.map(link=><option key={link.href} value={link.href}>{link.label}</option>)}</optgroup>)}
        <optgroup label="System">{adminSystemGroups.flatMap(group=>group.links).map(link=><option key={link.href} value={link.href}>{link.label}</option>)}</optgroup>
        {!studio&&!menuPaths.has(path)&&!retired&&pages[path]&&<option value={path}>{pages[path]}</option>}
      </select></label>
      <Clips active={studio} dealersActive={path==='/admin/dealers'} onImportBusyChange={setImportBusy} registrationBlocked={studioDirty} onRegistered={materialChanged}>{studioVisited&&<ConnectedClipMap active={studio&&new URLSearchParams(search).get('tool')!=='import'} onDirtyChange={setStudioDirty} onRevisionChange={setStudioRevision} refreshKey={studioRefresh}/>}</Clips>
      {dealersVisited&&<div hidden={path!=='/admin/dealers'||new URLSearchParams(search).get('tool')==='import'}><DealerDirectory active={path==='/admin/dealers'&&new URLSearchParams(search).get('tool')!=='import'} blocked={studioDirty||importBusy} refreshKey={studioRefresh} onChanged={materialChanged}/></div>}
      {libraryVisited&&<div hidden={path!=='/admin/assets'}><RegisteredMaterialLibrary visible={path==='/admin/assets'} disabled={studioDirty} onChanged={materialChanged} refreshKey={studioRevision}/></div>}
      {visited.map(service=><div key={service} hidden={path!==service}><ConnectedServices path={service}/></div>)}
      {visitedPages.map(page=><div key={page} hidden={path!==page}>{mountedPages[page]()}</div>)}
      {path==='/admin'&&!studio&&<AdminHome />}
      {path==='/admin/structure'&&<ResourceConnections/>}
      {workspaceTool&&!redirected&&<WorkspaceTool section={workspaceTool}/>}
      {!workspaceTool&&!studio&&!redirected && path!=='/admin/structure' && path!=='/admin' && path!=='/admin/dealers' && path!=='/admin/assets' && !servicePaths.has(path) && !(path in mountedPages) && <RegisteredStudio path={path} title={pages[path] ?? 'Struktur'} disabled={studioDirty||importBusy} onChanged={materialChanged}/>}
    </main>
  </div>;
}
const bookmark = legacyControlBookmarkHref(location.pathname + location.search + location.hash);
if (bookmark) location.replace(bookmark);
else createRoot(document.getElementById('root')!).render(<App />);
