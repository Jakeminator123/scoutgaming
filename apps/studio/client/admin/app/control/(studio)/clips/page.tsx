import type { ReactNode } from 'react';
import { DealerAssistantShell } from '@/components/studio/dealer-assistant-shell';
import { useRouter, useSearchParams } from 'next/navigation';

// Both workspaces stay mounted: changing tools preserves their independent drafts.
export default function ClipsPage({active=true,dealersActive=false,onImportBusyChange,children,registrationBlocked,onRegistered}:{active?:boolean;dealersActive?:boolean;onImportBusyChange?:(busy:boolean)=>void;children:ReactNode;registrationBlocked?:boolean;onRegistered?:()=>void}) {
  const router=useRouter(), query=useSearchParams();
  const importing=query.get('tool')==='import';
  function showTool(tool:'map'|'import') {
    const next=new URLSearchParams(location.search);
    if(tool==='import')next.set('tool','import');else next.delete('tool');
    return router.push(`/admin/clips${next.size?`?${next}`:''}`);
  }
  return <>
    {(active||dealersActive)&&importing&&<div className="dealer-import-tabs"><button type="button" onClick={()=>showTool('map')}>Öppna klippkartan</button></div>}
    <div className="studio-workspace-mount" hidden={!active||importing}>{children}</div>
    <DealerAssistantShell pageMode={(active||dealersActive)&&importing?'import':null} requestedDealerId={query.get('dealer')??''} onBusyChange={onImportBusyChange} registrationBlocked={registrationBlocked} onRegistered={onRegistered}/>
  </>;
}
