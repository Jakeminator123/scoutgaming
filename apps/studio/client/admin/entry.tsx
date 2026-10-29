import {legacyControlBookmarkHref} from '../../lib/control-workspace.mjs';
import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useState } from 'react';
import type { StudioProject } from '../../../../packages/presentation/contracts/studio-model.mjs';
import { StudioSidebar } from './components/studio/studio-sidebar';
import { AdminLogout } from './components/studio/admin-logout';
import Link, { navigate, previewHref, usePathname, useSearchParams } from '../runtime/navigation';
import {parseAdminPath} from '../runtime/admin-routing.mjs';
import { ConnectedClipMap, type ClipMapWorkspace } from './components/studio/connected-clip-map';
import Clips from './app/control/(studio)/clips/page';
import { AdminHome } from './components/studio/admin-home';
import { DemoBuilder } from './components/studio/demo-builder';
import { DealerDirectory } from './components/studio/dealer-directory';
import { DealerHub } from './components/studio/dealer-hub';
import { ScenesPage } from './components/studio/scenes-page';
import { CompaniesPage } from './components/studio/companies-page';
import { SystemPage } from './components/studio/system-page';
import { AdminHelp } from './components/studio/admin-help';
import {adminDocumentHref} from '../../../../packages/navigation/admin-workspace-routes.mjs';
import {adminMenuLinks,adminPageLabels,adminTabId} from './lib/admin-navigation';
import {Search} from 'lucide-react';
import {CommandPalette,openCommandPalette} from './components/ui/command';
import {Toaster} from './components/ui/toast';
import {Kbd,buttonVariants,cn,focusRing} from './components/ui/kit';

// Pages that stay mounted once visited so their drafts and native forms survive menu changes.
const keepMounted=new Set(['dealers','scenes','companies','company','room','system']);
const mapTabs=new Set(['klipp','tal','installningar']);

