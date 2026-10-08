import { labUrl } from '../lib/lab-url.mjs';
import { PageTemplate } from './page-template.mjs';

export function ControlPreviewPage() {
  return <PageTemplate
    eyebrow="// STUDIO"
    title="Förhandsvisning"
    intro="Lagerprov: bakgrund, bord och dealer som separata lager (Paow och Dragge, 720p). Ett prov, inte en spelväg; ingen koppling till spelmotor, saldo eller produktion."
  >
    <div className="sg-page-body">
      <p>Material: test-videoeditor/preview/site, hashar verifierade vid bygget.</p>
      <iframe title="Förhandsvisning · lagerprov" src={labUrl('/preview/index.html')} style={{ display: 'block', width: '100%', height: '88vh', minHeight: '720px', border: 0, background: '#0c1017' }} />
    </div>
  </PageTemplate>;
}
