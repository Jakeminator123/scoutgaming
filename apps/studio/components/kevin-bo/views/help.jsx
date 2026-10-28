// Hjälp och kontakt: vad rollen får ändra, orden, och Begär material (mailto tills
// en journalpost finns i steg C).
import React, { useState } from 'react';
import { Btn, Card, KV, Note, Page } from './ui.jsx';

const PERMISSION_WORDS = {
  sv: { 'overview.read': 'se översikten', 'tables.read': 'se spelborden', 'tables.configure': 'ändra spelbordens inställningar', 'presentations.read': 'se scenmallar och utseende',
    'presentations.configure': 'ändra spelbordets utseende och publicera', 'players.read': 'se spelare', 'reports.read': 'se ekonomi', 'integrations.read': 'se integration',
    'team.read': 'se teamet', 'team.invite': 'bjuda in medlemmar', 'team.roles.assign': 'byta roll på medlemmar', 'team.suspend': 'stänga av och återaktivera medlemmar' },
  en: { 'overview.read': 'see the overview', 'tables.read': 'see the tables', 'tables.configure': 'change table settings', 'presentations.read': 'see scene templates and appearance',
    'presentations.configure': 'change table appearance and publish', 'players.read': 'see players', 'reports.read': 'see finance', 'integrations.read': 'see integration',
    'team.read': 'see the team', 'team.invite': 'invite members', 'team.roles.assign': 'change member roles', 'team.suspend': 'suspend and reactivate members' },
};

export function materialRequestMailto({ operator, kind, description, user }, language = 'sv') {
  const en = language === 'en';
  const subject = en ? `Material request from ${operator.name} (${operator.slug}): ${kind}` : `Begäran om material från ${operator.name} (${operator.slug}): ${kind}`;
  const body = [en ? `Company: ${operator.name} (${operator.slug})` : `Bolag: ${operator.name} (${operator.slug})`, en ? `Requested by: ${user}` : `Begärs av: ${user}`,
    en ? `Request: ${kind}` : `Önskemål: ${kind}`, '', description || (en ? '(describe what you need)' : '(beskriv vad ni behöver)')].join('\n');
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function PartnerHelp({ snapshot, copy, language = 'sv', user }) {
  const en = language === 'en', t = (sv, english) => en ? english : sv;
  const kinds = [t('En ny bakgrund', 'A new background'), t('Ny bordsgrafik', 'New table graphics'), t('En annan dealer', 'Another dealer'), t('Ett spelbord till', 'Another table'), t('Byta insatsprofil', 'Change limit preset'), t('Pausa eller öppna ett spelbord', 'Pause or open a table'), t('Rotera API-nyckel', 'Rotate API key'), t('Annat', 'Other')];
  const [kind, setKind] = useState(kinds[0]);
  const [description, setDescription] = useState('');
  const words = PERMISSION_WORDS[en ? 'en' : 'sv'];
  const may = (snapshot.permissions ?? []).map(permission => words[permission] ?? permission);
  const role = snapshot.role?.label ?? copy.member;
  return <Page title={copy.help} intro={t('Vad ni får ändra, orden vi använder, och hur ni begär material.', 'What you may change, the words we use, and how to request material.')}>
    <div className="grid c2">
      <Card title={t('Begär material', 'Request material')}>
        <div className="field"><label htmlFor="help-kind">{t('Vad behöver ni?', 'What do you need?')}</label>
          <select id="help-kind" className="input" value={kind} onChange={event => setKind(event.target.value)}>{kinds.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
        <div className="field mt"><label htmlFor="help-description">{t('Beskrivning', 'Description')}</label>
          <textarea id="help-description" className="input" rows={4} value={description} onChange={event => setDescription(event.target.value)} placeholder={t('T.ex. en ljusare bakgrund till Privé-bordet, med vår logga.', 'E.g. a lighter background for the Privé table, with our logo.')} /></div>
        <div className="actions mt"><Btn tone="primary" href={materialRequestMailto({ operator: snapshot.operator, kind, description, user }, language)}>{t('Öppna som e-post till Scoutgaming', 'Open as an email to Scoutgaming')}</Btn></div>
        <Note tone="accent">{t('Begäran skickas som e-post tills en journalpost finns (steg C). Mottagaradressen fylls i av er; den är inte fastställd i portalen ännu.', 'The request is sent as email until a journal entry exists (step C). You fill in the recipient; it is not fixed in the portal yet.')}</Note>
      </Card>
      <div className="stack">
        <Card title={t(`Vad rollen ${role} får göra`, `What the role ${role} may do`)}>
          {may.length ? <ul className="small" style={{ margin: 0, paddingLeft: 20 }}>{may.map(item => <li key={item}>{item}</li>)}</ul> : <p className="muted">—</p>}
          <KV items={[[t('Dealer, bakgrund, bordsgrafik', 'Dealer, background, table graphics'), t('bland tilldelade, om Scoutgaming låst upp valet', 'among assigned, if Scoutgaming unlocked the choice')],
            [t('Bordsspråk och insatsprofil', 'Table language and limit preset'), t('ändras av Scoutgaming tills vidare', 'changed by Scoutgaming for now')],
            [t('Öppet eller pausat', 'Open or paused'), t('begärs från Scoutgaming tills vidare', 'requested from Scoutgaming for now')],
            [t('Team', 'Team'), t('administratören bjuder in redaktör och läsare', 'the administrator invites editors and readers')]]} />
        </Card>
        <Card title={t('Orden', 'The words')}>
          <KV items={[[t('Spelbord', 'Table'), t('er ingång till ett spel, öppet eller pausat', 'your entry to a game, open or paused')], [t('Tilldelning', 'Assignment'), t('det ni får använda, revision N', 'what you may use, revision N')],
            [t('Scenmall', 'Scene template'), t('placeringen av dealer, bakgrund och bordsgrafik', 'the placement of dealer, background and table graphics')], [t('Utkast och publicerad', 'Draft and published'), t('spelare ser bara publicerat', 'players only see published')],
            [t('Låst av Scoutgaming', 'Locked by Scoutgaming'), t('ett val Scoutgaming inte låst upp för er', 'a choice Scoutgaming has not unlocked for you')]]} />
        </Card>
        <Card title={t('Kontakt', 'Contact')}><p className="small muted">{t('Scoutgaming svarar vardagar. Kontaktadressen är inte fastställd i portalen ännu; använd knappen Begär material eller er ordinarie kontakt hos Scoutgaming.', 'Scoutgaming answers on weekdays. The contact address is not fixed in the portal yet; use Request material or your usual Scoutgaming contact.')}</p></Card>
      </div>
    </div>
  </Page>;
}
