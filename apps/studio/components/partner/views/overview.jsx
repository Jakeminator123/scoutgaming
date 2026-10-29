// Översikt: var bolaget är publicerat, hur det går, vad som väntar och vad bolaget får
// välja. Bara det som finns: siffror i en valuta i taget, inga platshållarkort.
import React, { useState } from 'react';
import { ArrowUpRight, Coins, Inbox, Spade, TrendingUp, Activity } from 'lucide-react';
import { workspaceSurfacePath } from '../../../../../packages/navigation/workspace-surfaces.mjs';
import { displayLabel } from '../../partner-preview-media.mjs';
import { Bars, Btn, Card, Chip, KV, Page, Row, Stat, Tip, TrendChart, fmtDate, fmtInt } from './ui.jsx';
import { amountIn, formatMoney, reportCurrency, reportDays, reportFigures, reportsTruncatedNotice } from './report-figures.mjs';

const PRESETS = { casual: 'Casual', prive: 'Privé', high: 'High' };
const GAMES = { blackjack: 'Blackjack', roulette: 'Roulette' };

export function CurrencySwitch({ currencies, value, onChange, label }) {
  if (currencies.length < 2) return null;
  return <div className="seg" role="group" aria-label={label}>{currencies.map(code => <button key={code} type="button" aria-pressed={value === code ? 'true' : 'false'} onClick={() => onChange(code)}>{code}</button>)}</div>;
}

