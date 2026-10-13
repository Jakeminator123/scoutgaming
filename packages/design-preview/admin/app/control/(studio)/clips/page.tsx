import type { ReactNode } from 'react';
import { DealerAssistantShell } from '@/components/studio/dealer-assistant-shell';
import { useRouter, useSearchParams } from 'next/navigation';

// Both workspaces stay mounted: changing tools preserves their independent drafts.
export default function ClipsPage({active=true,chatActive=false,children}:{active?:boolean;chatActive?:boolean;children:ReactNode}) {
  const router=useRouter(), query=useSearchParams();
  const importing=query.get('tool')==='import';
  function showTool(tool:'map'|'import') {
    const next=new URLSearchParams(location.search);
    if(tool==='import')next.set('tool','import');else next.delete('tool');
    return router.push(`/admin/clips${next.size?`?${next}`:''}`);
  }
  return <>
    <nav className="dealer-import-tabs" aria-label="Klippverktyg" hidden={!active}>
      <button aria-pressed={!importing} onClick={()=>showTool('map')}>Klippkarta</button>
      <button aria-pressed={importing} onClick={()=>showTool('import')}>Importassistent · klippbank</button>
    </nav>
    <div className="studio-workspace-mount" hidden={!active||importing}>{children}</div>
    <DealerAssistantShell pageMode={chatActive?'chat':active&&importing?'import':null}
      onShowPage={mode=>mode==='chat'?router.push('/admin/ai/chat'):showTool('import')}/>
  </>;
}
