import { useEffect, useState } from 'react';
import { DealerImportAssistant } from './dealer-import-assistant';

// Clip import owns one persistent draft, separate from the site-wide
// administrator and OpenClaw conversations.
export function DealerAssistantShell({pageMode,registrationBlocked,onRegistered,requestedDealerId,onBusyChange}:{pageMode:'import'|null;registrationBlocked?:boolean;onRegistered?:()=>void;requestedDealerId?:string;onBusyChange?:(busy:boolean)=>void}) {
  const [started,setStarted]=useState(pageMode==='import');
  useEffect(()=>{if(pageMode==='import')setStarted(true);},[pageMode]);
  return <>
    <div hidden={pageMode!=='import'}>{started&&<DealerImportAssistant active={pageMode==='import'} mode="import" registrationBlocked={registrationBlocked} onRegistered={onRegistered} requestedDealerId={requestedDealerId} onBusyChange={onBusyChange}/>}</div>
  </>;
}
