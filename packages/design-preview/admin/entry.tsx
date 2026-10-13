import { createRoot } from 'react-dom/client';
import type { ComponentType } from 'react';
import { StudioSidebar } from './components/studio/studio-sidebar';
import Link, { navigate, previewHref, usePathname } from '../runtime/navigation';
import { RegisteredStudio } from './components/studio/registered-studio';
import { StudioProvider } from './components/studio/studio-provider';
import { ConnectedClipMap } from './components/studio/connected-clip-map';
import Drift from './app/control/drift/page';
import Economy from './app/control/ekonomi/page';
import Accounts from './app/control/admin/accounts/page';
import Players from './app/control/admin/players/page';
import Payments from './app/control/admin/payments/page';
import Api from './app/control/admin/api/page';
import Log from './app/control/admin/log/page';
import Models from './app/control/ai/models/page';
import Chat from './app/control/ai/chat/page';
import { SystemOverview } from './components/studio/system-overview';

// These explicitly labelled design pages stay available for the next scoped
// integrations. They never replace a failed registered-catalogue response.
const examples: Record<string, ComponentType> = {
  '/control/drift': Drift, '/control/ekonomi': Economy,
  '/control/admin/accounts': Accounts, '/control/admin/players': Players, '/control/admin/payments': Payments,
  '/control/admin/api': Api, '/control/admin/log': Log, '/control/ai/models': Models, '/control/ai/chat': Chat,
};

const pages: Record<string, string> = {
  '/control/structure': 'Struktur',
  '/control/clips': 'Klippkarta',
  '/control/drift': 'Drift', '/control/ekonomi': 'Ekonomi', '/control/admin/accounts': 'Konton & åtkomst',
  '/control/admin/operators': 'Spelbolag', '/control/admin/players': 'Spelare', '/control/admin/payments': 'Betalningar',
  '/control/admin/api': 'API', '/control/admin/log': 'Ändringslogg', '/control/ai/models': 'Agentmodeller', '/control/ai/chat': 'Agentchatt',
};
function App() {
  const path = usePathname();
  const isolatedPreview = document.querySelector('meta[name="croupier-environment"]')?.getAttribute('content')==='isolated-qa';
  const Example = examples[path];
  const studio = ['/control','/control/clips','/control/rooms','/control/dealers','/control/assets'].includes(path);
  return <div className="preview-admin flex bg-sg-bg text-sg-text">
    <StudioSidebar /><main className="flex min-w-0 flex-1 flex-col overflow-auto">
      <header className="studio-portal-bar"><span>Scoutgaming <span className="studio-portal-divider">/</span> {studio?'Studio':pages[path]??'System'}</span><nav aria-label="Portaler"><Link href="/control/clips" aria-current="page"><b>1</b> Studio</Link><a href="/partner"><b>2</b> Spelbolag</a><a href="/play"><b>3</b> Spelarvy</a></nav></header>
      {isolatedPreview&&<div className="border-b border-sg-line bg-sg-panel px-5 py-2 text-xs text-sg-muted" role="note">Isolerad förhandsvisning · testdata · inga produktionsskrivningar</div>}
      <label className="preview-mobile-nav">Sida <select value={studio ? '/control/clips' : path} onChange={event => navigate(previewHref(event.target.value))}>
        {Object.entries(pages).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <div className="studio-workspace-mount" hidden={!studio}><ConnectedClipMap /></div>
      {!studio && (path==='/control/structure' ? <SystemOverview /> : Example ? <StudioProvider>
        <div className="border-b border-sg-line px-6 py-2 text-xs text-sg-muted" role="note">
          Designexempel · {pages[path]} är ännu inte anslutet. Uppgifter och ändringar här är simulerade och påverkar inga riktiga register.
        </div>
        <Example />
      </StudioProvider> : <RegisteredStudio path={path} title={pages[path] ?? 'Struktur'} />)}
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App />);
