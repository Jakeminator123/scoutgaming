// Integration: status, startadress och kontakt. Nycklar visas inte i portalen ännu;
// Scoutgaming hanterar dem.
import React from 'react';
import { ArrowUpRight, Copy, KeyRound } from 'lucide-react';
import { workspaceSurfacePath } from '../../../../../packages/navigation/workspace-surfaces.mjs';
import { Btn, Card, Chip, KV, Page } from './ui.jsx';

export function PartnerIntegration({ snapshot, copy, language = 'sv' }) {
  const en = language === 'en', t = (sv, english) => en ? english : sv;
  const start = `/game?operator=${encodeURIComponent(snapshot.operator.slug)}`;
  const live = (snapshot.tables ?? []).filter(room => room.state === 'live' || room.status === 'active');
  const help = workspaceSurfacePath('partner', 'help', snapshot.operator.slug);
  const copyStart = () => { try { void navigator.clipboard?.writeText(new URL(start, window.location.href).href); } catch { /* Copying is a convenience only. */ } };
  return <Page title={copy.integration} intro={t('Startadressen öppnar lobbyn med era öppna spelbord. Spelare från er sajt startas med er nyckel från Scoutgaming.', 'The start address opens the lobby with your open tables. Players from your site are started with your key from Scoutgaming.')}>
    <div className="grid c2">
      <Card title={t('Startadress', 'Start address')}>
        <KV items={[
          [t('Adress', 'Address'), <code key="start">{start}</code>],
          [t('Öppna spelbord', 'Open tables'), live.length ? live.length === 1 ? t('1 spelbord', '1 table') : t(`${live.length} spelbord`, `${live.length} tables`) : t('inga öppna spelbord', 'no open tables')],
        ]} />
        <div className="actions mt"><Btn href={start} target="_blank" rel="noopener">{t('Öppna lobbyn', 'Open the lobby')}<ArrowUpRight size={14} aria-hidden="true" /></Btn><Btn tone="ghost" onClick={copyStart}><Copy size={14} aria-hidden="true" />{t('Kopiera', 'Copy')}</Btn></div>
      </Card>
      <Card title={t('Nyckel', 'Key')} icon={<KeyRound size={15} />} aside={<Chip tone="warn">{t('hos Scoutgaming', 'with Scoutgaming')}</Chip>}>
        <p className="muted">{t('Er nyckel hanteras av Scoutgaming och visas inte här. Behöver ni en ny eller vill rotera den: ', 'Your key is managed by Scoutgaming and is not shown here. To get a new one or rotate it: ')}<a href={help} className="link-quiet">{copy.help}</a>.</p>
      </Card>
    </div>
  </Page>;
}
