import { useEffect, useState } from 'react';
import { DealerImportAssistant } from './dealer-import-assistant';

// Clip import owns one persistent draft, separate from the site-wide
// administrator and OpenClaw conversations.
export function DealerAssistantShell({pageMode}:{pageMode:'chat'|'import'|null;onShowPage:(mode:'chat'|'import')=>boolean|void}) {
  const [started,setStarted]=useState(pageMode==='import');
  useEffect(()=>{if(pageMode==='import')setStarted(true);},[pageMode]);
  return <>
    <div hidden={pageMode!=='import'}>{started&&<DealerImportAssistant active={pageMode==='import'} mode="import"/>}</div>
    {pageMode==='chat'&&<section className="dealer-import dealer-import-panel" aria-labelledby="adminrobot-title">
      <p className="dealer-import-eyebrow">Nivå 1 · Scoutgaming</p><h1 id="adminrobot-title">Adminroboten</h1>
      <p>Undersök dealers, material, bolag, spelrum och ansluten drift. Robotens förslag ändrar ingenting förrän du har granskat konsekvenserna och bekräftat åtgärden.</p>
      <div className="dealer-import-actions"><button type="button" data-scout-assistant="admin">Öppna Adminroboten</button>
        <button type="button" data-scout-assistant="openclaw">OpenClaw · drift och modeller</button></div>
      <p>Scoutguiden ger snabb hjälp på alla sidor. Klippassistenten sorterar filer i importvyn. Spelbordets dealerchatt är separat.</p>
    </section>}
  </>;
}
