import { useEffect, useState } from 'react';
import { DealerImportAssistant } from './dealer-import-assistant';

// Clip import owns one persistent draft, separate from the site-wide
// administrator and OpenClaw conversations.
export function DealerAssistantShell({pageMode,registrationBlocked,onRegistered,requestedDealerId,onBusyChange}:{pageMode:'chat'|'import'|null;onShowPage:(mode:'chat'|'import')=>boolean|void;registrationBlocked?:boolean;onRegistered?:()=>void;requestedDealerId?:string;onBusyChange?:(busy:boolean)=>void}) {
  const [started,setStarted]=useState(pageMode==='import');
  useEffect(()=>{if(pageMode==='import')setStarted(true);},[pageMode]);
  return <>
    <div hidden={pageMode!=='import'}>{started&&<DealerImportAssistant active={pageMode==='import'} mode="import" registrationBlocked={registrationBlocked} onRegistered={onRegistered} requestedDealerId={requestedDealerId} onBusyChange={onBusyChange}/>}</div>
    {pageMode==='chat'&&<section className="admin-system-page" aria-labelledby="adminrobot-title">
      <header className="admin-system-header"><div><p className="sg-eyebrow">System</p><h1 id="adminrobot-title">Adminroboten</h1>
        <p>Få hjälp med dealers, filmer, bolag och rum.</p></div></header>
      <div className="admin-system-card">
        <div className="admin-system-actions"><button className="studio-button" type="button" data-scout-assistant="admin">Öppna Adminroboten</button></div>
        <details><summary>Andra assistenter</summary><p>Klippassistenten sorterar filmer i importvyn. Dealerchatten hör till spelbordet.</p>
          <div className="admin-system-actions"><button className="studio-button" type="button" data-scout-assistant="openclaw">OpenClaw · drift och modeller</button></div>
        </details>
      </div>
    </section>}
  </>;
}
