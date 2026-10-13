import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useState } from 'react';
import { StudioSidebar } from './components/studio/studio-sidebar';
import Link, { navigate, previewHref, usePathname, useSearchParams } from '../runtime/navigation';
import {isStudioAdminRoute} from '../runtime/admin-routing.mjs';
import { RegisteredStudio } from './components/studio/registered-studio';
import { ConnectedClipMap } from './components/studio/connected-clip-map';
import { ConnectedServices } from './components/studio/connected-services';
import { SystemOverview } from './components/studio/system-overview';
import { RegisteredMaterialLibrary } from './components/studio/registered-material-library';
import Clips from './app/control/(studio)/clips/page';
import { AdminHome } from './components/studio/admin-home';

// Native readers and mutations keep their existing session, scopes and revisions.
const servicePaths = new Set(['/admin/drift','/admin/ekonomi','/admin/admin/accounts','/admin/admin/players','/admin/admin/payments','/admin/admin/api','/admin/admin/log','/admin/ai/models']);

const pages: Record<string, string> = {
  '/admin': 'Översikt',
  '/admin/structure': 'Struktur',
  '/admin/clips': 'Klippkarta',
  '/admin/rooms': 'Spelrum',
  '/admin/assets': 'Bord & bakgrunder',
  '/admin/drift': 'Drift', '/admin/ekonomi': 'Ekonomi', '/admin/admin/accounts': 'Konton & åtkomst',
  '/admin/admin/operators': 'Spelbolag', '/admin/admin/players': 'Spelare', '/admin/admin/payments': 'Betalningar',
  '/admin/admin/api': 'API', '/admin/admin/log': 'Ändringslogg', '/admin/ai/models': 'Agentmodeller', '/admin/ai/chat': 'Studioassistent',
};
function App() {
  const path = usePathname();
  const search=useSearchParams().toString();
  const studio=isStudioAdminRoute(path,search);
  const [studioDirty,setStudioDirty]=useState(false),[studioRefresh,setStudioRefresh]=useState(0);
  const [studioRevision,setStudioRevision]=useState('');
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
      <header className="studio-portal-bar"><span>Scoutgaming <span className="studio-portal-divider">/</span> {studio?'Studio':pages[path]??'System'}</span><nav aria-label="Portaler"><Link href="/admin/clips" aria-current="page"><b>1</b> Studio</Link><a href="/partner"><b>2</b> Spelbolag</a><a href="/play"><b>3</b> Spelarvy</a></nav></header>
      {isolatedPreview&&<div className="border-b border-sg-line bg-sg-panel px-5 py-2 text-xs text-sg-muted" role="note">Isolerad förhandsvisning · testdata · inga produktionsskrivningar</div>}
      <label className="preview-mobile-nav">Sida <select value={studio ? '/admin/clips' : path} onChange={event => navigate(previewHref(event.target.value))}>
        {Object.entries(pages).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <Clips active={studio} chatActive={path==='/admin/ai/chat'}>{studioVisited&&<ConnectedClipMap onDirtyChange={setStudioDirty} onRevisionChange={setStudioRevision} refreshKey={studioRefresh}/>}</Clips>
      {libraryVisited&&<div hidden={path!=='/admin/assets'}><RegisteredMaterialLibrary disabled={studioDirty} onChanged={materialChanged} refreshKey={studioRevision}/></div>}
      {visited.map(service=><div key={service} hidden={path!==service}><ConnectedServices path={service}/></div>)}
      {path==='/admin'&&!studio&&<AdminHome />}
      {!studio && path!=='/admin' && path!=='/admin/ai/chat' && path!=='/admin/assets' && !servicePaths.has(path) && (path==='/admin/structure' ? <SystemOverview /> : <RegisteredStudio path={path} title={pages[path] ?? 'Struktur'} disabled={studioDirty} onChanged={materialChanged}/>)}
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App />);
