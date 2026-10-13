import { createRoot } from 'react-dom/client';
import { StudioSidebar } from './components/studio/studio-sidebar';
import { navigate, previewHref, usePathname } from '../runtime/navigation';
import { RegisteredStudio } from './components/studio/registered-studio';
import { StudioProvider } from './components/studio/studio-provider';
import { HierarchyBar } from './components/studio/hierarchy-bar';
import Clips from './app/control/(studio)/clips/page';
import Assets from './app/control/(studio)/assets/page';
import Drift from './app/control/drift/page';
import Economy from './app/control/ekonomi/page';
import Accounts from './app/control/admin/accounts/page';
import Players from './app/control/admin/players/page';
import Payments from './app/control/admin/payments/page';
import Api from './app/control/admin/api/page';
import Log from './app/control/admin/log/page';
import Models from './app/control/ai/models/page';
import Chat from './app/control/ai/chat/page';

// These explicitly labelled design pages stay available for the next scoped
// integrations. They never replace a failed registered-catalogue response.
const examples: Record<string, typeof Clips> = {
  '/control/assets': Assets, '/control/drift': Drift, '/control/ekonomi': Economy,
  '/control/admin/accounts': Accounts, '/control/admin/players': Players, '/control/admin/payments': Payments,
  '/control/admin/api': Api, '/control/admin/log': Log, '/control/ai/models': Models, '/control/ai/chat': Chat,
};

const pages: Record<string, string> = {
  '/control/structure': 'Struktur', '/control/rooms': 'Spelrum', '/control/dealers': 'Dealers',
  '/control/clips': 'Klippkarta', '/control/assets': 'Bord & bakgrunder',
  '/control/drift': 'Drift', '/control/ekonomi': 'Ekonomi', '/control/admin/accounts': 'Konton & åtkomst',
  '/control/admin/operators': 'Spelbolag', '/control/admin/players': 'Spelare', '/control/admin/payments': 'Betalningar',
  '/control/admin/api': 'API', '/control/admin/log': 'Ändringslogg', '/control/ai/models': 'Agentmodeller', '/control/ai/chat': 'Agentchatt',
};
function App() {
  const path = usePathname();
  const Example = examples[path];
  return <div className="preview-admin flex bg-sg-bg text-sg-text">
    <StudioSidebar /><main className="flex min-w-0 flex-1 flex-col overflow-auto">
      <label className="preview-mobile-nav">Sida <select value={path === '/control' ? '/control/structure' : path} onChange={event => navigate(previewHref(event.target.value))}>
        {Object.entries(pages).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <div className={path==='/control/clips'?'dealer-import-route':'dealer-assistant-background'}><Clips active={path === '/control/clips'}/></div>
      {path === '/control/clips' ? null : Example ? <StudioProvider>
        <div className="border-b border-sg-line px-6 py-2 text-xs text-sg-muted" role="note">
          Designexempel · {pages[path]} är ännu inte anslutet. Uppgifter och ändringar här är simulerade och påverkar inga riktiga register.
        </div>
        {['/control/clips', '/control/assets'].includes(path) && <HierarchyBar />}
        <Example />
      </StudioProvider> : <RegisteredStudio path={path} title={pages[path] ?? 'Struktur'} />}
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App />);
