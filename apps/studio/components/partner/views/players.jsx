// Spelare: ett ärligt tomläge tills spelare kopplats till bolaget (steg F). Servern
// kontrollerar players.read för menyvalet och adressen.
import React from 'react';
import { Users } from 'lucide-react';
import { Empty, Page } from './ui.jsx';

export function PartnerPlayers({ copy, language = 'sv' }) {
  const en = language === 'en', t = (sv, english) => en ? english : sv;
  return <Page title={copy.players}>
    <Empty icon={<Users size={20} />} title={t('Era spelare visas här när de kopplats till er.', 'Your players appear here once they are linked to you.')}
      text={t('Konto, saldo och status per spelare. Inget visas förrän det finns riktiga spelare.', 'Account, balance and status per player. Nothing is shown until there are real players.')} />
  </Page>;
}