export function PartnerOverview({ snapshot, copy, language = 'sv' }) {
  const en = language === 'en', t = (sv, english) => en ? english : sv;
  const path = view => workspaceSurfacePath('partner', view, snapshot.operator.slug);
  const revision = snapshot.packageRevision ?? snapshot.operator.packageRevision ?? '';
  const permissions = snapshot.permissions ?? [];
  // Snapshoten bär bara det rollen får läsa: utan tables.read finns inga spelbord
  // att räkna, utan presentations.read ingen tilldelning att visa.
  const canTables = permissions.includes('tables.read'), canPresentations = permissions.includes('presentations.read');
  const tables = snapshot.tables ?? [], live = tables.filter(room => room.state === 'live' || room.status === 'active');
  const figures = reportFigures(snapshot.reports, 7);
  const [chosen, setChosen] = useState(null);
  const currency = reportCurrency(figures, chosen);
  const money = key => formatMoney(amountIn(figures, key, currency), currency, language);
  const days = figures ? reportDays(snapshot.reports, 7, currency, language) : [];
  const assignment = snapshot.assignment ?? { games: [], dealers: [], lanes: [], backgrounds: [], tables: [] };
  const names = (list, word = item => displayLabel(item.label ?? item)) => list.length ? list.map(word).join(', ') : '—';
  const waiting = [];
  if (snapshot.draft) waiting.push({ key: 'draft', chip: <Chip tone="warn">{t('Utkast', 'Draft')}</Chip>, href: path('rooms'),
    title: t('Ett sparat utkast väntar', 'A saved draft is waiting'), text: t('Granska och publicera under Spelbord.', 'Review and publish under Tables.') });
  if (snapshot.invitations > 0) waiting.push({ key: 'invitations', chip: <Chip tone="info">{t('Inbjudan', 'Invitation')}</Chip>, href: path('team'),
    title: snapshot.invitations === 1 ? t('1 inbjudan väntar på svar', '1 invitation is waiting') : t(`${snapshot.invitations} inbjudningar väntar på svar`, `${snapshot.invitations} invitations are waiting`), text: t('Medlemmen aktiverar kontot via mejlet.', 'The member activates the account from the email.') });
  if (revision) waiting.push({ key: 'published', chip: <Chip tone="accent">{t('Publicerad', 'Published')}</Chip>,
    title: t(`Senaste tilldelning: version ${revision}`, `Latest assignment: version ${revision}`),
    text: snapshot.publishedAt ? t(`Publicerad av Scoutgaming ${fmtDate(snapshot.publishedAt, language)}.`, `Published by Scoutgaming ${fmtDate(snapshot.publishedAt, language)}.`) : null });
  const stats = [];
  if (canTables) stats.push(<Card key="open"><Stat icon={<Spade size={16} />} value={`${live.length} ${t('av', 'of')} ${tables.length}`} label={t('spelbord öppna i lobbyn', 'tables open in the lobby')} /></Card>);
  if (figures) stats.push(<Card key="rounds"><Stat icon={<Activity size={16} />} value={fmtInt(figures.rounds, language)} label={t('rundor senaste 7 dagarna', 'rounds in the last 7 days')} /></Card>,
    <Card key="staked"><Stat icon={<Coins size={16} />} value={money('staked')} label={t('insatser · 7 d', 'stakes · 7 d')} /></Card>,
    <Card key="net"><Stat icon={<TrendingUp size={16} />} value={money('net')} label={t('netto · 7 d', 'net · 7 d')} /></Card>);
  return <Page title={copy.overview} intro={revision ? t('Var ni är publicerade, hur det går och vad som väntar.', 'Where you are published, how it goes and what is waiting.')
    : t('Ingen tilldelning är publicerad ännu. Scoutgaming publicerar era spelbord först.', 'No assignment is published yet. Scoutgaming publishes your tables first.')}
    actions={<>{figures ? <CurrencySwitch currencies={figures.currencies} value={currency} onChange={setChosen} label={t('Valuta', 'Currency')} /> : null}<Btn href={path('help')}>{t('Begär material', 'Request material')}</Btn></>}>
    {stats.length ? <div className={`grid c${Math.min(4, stats.length)} stats`}>{stats}</div> : null}
    {figures?.truncated ? <div className="note warn" role="status">{reportsTruncatedNotice(figures, language)}</div> : null}
    <div className="grid main-aside">
      <div className="stack">
        {canTables ? <Card title={t('Var ni är publicerade', 'Where you are published')} aside={<a href={path('rooms')} className="link-quiet">{copy.rooms} →</a>}>
          {tables.length ? <div className="scroll-x"><table className="table">
            <thead><tr><th>{t('Spelbord', 'Table')}</th><th>{t('Läge', 'State')}</th><th>{t('Publicerad', 'Published')}</th>{figures ? <th>{t('Rundor 7 d', 'Rounds 7 d')}</th> : null}<th>{t('Lobby', 'Lobby')}</th></tr></thead>
            <tbody>{tables.map(room => {
              const open = room.state === 'live' || room.status === 'active', figure = figures?.rooms.get(room.id);
              const details = [displayLabel(room.dealer?.label ?? ''), room.settings?.limitPreset ? PRESETS[room.settings.limitPreset] ?? room.settings.limitPreset : null, room.settings?.language === 'sv' ? t('svenska', 'Swedish') : room.settings?.language === 'en' ? t('engelska', 'English') : null].filter(Boolean).join(' · ');
              return <tr key={room.id} className="link">
                <td className="name-cell"><Tip content={room.name}><a href={path('rooms') + '?room=' + encodeURIComponent(room.id)} className="strong ellipsis">{room.name}</a></Tip>{details ? <div className="small muted ellipsis">{details}</div> : null}</td>
                <td><Chip tone={open ? 'ok' : 'warn'} dot>{open ? t('öppet', 'open') : t('pausat', 'paused')}</Chip></td>
                <td>{revision ? <Tip content={room.configVersion ? t(`Spelinställningar: ${room.configVersion}`, `Game settings: ${room.configVersion}`) : null}><span>{t('version', 'version')} {revision}</span></Tip> : '—'}</td>
                {figures ? <td>{figure ? <Bars values={figure.perDay} label={t(`${figure.rounds} rundor senaste 7 dagarna`, `${figure.rounds} rounds in the last 7 days`)} /> : <span className="faint small">—</span>}</td> : null}
                <td>{room.playUrl ? <Tip content={room.playUrl}><a className="link-quiet" href={room.playUrl} target="_blank" rel="noopener">{t('Öppna', 'Open')}<ArrowUpRight size={13} aria-hidden="true" /></a></Tip> : <span className="faint small">{t('inte i lobbyn', 'not in the lobby')}</span>}</td>
              </tr>;
            })}</tbody>
          </table></div> : <p className="muted">{t('Inga spelbord ännu. Scoutgaming skapar och publicerar bolagets spelbord.', 'No tables yet. Scoutgaming creates and publishes the company tables.')}</p>}
        </Card> : null}
        {figures && days.some(day => day.rounds) ? <Card title={t('Rundor och netto per dag', 'Rounds and net per day')} aside={<a href={path('reports')} className="link-quiet">{copy.reports} →</a>}>
          <TrendChart data={days} height={200} label={t('Rundor och netto per dag senaste 7 dagarna', 'Rounds and net per day, last 7 days')}
            bars={{ key: 'rounds', label: t('Rundor', 'Rounds') }} line={{ key: 'net', label: t('Netto', 'Net'), format: value => formatMoney(value, currency, language) }} />
        </Card> : null}
      </div>
      <div className="stack">
        <Card title={t('Väntar', 'Waiting')} icon={<Inbox size={15} />}>
          {waiting.length ? <div className="rows">{waiting.map(item => <Row key={item.key} chip={item.chip} title={item.title} text={item.text} href={item.href} />)}</div>
            : <p className="muted">{t('Inget väntar just nu.', 'Nothing is waiting right now.')}</p>}
        </Card>
        {canPresentations ? <Card title={t('Er tilldelning', 'Your assignment')} aside={revision ? <Chip tone="accent">{t('version', 'version')} {revision}</Chip> : null}>
          <KV items={[
            [t('Spel', 'Games'), names(assignment.games, game => GAMES[game] ?? game)],
            ['Dealers', names(assignment.dealers)],
            [t('Bakgrunder', 'Backgrounds'), names(assignment.backgrounds)],
            [t('Bordsgrafik', 'Table graphics'), names(assignment.tables)],
            ...(assignment.limitPresets?.length ? [[t('Insatsprofiler', 'Limit presets'), names(assignment.limitPresets, preset => PRESETS[preset] ?? preset)]] : []),
          ]} />
          <p className="small muted mt">{t('Ni väljer inom det här på era spelbord. Vill ni ha mer: ', 'You choose within this on your tables. For more: ')}<a href={path('help')} className="link-quiet">{t('begär material', 'request material')}</a>.</p>
        </Card> : null}
      </div>
    </div>
  </Page>;
}
