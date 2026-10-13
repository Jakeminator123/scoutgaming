import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useState } from 'react';
import { StudioSidebar } from './components/studio/studio-sidebar';
import Link, { navigate, previewHref, usePathname } from '../runtime/navigation';
import { RegisteredStudio } from './components/studio/registered-studio';
import { ConnectedClipMap } from './components/studio/connected-clip-map';
import { ConnectedServices } from './components/studio/connected-services';
import { SystemOverview } from './components/studio/system-overview';
import { RegisteredMaterialLibrary } from './components/studio/registered-material-library';
import Clips from './app/control/(studio)/clips/page';

// Native readers and mutations keep their existing session, scopes and revisions.
const servicePaths = new Set(['/control/drift','/control/ekonomi','/control/admin/accounts','/control/admin/players','/control/admin/payments','/control/admin/api','/control/admin/log','/control/ai/models']);

const pages: Record<string, string> = {
  '/control/structure': 'Struktur',
  '/control/clips': 'Klippkarta',
  '/control/assets': 'Bord & bakgrunder',
  '/control/drift': 'Drift', '/control/ekonomi': 'Ekonomi', '/control/admin/accounts': 'Konton & åtkomst',
  '/control/admin/operators': 'Spelbolag', '/control/admin/players': 'Spelare', '/control/admin/payments': 'Betalningar',
  '/control/admin/api': 'API', '/control/admin/log': 'Ändringslogg', '/control/ai/models': 'Agentmodeller', '/control/ai/chat': 'Studioassistent',
};
function App() {
  const path = usePathname();
  const [studioDirty,setStudioDirty]=useState(false),[studioRefresh,setStudioRefresh]=useState(0);
  const [studioRevision,setStudioRevision]=useState('');
  const materialChanged=useCallback(()=>setStudioRefresh(value=>value+1),[]);
  const [libraryVisited,setLibraryVisited]=useState(path==='/control/assets');
  useEffect(()=>{if(path==='/control/assets')setLibraryVisited(true);},[path]);
  const [visited,setVisited]=useState<string[]>(()=>servicePaths.has(path)?[path]:[]);
  useEffect(()=>{if(servicePaths.has(path))setVisited(current=>current.includes(path)?current:[...current,path]);},[path]);
  const isolatedPreview = document.querySelector('meta[name="croupier-environment"]')?.getAttribute('content')==='isolated-qa';
  const studio = ['/control','/control/clips','/control/rooms','/control/dealers'].includes(path);
  return <div className="preview-admin flex bg-sg-bg text-sg-text" onClick={event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const anchor=(event.target as Element).closest('a');if(!anchor||anchor.target)return;
    const url=new URL(anchor.href,location.origin);
    if(url.origin===location.origin&&/^\/admin(?:\/|$)/.test(url.pathname)&&!url.pathname.startsWith('/admin/lobby')){event.preventDefault();navigate(url.pathname+url.search+url.hash);}
  }}>
    <StudioSidebar /><main className="flex min-w-0 flex-1 flex-col overflow-auto">
      <header className="studio-portal-bar"><span>Scoutgaming <span className="studio-portal-divider">/</span> {studio?'Studio':pages[path]??'System'}</span><nav aria-label="Portaler"><Link href="/control/clips" aria-current="page"><b>1</b> Studio</Link><a href="/partner"><b>2</b> Spelbolag</a><a href="/play"><b>3</b> Spelarvy</a></nav></header>
      {isolatedPreview&&<div className="border-b border-sg-line bg-sg-panel px-5 py-2 text-xs text-sg-muted" role="note">Isolerad förhandsvisning · testdata · inga produktionsskrivningar</div>}
      <label className="preview-mobile-nav">Sida <select value={studio ? '/control/clips' : path} onChange={event => navigate(previewHref(event.target.value))}>
        {Object.entries(pages).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <Clips active={studio} chatActive={path==='/control/ai/chat'}><ConnectedClipMap onDirtyChange={setStudioDirty} onRevisionChange={setStudioRevision} refreshKey={studioRefresh}/></Clips>
      {libraryVisited&&<div hidden={path!=='/control/assets'}><RegisteredMaterialLibrary disabled={studioDirty} onChanged={materialChanged} refreshKey={studioRevision}/></div>}
      {visited.map(service=><div key={service} hidden={path!==service}><ConnectedServices path={service}/></div>)}
      {!studio && path!=='/control/ai/chat' && path!=='/control/assets' && !servicePaths.has(path) && (path==='/control/structure' ? <SystemOverview /> : <RegisteredStudio path={path} title={pages[path] ?? 'Struktur'} disabled={studioDirty} onChanged={materialChanged}/>)}
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App />);
