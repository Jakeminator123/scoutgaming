import { useEffect, useState } from 'react';
import { DealerImportAssistant } from './dealer-import-assistant';

// The site-wide assistant drawer is opened by the widget through data-scout-assistant.
// The same card serves the Adminroboten route and the OpenClaw page tab.
export function AdminAssistantPage({embedded=false}:{embedded?:boolean}) {
  const Heading=embedded?'h2':'h1';
  return <section className={embedded?'admin-openclaw-panel':'admin-system-page'} aria-labelledby="adminrobot-title">
    <header className="admin-system-header"><div>{!embedded&&<p className="sg-eyebrow">System</p>}<Heading id="adminrobot-title">Adminroboten</Heading>
      <p>Få hjälp med dealers, filmer, bolag och rum.</p></div></header>
    <div className="admin-system-card">
      <div className="admin-system-actions"><button className="studio-button" type="button" data-scout-assistant="admin">Öppna Adminroboten</button></div>
      <details><summary>Andra assistenter</summary><p>Klippassistenten sorterar filmer i importvyn. Dealerchatten hör till spelbordet.</p>
        <div className="admin-system-actions"><button className="studio-button" type="button" data-scout-assistant="openclaw">OpenClaw · drift och modeller</button></div>
      </details>
    </div>
  </section>;
}

// Clip import owns one persistent draft, separate from the site-wide
// administrator and OpenClaw conversations.
export function DealerAssistantShell({pageMode,registrationBlocked,onRegistered,requestedDealerId,onBusyChange}:{pageMode:'chat'|'import'|null;onShowPage:(mode:'chat'|'import')=>boolean|void;registrationBlocked?:boolean;onRegistered?:()=>void;requestedDealerId?:string;onBusyChange?:(busy:boolean)=>void}) {
  const [started,setStarted]=useState(pageMode==='import');
  useEffect(()=>{if(pageMode==='import')setStarted(true);},[pageMode]);
  return <>
    <div hidden={pageMode!=='import'}>{started&&<DealerImportAssistant active={pageMode==='import'} mode="import" registrationBlocked={registrationBlocked} onRegistered={onRegistered} requestedDealerId={requestedDealerId} onBusyChange={onBusyChange}/>}</div>
    {pageMode==='chat'&&<AdminAssistantPage/>}
  </>;
}
