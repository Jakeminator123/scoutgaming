// Integration: status, startadress och kontakt. Nycklar kan inte visas per bolag
// (croupier_auth.api_keys saknar bolag) förrän steg F.
import React from 'react';
import { workspaceSurfacePath } from '../../../../../packages/navigation/workspace-surfaces.mjs';
import { Btn, Card, Chip, Empty, KV, Page } from './ui.jsx';

export function PartnerIntegration({ snapshot, copy, language = 'sv' }) {
  const en = language === 'en', t = (sv, english) => en ? english : sv;
  const start = `/game?operator=${encodeURIComponent(snapshot.operator.slug)}`;
  const live = (snapshot.tables ?? []).filter(room => room.state === 'live' || room.status === 'active');
  return <Page title={copy.integration} intro={t('Status, startadress och kontakt. Ni startar spelare från er egen sajt; nyckel och testsession tilldelas av Scoutgaming.', 'Status, start address and contact. You start players from your own site; key and test session are assigned by Scoutgaming.')}>
    <div className="grid c2">
      <Card title={t('Status', 'Status')}>
        <KV items={[
          [t('Koppling', 'Connection'), <Chip key="status" tone="warn">{t('inte ansluten', 'not connected')}</Chip>],
          [t('Startadress', 'Start address'), <code key="start">{start}</code>],
          [t('Öppna spelbord', 'Open tables'), live.length ? live.map(room => room.name).join(', ') : t('inga öppna spelbord', 'no open tables')],
          [t('Kontakt', 'Contact'), <a key="help" href={workspaceSurfacePath('partner', 'help', snapshot.operator.slug)} style={{ textDecoration: 'underline' }}>{copy.help}</a>],
        ]} />
        <p className="small muted mt">{t('Startadressen öppnar lobbyn för bolagets öppna spelbord. En spelare från er sajt startas med er nyckel; tills den finns per bolag är kopplingen inte ansluten.', 'The start address opens the lobby for the company\'s open tables. A player from your site is started with your key; until it exists per company the connection is not connected.')}</p>
        <div className="actions mt"><Btn href={start} target="_blank" rel="noopener">{t('Öppna lobbyn ↗', 'Open the lobby ↗')}</Btn></div>
      </Card>
      <Card title={t('Nycklar', 'Keys')} aside={<Chip tone="warn">{copy.notConnected}</Chip>}>
        <Empty chip={null} title={t('Nycklar kan inte visas per bolag', 'Keys cannot be shown per company')}
          text={t('API-nycklarna saknar bolag i registret (api_keys). De knyts till bolag i steg F efter O03; tills dess hanterar Scoutgaming nycklarna och rotation begärs via Hjälp och kontakt.', 'The API keys carry no company in the register (api_keys). They are linked to companies in step F after O03; until then Scoutgaming manages the keys and rotation is requested via Help and contact.')} />
      </Card>
    </div>
  </Page>;
}
