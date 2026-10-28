// Översikt: var bolaget är publicerat, hur det går, vad som väntar, vad bolaget får välja.
import React from 'react';
import { workspaceSurfacePath } from '../../../../../packages/navigation/workspace-surfaces.mjs';
import { compositionLabel } from '../../../../../packages/navigation/control-flow.mjs';
import { Bars, Btn, Card, Chip, KV, Page, Row, Stat, fmtDate, fmtInt, fmtMoney } from './ui.jsx';
import { reportFigures, reportsUnavailableReason } from './report-figures.mjs';

export function PartnerOverview({ snapshot, copy, language = 'sv' }) {
  const en = language === 'en', t = (sv, english) => en ? english : sv;
  const path = view => workspaceSurfacePath('partner', view, snapshot.operator.slug);
  const revision = snapshot.packageRevision ?? snapshot.operator.packageRevision ?? '';
  const tables = snapshot.tables ?? [], live = tables.filter(room => room.state === 'live' || room.status === 'active');
  const figures = reportFigures(snapshot.reports, 7), unavailable = reportsUnavailableReason(snapshot.reports, language);
  const money = value => fmtMoney(value, figures?.currency, language);
  const notConnected = <span className="muted" title={unavailable}>{copy.notConnected}</span>;
  const assignment = snapshot.assignment ?? { games: [], dealers: [], lanes: [], backgrounds: [], tables: [] };
  const names = list => list.length ? list.map(item => item.label ?? item).join(', ') : '—';
  const laneLabel = id => compositionLabel(assignment.lanes.find(lane => lane.id === id)?.label ?? id, language);
  const waiting = [];
  if (snapshot.draft) waiting.push({ key: 'draft', chip: <Chip tone="warn">{t('Utkast', 'Draft')}</Chip>, href: path('rooms'),
    title: t(`Sparat utkast ${snapshot.draft.revision}`, `Saved draft ${snapshot.draft.revision}`),
    text: t(`Granska och publicera under Spelbord. Bygger på version ${snapshot.draft.basePackageRevision}.`, `Review and publish under Tables. Based on version ${snapshot.draft.basePackageRevision}.`) });
  if (snapshot.invitations > 0) waiting.push({ key: 'invitations', chip: <Chip tone="info">{t('Inbjudan', 'Invitation')}</Chip>, href: path('team'),
    title: t(`${snapshot.invitations} inbjudan väntar på svar`, `${snapshot.invitations} invitation(s) waiting`), text: t('Medlemmen aktiverar kontot via mejlet.', 'The member activates the account from the email.') });
  if (revision) waiting.push({ key: 'published', chip: <Chip tone="accent">{t('Publicerad', 'Published')}</Chip>,
    title: t(`Senaste tilldelning: revision ${revision}`, `Latest assignment: revision ${revision}`),
    text: snapshot.publishedAt ? t(`Publicerad av Scoutgaming ${fmtDate(snapshot.publishedAt, language)}.`, `Published by Scoutgaming ${fmtDate(snapshot.publishedAt, language)}.`) : t('Publiceringsdatum saknas i paketet.', 'The package carries no publication date.') });
  return <Page title={copy.overview} intro={revision
    ? t(`${snapshot.operator.name} · tilldelning revision ${revision} från Scoutgaming. Var ni är publicerade, hur det går och vad som väntar.`, `${snapshot.operator.name} · assignment revision ${revision} from Scoutgaming. Where you are published, how it goes and what is waiting.`)
    : t(`${snapshot.operator.name} har ingen publicerad tilldelning ännu. Scoutgaming publicerar bolagets paket först.`, `${snapshot.operator.name} has no published assignment yet. Scoutgaming publishes the company package first.`)}
    actions={<Btn href={path('help')}>{t('Begär material', 'Request material')}</Btn>}>
    <div className="grid c4">
      <Card><Stat value={`${live.length} ${t('av', 'of')} ${tables.length}`} label={t('spelbord öppna i lobbyn', 'tables open in the lobby')} /></Card>
      <Card><Stat value={figures ? fmtInt(figures.rounds, language) : notConnected} label={t('rundor senaste 7 dagarna', 'rounds in the last 7 days')} /></Card>
      <Card><Stat value={figures ? money(figures.staked) : notConnected} label={t('insatser · 7 d', 'stakes · 7 d')} /></Card>
      <Card><Stat value={figures ? money(figures.net) : notConnected} label={t('netto (insatser − utbetalt) · 7 d', 'net (stakes − payouts) · 7 d')} /></Card>
    </div>
    <div className="grid main-aside">
      <div className="stack">
        <Card title={t('Var ni är publicerade', 'Where you are published')} aside={<a href={path('rooms')}>{copy.rooms} →</a>}>
          {tables.length ? <div className="scroll-x"><table className="table">
            <thead><tr><th>{t('Spelbord', 'Table')}</th><th>{t('Läge', 'State')}</th><th>{t('Publicerad', 'Published')}</th><th>{t('Rundor 7 d', 'Rounds 7 d')}</th><th>{t('Lobby', 'Lobby')}</th></tr></thead>
            <tbody>{tables.map(room => {
              const open = room.state === 'live' || room.status === 'active', figure = figures?.rooms.get(room.id);
              const details = [room.dealer?.label, room.settings?.limitPreset, room.settings?.language].filter(Boolean).join(' · ');
              return <tr key={room.id} className="link">
                <td><a href={path('rooms') + '?room=' + encodeURIComponent(room.id)} className="strong">{room.name}</a>{details ? <div className="small muted">{details}</div> : null}</td>
                <td><Chip tone={open ? 'ok' : 'warn'} dot>{open ? t('öppet', 'open') : t('pausat', 'paused')}</Chip></td>
                <td>{revision ? `${t('revision', 'revision')} ${revision}` : '—'}{room.configVersion ? <div className="small muted"><code>{room.configVersion}</code></div> : null}</td>
                <td>{figure ? <Bars values={figure.perDay} label={t(`${figure.rounds} rundor senaste 7 dagarna`, `${figure.rounds} rounds in the last 7 days`)} /> : <span className="faint small">{copy.notConnected}</span>}</td>
                <td>{room.playUrl ? <a className="small" href={room.playUrl} target="_blank" rel="noopener" style={{ textDecoration: 'underline' }}>{room.playUrl}</a> : <span className="faint small">{t('inte i lobbyn', 'not in the lobby')}</span>}</td>
              </tr>;
            })}</tbody>
          </table></div> : <p className="muted">{t('Inga spelbord i tilldelningen ännu. Scoutgaming skapar och publicerar bolagets spelbord.', 'No tables in the assignment yet. Scoutgaming creates and publishes the company tables.')}</p>}
          {!figures ? <p className="small muted mt">{t('Rundor: ', 'Rounds: ')}{copy.notConnected} · {unavailable}</p> : null}
        </Card>
        <Card title={t('Väntar', 'Waiting')}>
          {waiting.length ? <div className="rows">{waiting.map(item => <Row key={item.key} chip={item.chip} title={item.title} text={item.text} href={item.href} />)}</div>
            : <p className="muted">{t('Inget väntar. Utkast, inbjudningar och nya tilldelningar visas här.', 'Nothing is waiting. Drafts, invitations and new assignments appear here.')}</p>}
        </Card>
      </div>
      <div className="stack">
        <Card title={t('Er tilldelning', 'Your assignment')} aside={revision ? <Chip tone="accent">{t('revision', 'revision')} {revision}</Chip> : <Chip>{copy.packageMissing}</Chip>}>
          <KV items={[
            [t('Spel', 'Games'), names(assignment.games)],
            ['Dealers', names(assignment.dealers)],
            [t('Scenmallar', 'Scene templates'), assignment.lanes.length ? assignment.lanes.map(lane => laneLabel(lane.id)).join(', ') : '—'],
            [t('Bakgrunder', 'Backgrounds'), names(assignment.backgrounds)],
            [t('Bordsgrafik', 'Table graphics'), names(assignment.tables)],
            ...(assignment.limitPresets ? [[t('Insatsprofiler', 'Limit presets'), names(assignment.limitPresets)]] : []),
          ]} />
          <p className="small muted mt">{t('Ni väljer inom det här på era spelbord. Vill ni ha mer: ', 'You choose within this on your tables. For more: ')}<a href={path('help')} style={{ textDecoration: 'underline' }}>{t('begär material', 'request material')}</a>.</p>
        </Card>
        <Card title={copy.players}><p className="small muted">{t('Era spelare och deras saldon visas under Spelare när Scoutgaming knutit spelare till bolag (steg F efter O03).', 'Your players and their balances appear under Players once Scoutgaming has linked players to companies (step F after O03).')}</p></Card>
      </div>
    </div>
  </Page>;
}
