// Integration: startadress, bolagets egna API-nycklar och kontakt. Nycklarna visas maskerade
// (namn, status, rättigheter och tider, aldrig nyckel eller hemlighet) och bara bolagets egna:
// servern läser dem för arbetsytans bolag (lib/partner-api-keys.mjs). Scoutgaming skapar,
// roterar och återkallar dem i Admin; här begär bolaget det via Hjälp och kontakt.
import React from 'react';
import { ArrowUpRight, Copy, KeyRound } from 'lucide-react';
import { workspaceSurfacePath } from '../../../../../packages/navigation/workspace-surfaces.mjs';
import { Btn, Card, Badge, KV, Page, Row, Rows, fmtDate } from './ui.tsx';

const dateOf = (value, language) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? fmtDate(Date.parse(value), language) : null;

function KeyList({ apiKeys, help, copy, t, language }) {
  const keys = Array.isArray(apiKeys.keys) ? apiKeys.keys : [];
  const contact = <a href={help} className="link-quiet">{copy.help}</a>;
  if (apiKeys.status === 'pending') return <p className="muted">{t('Era nycklar visas här när Scoutgaming har knutit dem till bolaget. Behöver ni en nyckel eller vill rotera den: ', 'Your keys appear here once Scoutgaming has linked them to your company. To get a key or rotate one: ')}{contact}.</p>;
  if (apiKeys.status !== 'connected') return <p className="muted">{t('Nycklarna kunde inte läsas just nu. Ladda om sidan om en stund. Brådskar det: ', 'The keys could not be read right now. Reload the page in a while. If it is urgent: ')}{contact}.</p>;
  if (!keys.length) return <p className="muted">{t('Ni har ingen nyckel ännu. Scoutgaming skapar den åt er: ', 'You have no key yet. Scoutgaming creates it for you: ')}{contact}.</p>;
  return <>
    <Rows>{keys.map(key => {
      const active = key.status === 'active', used = dateOf(key.lastUsed, language), created = dateOf(key.createdAt, language), revoked = dateOf(key.revokedAt, language);
      const facts = [
        key.scopes?.length ? t(`rättigheter ${key.scopes.join(', ')}`, `permissions ${key.scopes.join(', ')}`) : t('inga rättigheter', 'no permissions'),
        created ? t(`skapad ${created}`, `created ${created}`) : null,
        active ? (used ? t(`senast använd ${used}`, `last used ${used}`) : t('inte använd ännu', 'not used yet')) : revoked ? t(`återkallad ${revoked}`, `revoked ${revoked}`) : null,
      ].filter(Boolean).join(' · ');
      return <Row key={key.id} chip={<Badge tone={active ? 'ok' : 'danger'} dot={active}>{active ? t('aktiv', 'active') : t('återkallad', 'revoked')}</Badge>}
        title={key.name} text={facts} action={<code aria-label={t('Nyckeln är dold', 'The key is hidden')}>ck_live_••••</code>} />;
    })}</Rows>
    <p className="muted mt">{t('Nyckel och hemlighet visas aldrig här. Vill ni rotera en nyckel, återkalla den eller få en ny: ', 'The key and secret are never shown here. To rotate a key, revoke it or get a new one: ')}{contact}.</p>
    {apiKeys.truncated ? <p className="muted">{t('Visar de senaste nycklarna.', 'Showing the most recent keys.')}</p> : null}
  </>;
}

export function PartnerIntegration({ snapshot, copy, language = 'sv' }) {
  const en = language === 'en', t = (sv, english) => en ? english : sv;
  const start = `/game?operator=${encodeURIComponent(snapshot.operator.slug)}`;
  const live = (snapshot.tables ?? []).filter(room => room.state === 'live' || room.status === 'active');
  const help = workspaceSurfacePath('partner', 'help', snapshot.operator.slug);
  const copyStart = () => { try { void navigator.clipboard?.writeText(new URL(start, window.location.href).href); } catch { /* Copying is a convenience only. */ } };
  const apiKeys = snapshot.apiKeys;
  const activeKeys = apiKeys?.status === 'connected' ? (apiKeys.keys ?? []).filter(key => key.status === 'active').length : 0;
  return <Page title={copy.integration} intro={t('Startadressen öppnar lobbyn med era öppna spelbord. Spelare från er sajt startas med er nyckel från Scoutgaming.', 'The start address opens the lobby with your open tables. Players from your site are started with your key from Scoutgaming.')}>
    <div className="grid c2">
      <Card title={t('Startadress', 'Start address')}>
        <KV items={[
          [t('Adress', 'Address'), <code key="start">{start}</code>],
          [t('Öppna spelbord', 'Open tables'), live.length ? live.length === 1 ? t('1 spelbord', '1 table') : t(`${live.length} spelbord`, `${live.length} tables`) : t('inga öppna spelbord', 'no open tables')],
        ]} />
        <div className="actions mt"><Btn href={start} target="_blank" rel="noopener">{t('Öppna lobbyn', 'Open the lobby')}<ArrowUpRight size={14} aria-hidden="true" /></Btn><Btn tone="ghost" onClick={copyStart}><Copy size={14} aria-hidden="true" />{t('Kopiera', 'Copy')}</Btn></div>
      </Card>
      {apiKeys ? <Card title={t('API-nycklar', 'API keys')} icon={<KeyRound size={15} />}
        aside={apiKeys.status === 'connected' ? <Badge tone={activeKeys ? 'ok' : 'warn'}>{activeKeys === 1 ? t('1 aktiv', '1 active') : t(`${activeKeys} aktiva`, `${activeKeys} active`)}</Badge> : <Badge tone="warn">{t('hos Scoutgaming', 'with Scoutgaming')}</Badge>}>
        <KeyList apiKeys={apiKeys} help={help} copy={copy} t={t} language={language} />
      </Card> : <Card title={t('Nyckel', 'Key')} icon={<KeyRound size={15} />} aside={<Badge tone="warn">{t('hos Scoutgaming', 'with Scoutgaming')}</Badge>}>
        <p className="muted">{t('Er nyckel hanteras av Scoutgaming och visas inte här. Behöver ni en ny eller vill rotera den: ', 'Your key is managed by Scoutgaming and is not shown here. To get a new one or rotate it: ')}<a href={help} className="link-quiet">{copy.help}</a>.</p>
      </Card>}
    </div>
  </Page>;
}
