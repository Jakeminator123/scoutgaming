// Hjälp och kontakt: vad rollen får göra, orden, och Begär material (öppnas som
// e-post till Scoutgaming; inget skickas härifrån och inget hamnar i tilldelningen).
import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import { Btn, Card, KV, Note, Page } from './ui.jsx';
import { partnerPermissionWord } from '../../../lib/partner-words.mjs';

// Typerna; "Önska bakgrund" har ett eget beskrivningsfält. Begäran är bara en förfrågan.
const KINDS = [
  { id: 'background-wish', sv: 'Önska bakgrund', en: 'Wish for a background', field: ['Beskriv bakgrunden', 'Describe the background'], placeholder: ['T.ex. mörk lounge med guldtoner.', 'E.g. a dark lounge with gold tones.'],
    note: ['Scoutgaming tar fram förslag och lägger det godkända i er tilldelning.', 'Scoutgaming makes proposals and adds the approved one to your assignment.'] },
  { id: 'background', sv: 'En ny bakgrund', en: 'A new background' }, { id: 'table', sv: 'Ny bordsgrafik', en: 'New table graphics' },
  { id: 'dealer', sv: 'En annan dealer', en: 'Another dealer' }, { id: 'room', sv: 'Ett spelbord till', en: 'Another table' },
  { id: 'limit', sv: 'Byta insatsprofil', en: 'Change limit preset' }, { id: 'pause', sv: 'Pausa eller öppna ett spelbord', en: 'Pause or open a table' },
  { id: 'key', sv: 'Ny eller roterad nyckel', en: 'New or rotated key' }, { id: 'other', sv: 'Annat', en: 'Other' },
];

export function materialRequestMailto({ operator, kind, description, user, field }, language = 'sv') {
  const en = language === 'en';
  const subject = en ? `Material request from ${operator.name}: ${kind}` : `Begäran om material från ${operator.name}: ${kind}`;
  const body = [en ? `Company: ${operator.name} (${operator.slug})` : `Bolag: ${operator.name} (${operator.slug})`, en ? `Requested by: ${user}` : `Begärs av: ${user}`,
    en ? `Request: ${kind}` : `Önskemål: ${kind}`, '', ...(field ? [field + ':'] : []), description || (en ? '(describe what you need)' : '(beskriv vad ni behöver)')].join('\n');
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function PartnerHelp({ snapshot, copy, language = 'sv', user }) {
  const en = language === 'en', t = (sv, english) => en ? english : sv, lang = en ? 1 : 0;
  const [kindId, setKindId] = useState(KINDS[0].id);
  const [description, setDescription] = useState('');
  const kind = KINDS.find(item => item.id === kindId) ?? KINDS[0], kindLabel = en ? kind.en : kind.sv;
  const may = (snapshot.permissions ?? []).map(permission => partnerPermissionWord(permission, language));
  const role = snapshot.role?.label ?? copy.member;
  return <Page title={copy.help} intro={t('Vad ni får göra, orden vi använder och hur ni begär material.', 'What you may do, the words we use and how to request material.')}>
    <div className="grid main-aside">
      <Card title={t('Begär material', 'Request material')} icon={<Mail size={15} />}>
        <div className="field"><label htmlFor="help-kind">{t('Vad behöver ni?', 'What do you need?')}</label>
          <select id="help-kind" className="input" value={kindId} onChange={event => setKindId(event.target.value)}>{KINDS.map(item => <option key={item.id} value={item.id}>{en ? item.en : item.sv}</option>)}</select></div>
        <div className="field mt"><label htmlFor="help-description">{kind.field ? kind.field[lang] : t('Beskrivning', 'Description')}</label>
          <textarea id="help-description" className="input" rows={4} value={description} onChange={event => setDescription(event.target.value)} placeholder={kind.placeholder ? kind.placeholder[lang] : t('T.ex. en ljusare bakgrund till Privé-bordet, med vår logga.', 'E.g. a lighter background for the Privé table, with our logo.')} /></div>
        {kind.note ? <p className="small muted mt">{kind.note[lang]}</p> : null}
        <div className="actions mt"><Btn tone="primary" href={materialRequestMailto({ operator: snapshot.operator, kind: kindLabel, description, user, field: kind.field?.[lang] }, language)}><Mail size={14} aria-hidden="true" />{t('Öppna som e-post till Scoutgaming', 'Open as an email to Scoutgaming')}</Btn></div>
        <Note tone="accent">{t('Begäran öppnas som ett e-postutkast i ert e-postprogram; fyll i Scoutgamings adress och skicka. Inget ändras i era spelbord förrän Scoutgaming publicerat.', 'The request opens as an email draft in your mail program; add the Scoutgaming address and send. Nothing changes on your tables until Scoutgaming has published.')}</Note>
      </Card>
      <div className="stack">
        <Card title={t(`Rollen ${role} får`, `The role ${role} may`)}>
          {may.length ? <ul className="small list">{may.map(item => <li key={item}>{item}</li>)}</ul> : <p className="muted">—</p>}
          <KV items={[[t('Dealer, bakgrund, bordsgrafik', 'Dealer, background, table graphics'), t('väljs bland det Scoutgaming tilldelat', 'chosen among what Scoutgaming assigned')],
            [t('Språk och insatsprofil', 'Language and limit preset'), t('bestäms av Scoutgaming', 'set by Scoutgaming')],
            [t('Öppet eller pausat', 'Open or paused'), t('begärs från Scoutgaming', 'requested from Scoutgaming')],
            [t('Team', 'Team'), t('administratören bjuder in redaktörer och läsare', 'the administrator invites editors and readers')]]} />
        </Card>
        <Card title={t('Orden', 'The words')}>
          <KV items={[[t('Spelbord', 'Table'), t('er ingång till ett spel, öppet eller pausat', 'your entry to a game, open or paused')], [t('Tilldelning', 'Assignment'), t('det ni får använda, med ett versionsnummer', 'what you may use, with a version number')],
            [t('Utkast och publicerad', 'Draft and published'), t('spelare ser bara det publicerade', 'players only see what is published')],
            [t('Bestäms av Scoutgaming', 'Set by Scoutgaming'), t('ett val ni inte gör själva', 'a choice you do not make yourselves')]]} />
        </Card>
      </div>
    </div>
  </Page>;
}
