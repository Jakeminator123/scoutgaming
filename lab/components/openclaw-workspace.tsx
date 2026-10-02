import { openClawDashboardUrl, RENDER_CONTROL_URL } from '../lib/openclaw-dashboard.mjs';
import { labUrl } from '../lib/lab-url.mjs';

export function OpenClawWorkspace({ dashboardUrl }: { dashboardUrl?: unknown }) {
  const url = openClawDashboardUrl(dashboardUrl);
  return <main id="main-content" className="workspace" style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 48px' }}>
    <div className="section-intro">
      <span className="eyebrow">OPENCLAW · ADMINISTRATION</span>
      <h1>OpenClaws dashboard</h1>
      <p>Öppna OpenClaws egen Control UI på Render för agentchatt, sessions, tools och inställningar.</p>
    </div>
    <section aria-labelledby="openclaw-connect" className="notice" style={{ marginBottom: 28 }}>
      <h2 id="openclaw-connect">Öppna din befintliga anslutning</h2>
      <p>Dashboarden använder OpenClaws befintliga Gateway-lösenord och webbläsargodkännande. En ny webbläsare kan behöva godkännas en gång.</p>
      {url ? <a className="primary-button" style={{ marginTop: 16 }} href={url}>Öppna OpenClaw-dashboard ↗</a>
        : <p role="alert">Dashboardadressen är ogiltig. Kontrollera den konfigurerade adressen innan du öppnar dashboarden.</p>}
      <p>Anslutningen har inte hälsotestats här.</p>
    </section>
    <section aria-labelledby="openclaw-changes" style={{ marginBottom: 28 }}>
      <h2 id="openclaw-changes">Vad ändrar du var?</h2>
      <dl className="metadata-list" style={{ marginTop: 16 }}>
        <div><dt>OpenClaw-dashboard</dt><dd>Agentchatt, sessions, tools och Gateway-inställningar. Adminarbetet hör till croupier-operator. Behåll runtime-agenternas begränsade tools.</dd></div>
        <div><dt>Dealer &amp; klipp</dt><dd>Dealerns sparade klipp, standardval, tillåtna alternativ och regler ändrar du i <a className="text-button" href={labUrl('/')}>Studio</a>.</dd></div>
        <div><dt>Render</dt><dd>Deployment, nätväg och inloggningsläge hanteras i <a className="text-button" href={RENDER_CONTROL_URL}>Render-konsolen ↗</a>.</dd></div>
      </dl>
    </section>
    <section aria-labelledby="openclaw-policy" className="notice subtle">
      <h2 id="openclaw-policy">Spara utan att starta om tjänsterna</h2>
      <p>Ändringar av sparade klipp och regler i Studio kräver normalt ingen omstart av Render. Astrids deal- och replikval läses inför nästa beslut, och Probe använder senaste sparade policy.</p>
      <p>Ladda om spelfliken mellan händer efter ändrad idlepolicy eller originalmotorns klippval.</p>
      <p>Gateway är fortsatt privat. Den publika Director-adressen öppnar dashboarden med OpenClaws eget inloggningsskydd.</p>
    </section>
  </main>;
}
