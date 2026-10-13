import { useEffect, useState } from 'react';
import { DealerImportAssistant } from './dealer-import-assistant';

// Clip import owns one persistent draft, separate from the site-wide
// administrator and OpenClaw conversations.
export function DealerAssistantShell({pageMode,registrationBlocked,onRegistered,requestedDealerId,onBusyChange}:{pageMode:'chat'|'import'|null;onShowPage:(mode:'chat'|'import')=>boolean|void;registrationBlocked?:boolean;onRegistered?:()=>void;requestedDealerId?:string;onBusyChange?:(busy:boolean)=>void}) {
  const [started,setStarted]=useState(pageMode==='import');
  useEffect(()=>{if(pageMode==='import')setStarted(true);},[pageMode]);
  return <>
    <div hidden={pageMode!=='import'}>{started&&<DealerImportAssistant active={pageMode==='import'} mode="import" registrationBlocked={registrationBlocked} onRegistered={onRegistered} requestedDealerId={requestedDealerId} onBusyChange={onBusyChange}/>}</div>
    {pageMode==='chat'&&<section className="dealer-import dealer-import-panel" aria-labelledby="adminrobot-title">
      <p className="dealer-import-eyebrow">Nivå 1 · Scoutgaming</p><h1 id="adminrobot-title">Adminroboten</h1>
      <p>Dra in filmer i chatten, välj dealer och skicka för att sortera och placera dem. Du kan också hantera material, bolag och spelrum. Borttagning visar konsekvenserna först.</p>
      <div className="dealer-import-actions"><button type="button" data-scout-assistant="admin">Öppna Adminroboten</button>
        <button type="button" data-scout-assistant="openclaw">OpenClaw · drift och modeller</button></div>
      <p>Scoutguiden ger snabb hjälp på alla sidor. Klippassistenten sorterar filer i importvyn. Spelbordets dealerchatt är separat.</p>
    </section>}
  </>;
}
