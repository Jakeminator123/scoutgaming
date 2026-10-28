import type { ReactNode } from 'react';
import { DealerAssistantShell } from '@/components/studio/dealer-assistant-shell';
import { useRouter, useSearchParams } from 'next/navigation';

// Both workspaces stay mounted: changing tools preserves their independent drafts.
// "Importera mapp" (?tool=import) is the second step of Lägg till klipp on the dealer's Klippkarta tab.
export default function ClipsPage({active=true,dealerId='',base='/admin/dealers',onImportBusyChange,children,registrationBlocked,onRegistered}:{active?:boolean;dealerId?:string;base?:string;onImportBusyChange?:(busy:boolean)=>void;children:ReactNode;registrationBlocked?:boolean;onRegistered?:()=>void}) {
  const router=useRouter(), query=useSearchParams();
  const importing=query.get('tool')==='import';
  function showMap() {
    const next=new URLSearchParams(location.search);
    next.delete('tool');next.set('flik','klipp');next.set('panel','intake');
    return router.push(`${base}?${next}`);
  }
  return <>
    {active&&importing&&<div className="dealer-import-tabs"><button type="button" onClick={showMap}>Tillbaka till Ladda upp filer</button></div>}
    <div className="studio-workspace-mount" hidden={!active||importing}>{children}</div>
    <DealerAssistantShell pageMode={active&&importing?'import':null} requestedDealerId={dealerId||query.get('dealer')||''} onBusyChange={onImportBusyChange} registrationBlocked={registrationBlocked} onRegistered={onRegistered}/>
  </>;
}
