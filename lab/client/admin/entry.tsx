import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useState } from 'react';
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
import { ResourceDeletion } from './components/studio/resource-deletion';
import {WorkspaceTool,WorkspaceToolsHome} from './components/studio/workspace-tools';
import {ADMIN_WORKSPACE_TOOLS} from '../../../packages/navigation/admin-workspace-routes.mjs';

// Native readers and mutations keep their existing session, scopes and revisions.
const servicePaths = new Set(['/admin/drift','/admin/ekonomi','/admin/admin/accounts','/admin/admin/players','/admin/admin/payments','/admin/admin/api','/admin/admin/log','/admin/ai/models']);

const pages: Record<string, string> = {
  ...Object.fromEntries(Object.entries(ADMIN_WORKSPACE_TOOLS).map(([key,label])=>['/admin/'+key,label])),
  '/admin': 'Översikt',
  '/admin/structure': 'Kopplingar',
  '/admin/deletion': 'Användning & beroenden',
  '/admin/dealers': 'Dealerregister',
  '/admin/tools': 'Verktyg',
  '/admin/clips': 'Dealers & klipp',
  '/admin/rooms': 'Spelbolag & rum',
  '/admin/assets': 'Bord & bakgrunder',
  '/admin/drift': 'Drift', '/admin/ekonomi': 'Ekonomi', '/admin/admin/accounts': 'Konton & åtkomst',
  '/admin/admin/operators': 'Spelbolag', '/admin/admin/players': 'Konton & åtkomst', '/admin/admin/payments': 'Betalningar',
  '/admin/admin/api': 'Integrationer', '/admin/admin/log': 'Bolagsjournal', '/admin/ai/models': 'Agentmodeller', '/admin/ai/chat': 'Adminroboten',
};
function App() {
  const path = usePathname();
  const search=useSearchParams().toString();
  const studio=isStudioAdminRoute(path,search);
  const workspaceTool=adminToolName(path);
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
  const isolatedPreview = document.querySelector('meta[name="croupier-environment"]')?.getAttribute('content')==='isolated-qa';
  return <div className="preview-admin flex bg-sg-bg text-sg-text" onClick={event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const anchor=(event.target as Element).closest('a');if(!anchor||anchor.target)return;
    const url=new URL(anchor.href,location.origin);
    if(url.origin===location.origin&&/^\/admin(?:\/|$)/.test(url.pathname)&&!url.pathname.startsWith('/admin/lobby')){event.preventDefault();navigate(url.pathname+url.search+url.hash);}
  }}>
    <StudioSidebar /><main className="flex min-w-0 flex-1 flex-col overflow-auto">
      <header className="studio-portal-bar"><span>Scoutgaming <span className="studio-portal-divider">/</span> {studio?'Dealers & klipp':pages[path]??'System'}</span><nav aria-label="Portaler"><Link href="/admin" aria-current="page"><b>1</b> Admin</Link><a href="/partner"><b>2</b> Spelbolag</a><a href="/lobby"><b>3</b> Spelarlobby</a></nav></header>
      {isolatedPreview&&<div className="border-b border-sg-line bg-sg-panel px-5 py-2 text-xs text-sg-muted" role="note">Isolerad förhandsvisning · testdata · inga produktionsskrivningar</div>}
      <label className="preview-mobile-nav">Sida <select value={studio ? '/admin/clips' : path === '/admin/admin/players' ? '/admin/admin/accounts' : path} onChange={event => navigate(previewHref(event.target.value))}>
        {Object.entries(pages).filter(([key]) => key !== '/admin/admin/players').map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <Clips active={studio} dealersActive={path==='/admin/dealers'} onImportBusyChange={setImportBusy} chatActive={path==='/admin/ai/chat'} registrationBlocked={studioDirty} onRegistered={materialChanged}>{studioVisited&&<ConnectedClipMap active={studio&&new URLSearchParams(search).get('tool')!=='import'} onDirtyChange={setStudioDirty} onRevisionChange={setStudioRevision} refreshKey={studioRefresh}/>}</Clips>
      {dealersVisited&&<div hidden={path!=='/admin/dealers'||new URLSearchParams(search).get('tool')==='import'}><DealerDirectory active={path==='/admin/dealers'&&new URLSearchParams(search).get('tool')!=='import'} blocked={studioDirty||importBusy} refreshKey={studioRefresh} onChanged={materialChanged}/></div>}
      {libraryVisited&&<div hidden={path!=='/admin/assets'}><RegisteredMaterialLibrary visible={path==='/admin/assets'} disabled={studioDirty} onChanged={materialChanged} refreshKey={studioRevision}/></div>}
      {visited.map(service=><div key={service} hidden={path!==service}><ConnectedServices path={service}/></div>)}
      {path==='/admin'&&!studio&&<AdminHome />}
      {path==='/admin/tools'&&<WorkspaceToolsHome/>}
      {path==='/admin/deletion'&&<ResourceDeletion/>}
      {workspaceTool&&<WorkspaceTool section={workspaceTool}/>}
      {!workspaceTool&&!studio && path!=='/admin/deletion' && path!=='/admin/tools' && path!=='/admin' && path!=='/admin/dealers' && path!=='/admin/ai/chat' && path!=='/admin/assets' && !servicePaths.has(path) && (path==='/admin/structure' ? <ResourceConnections /> : <RegisteredStudio path={path} title={pages[path] ?? 'Struktur'} disabled={studioDirty||importBusy} onChanged={materialChanged}/>)}
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App />);