function App() {
  const path = usePathname();
  const search=useSearchParams().toString(), query=new URLSearchParams(search);
  const route=parseAdminPath(path);
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
  const [workspace,setWorkspace]=useState<{current:ClipMapWorkspace|null;saved:StudioProject|null}>({current:null,saved:null});
  const workspaceChanged=useCallback((current:ClipMapWorkspace|null,saved:StudioProject|null)=>setWorkspace({current,saved}),[]);
  const materialChanged=useCallback(()=>setStudioRefresh(value=>value+1),[]);
  // The clip map is one instance: under the dealer nav and under Miljöer › Miljöer.
  const dealerTab=route.page==='dealer'?adminTabId('dealer',query.get('flik')):'';
  const sceneTab=route.page==='scenes'?adminTabId('scenes',query.get('tab')):'';
  const mapRoute=route.page==='dealer'?{kind:'dealer' as const,dealerId:route.id,base:'/admin/dealers/'+encodeURIComponent(route.id)}:route.page==='scenes'?{kind:'scenes' as const,base:'/admin/scenes'}:null;
  const mapShown=!redirected&&(route.page==='dealer'&&mapTabs.has(dealerTab)||sceneTab==='mallar');
  const mapActive=mapShown&&query.get('tool')!=='import';
  const [mapVisited,setMapVisited]=useState(Boolean(mapRoute)&&!redirected);
  useEffect(()=>{if(mapRoute&&!redirected)setMapVisited(true);},[mapRoute?.kind,redirected]);
  const [lastMapRoute,setLastMapRoute]=useState(mapRoute);
  useEffect(()=>{if(mapRoute)setLastMapRoute(mapRoute);},[mapRoute?.kind,mapRoute?.kind==='dealer'?mapRoute.dealerId:'']);
  const [visited,setVisited]=useState<string[]>(()=>keepMounted.has(route.page)&&!redirected?[route.page]:[]);
  useEffect(()=>{if(keepMounted.has(route.page)&&!redirected)setVisited(current=>current.includes(route.page)?current:[...current,route.page]);},[route.page,redirected]);
  const isolatedPreview = document.querySelector('meta[name="croupier-environment"]')?.getAttribute('content')==='isolated-qa';
  const show=(page:string)=>!redirected&&route.page===page;
  const pageTitle=route.page==='dealer'?'Dealers':route.page==='company'||route.page==='room'?'Bolag och spelbord':route.page==='demo'?'Skapa demo':adminPageLabels[path]??'Admin';
  return <div className="preview-admin flex bg-sg-bg text-sg-text" onClick={event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const anchor=(event.target as Element).closest('a');if(!anchor||anchor.target)return;
    const url=new URL(anchor.href,location.origin);
    if(url.origin===location.origin&&/^\/admin(?:\/|$)/.test(url.pathname)&&!url.pathname.startsWith('/admin/lobby')){event.preventDefault();navigate(url.pathname+url.search+url.hash);}
  }}>
    <StudioSidebar /><main className="flex min-w-0 flex-1 flex-col overflow-auto">
      <header className="studio-portal-bar"><span>Scoutgaming Admin <span className="studio-portal-divider">/</span> {pageTitle}</span>
        <button type="button" onClick={openCommandPalette} aria-keyshortcuts="Control+K Meta+K" className={cn('ml-auto mr-3 hidden h-8 min-w-[260px] items-center gap-2 rounded-lg border border-sg-border bg-sg-surface-2 px-2.5 text-[13px] text-sg-faint transition-colors hover:border-sg-faint hover:text-sg-muted md:inline-flex',focusRing)}><Search className="size-4" aria-hidden="true"/><span className="flex-1 text-left">Sök dealers, bolag, spelbord…</span><Kbd>Ctrl K</Kbd></button>
        <nav aria-label="Portaler"><Link href="/admin" aria-current="page"><b>1</b> Admin</Link><a href="/partner"><b>2</b> Partnerportalen</a><a href="/lobby"><b>3</b> Lobbyn</a></nav><div className="studio-mobile-logout"><AdminLogout/></div></header>
      {isolatedPreview&&<div className="border-b border-sg-line bg-sg-panel px-5 py-2 text-xs text-sg-muted" role="note">Isolerad förhandsvisning · testdata · inga produktionsskrivningar</div>}
      <label className="preview-mobile-nav">Sida <select value={retired?retired.split('?')[0]:route.page==='dealer'?'/admin/dealers':route.page==='company'||route.page==='room'?'/admin/companies':path} onChange={event => navigate(previewHref(event.target.value))}>
        <option value="/admin">Översikt</option>
        {adminMenuLinks.map(link=><option key={link.href} value={link.href}>{link.label}</option>)}
      </select></label>
      {show('home')&&<AdminHome workspace={workspace.current}/>}
      {visited.includes('dealers')&&<div hidden={!show('dealers')}><DealerDirectory active={show('dealers')} blocked={studioDirty||importBusy} refreshKey={studioRefresh} onChanged={materialChanged}/></div>}
      {show('dealer')&&<DealerHub part="head" dealerId={route.id} tab={dealerTab} workspace={workspace.current} saved={workspace.saved} onMaterialChanged={materialChanged}/>}
      {show('scenes')&&<ScenesPage part="head" tab={sceneTab} workspace={workspace.current}/>}
      <div className="flex min-h-0 flex-col border-t border-sg-border [&[hidden]]:hidden" hidden={!mapShown}>
        {mapVisited&&lastMapRoute&&<Clips active={mapShown} dealerId={lastMapRoute.kind==='dealer'?lastMapRoute.dealerId:''} base={lastMapRoute.base} onImportBusyChange={setImportBusy} registrationBlocked={studioDirty} onRegistered={materialChanged}>
          <ConnectedClipMap route={lastMapRoute} active={mapActive} onDirtyChange={setStudioDirty} onRevisionChange={setStudioRevision} onWorkspaceChange={workspaceChanged} refreshKey={studioRefresh}/>
        </Clips>}
      </div>
      {show('dealer')&&<DealerHub part="tail" dealerId={route.id} tab={dealerTab} workspace={workspace.current} saved={workspace.saved}/>}
      {visited.includes('scenes')&&<div hidden={!show('scenes')||sceneTab==='mallar'}><ScenesPage part="tail" tab={sceneTab} visible={show('scenes')} disabled={studioDirty} onChanged={materialChanged} refreshKey={studioRevision}/></div>}
      {(visited.includes('companies')||visited.includes('company')||visited.includes('room'))&&<div hidden={!(show('companies')||show('company')||show('room'))}><CompaniesPage page={route.page==='company'?'company':route.page==='room'?'room':'companies'} id={route.id} active={show('companies')||show('company')||show('room')} disabled={studioDirty||importBusy} onChanged={materialChanged}/></div>}
      {visited.includes('system')&&<div hidden={!show('system')}><SystemPage active={show('system')} tab={adminTabId('system',query.get('flik'))}/></div>}
      {show('guide')&&<AdminHelp/>}
      {show('demo')&&<DemoBuilder/>}
      {show('unknown')&&<section className="px-8 pb-16 pt-7" aria-labelledby="admin-missing-title"><h1 id="admin-missing-title" className="m-0 text-[26px] font-bold tracking-[-0.02em]">Sidan finns inte</h1><p className="mt-1.5 text-sg-muted">Adressen hör inte till någon av Admins sidor.</p><p className="mt-4"><Link className={buttonVariants()} href="/admin">Till översikten</Link></p></section>}
    </main>
    <CommandPalette/><Toaster/>
  </div>;
}
const bookmark = legacyControlBookmarkHref(location.pathname + location.search + location.hash);
if (bookmark) location.replace(bookmark);
else createRoot(document.getElementById('root')!).render(<App />);
