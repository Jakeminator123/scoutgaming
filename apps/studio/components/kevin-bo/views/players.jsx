// Spelare: ärligt tomläge tills spelare knyts till bolag (steg F efter O03). Inga exempelrader.
import React from 'react';
import { Card, Empty, KV, Note, Page } from './ui.jsx';

export function PartnerPlayers({ copy, language = 'sv' }) {
  const en = language === 'en', t = (sv, english) => en ? english : sv;
  return <Page title={copy.players} intro={t('Era spelare: konto, saldo, status, spärr och anteckning. Rollen läsare ser; administratören spärrar.', 'Your players: account, balance, status, block and note. The reader role views; the administrator blocks.')}>
    <Note tone="warn" role="status"><b>{copy.notConnected}.</b> {t('Spelare är inte knutna till bolag ännu; byggs i steg F efter O03. Tills dess visas ingenting här, inte heller exempel.', 'Players are not linked to companies yet; built in step F after O03. Until then nothing is shown here, not even examples.')}</Note>
    <div className="grid main-aside">
      <Card title={t('Det här kommer att visas', 'What will be shown')}>
        <Empty chip={copy.notConnected} title={t('Inga spelare att visa', 'No players to show')} text={t('Listan fylls när spelare hör till ert bolag.', 'The list fills when players belong to your company.')} />
      </Card>
      <Card title={t('Kolumnerna', 'The columns')}>
        <KV items={[
          [t('Konto', 'Account'), t('visningsnamn och inloggningsnamn', 'display name and login name')],
          [t('Saldo', 'Balance'), t('belopp och valuta (USD i dag)', 'amount and currency (USD today)')],
          [t('Status', 'Status'), t('aktiv, spärrad eller stängd', 'active, blocked or closed')],
          [t('Spärr', 'Block'), t('administratören spärrar med skäl; loggas', 'the administrator blocks with a reason; logged')],
          [t('Anteckning', 'Note'), t('bolagets egen anteckning per spelare', 'the company note per player')],
        ]} />
      </Card>
    </div>
  </Page>;
}
