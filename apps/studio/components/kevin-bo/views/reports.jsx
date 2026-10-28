// Ekonomi: rundor, insatser, utbetalt och netto per spelbord ur spelets journal
// (avslutade rundor), publiceringar ur paketen. Per spelare och avräkning är steg F.
import React, { useState } from 'react';
import { Bars, Card, Chip, Empty, KV, Note, Page, Stat, fmtDate, fmtInt } from './ui.jsx';
import { amountText, reportFigures, reportsReady, reportsUnavailableReason } from './report-figures.mjs';

export function PartnerReports({ snapshot, copy, language = 'sv' }) {
  const en = language === 'en', t = (sv, english) => en ? english : sv;
  const [days, setDays] = useState(7);
  const reports = snapshot.reports, ready = reportsReady(reports), figures = reportFigures(reports, days);
  // Belopp per valuta: en valuta ger "600 USD", flera ger "600 USD · 20 EUR" (aldrig en hopräknad summa).
  const money = (figure, key) => amountText(figure?.amounts, key, language, figures?.currency);
  const tables = snapshot.tables ?? [], publications = snapshot.publications ?? [];
  const periods = [[7, t('7 dagar', '7 days')], [30, t('30 dagar', '30 days')]];
  const share = ready && !figures.mixed && figures.staked ? ` · ${Math.round((figures.net / figures.staked) * 100)} %` : '';
  return <Page title={copy.reports} intro={t('Hur det går per spelbord: rundor, insatser, utbetalt och netto. Siffrorna kommer ur spelets journal för era spelbord och räknar bara avslutade rundor.', 'How each table does: rounds, stakes, payouts and net. The figures come from the game journal for your tables and count settled rounds only.')}
    actions={<div className="seg" role="group" aria-label={t('Period', 'Period')}>{periods.map(([value, label]) => <button key={value} type="button" aria-pressed={days === value ? 'true' : 'false'} onClick={() => setDays(value)}>{label}</button>)}</div>}>
    {!ready ? <Note tone="warn" role="status"><b>{copy.notConnected}.</b> {reportsUnavailableReason(reports, language)}</Note> : null}
    {ready && figures.truncated ? <Note tone="warn">{t('Journalen är längre än läsfönstret; de äldsta rundorna i perioden kan saknas.', 'The journal is longer than the read window; the oldest rounds in the period may be missing.')}</Note> : null}
    {ready && figures.mixed ? <Note tone="warn" role="status">{t(`Flera valutor i perioden (${figures.currencies.filter(Boolean).join(', ')}): beloppen visas per valuta och räknas inte ihop.`, `Several currencies in the period (${figures.currencies.filter(Boolean).join(', ')}): amounts are shown per currency and never added together.`)}</Note> : null}
    <div className="grid c4">
      <Card><Stat value={ready ? fmtInt(figures.rounds, language) : '—'} label={t('rundor', 'rounds')} /></Card>
      <Card><Stat value={ready ? money(figures, 'staked') : '—'} label={t('insatser', 'stakes')} /></Card>
      <Card><Stat value={ready ? money(figures, 'returned') : '—'} label={t('utbetalt', 'paid out')} /></Card>
      <Card><Stat value={ready ? money(figures, 'net') : '—'} label={share ? t(`netto${share} av insatserna`, `net${share} of stakes`) : t('netto', 'net')} /></Card>
    </div>
    <div className="grid main-aside">
      <div className="stack">
        <Card title={t('Per spelbord', 'Per table')} aside={ready ? <Chip tone="ok">{t('ur spelets journal', 'from the game journal')}</Chip> : <Chip tone="warn">{copy.notConnected}</Chip>}>
          {tables.length ? <div className="scroll-x"><table className="table">
            <thead><tr><th>{t('Spelbord', 'Table')}</th><th className="num">{t('Rundor', 'Rounds')}</th><th className="num">{t('Insatser', 'Stakes')}</th><th className="num">{t('Utbetalt', 'Paid out')}</th><th className="num">{t('Netto', 'Net')}</th><th>{t('Per dag', 'Per day')}</th></tr></thead>
            <tbody>{tables.map(room => {
              const figure = figures?.rooms.get(room.id), open = room.state === 'live' || room.status === 'active';
              return <tr key={room.id}>
                <td><b>{room.name}</b><div className="small muted">{[room.settings?.limitPreset, open ? t('öppet', 'open') : t('pausat', 'paused')].filter(Boolean).join(' · ')}</div></td>
                <td className="num">{figure ? fmtInt(figure.rounds, language) : '—'}</td>
                <td className="num">{figure ? money(figure, 'staked') : '—'}</td>
                <td className="num">{figure ? money(figure, 'returned') : '—'}</td>
                <td className="num strong">{figure ? money(figure, 'net') : '—'}</td>
                <td>{figure ? <Bars values={figure.perDay} label={t(`${figure.rounds} rundor`, `${figure.rounds} rounds`)} /> : <span className="faint small">{copy.notConnected}</span>}</td>
              </tr>;
            })}</tbody>
          </table></div> : <p className="muted">{t('Inga spelbord i tilldelningen ännu.', 'No tables in the assignment yet.')}</p>}
          <p className="small muted mt">{t('Insats = det spelaren satsat i rundan (inklusive dubbling, split, sidoinsats och försäkring), utbetalt = det spelaren fått tillbaka, en rad per spelare och avslutad runda. Demo-påfyllningar räknas inte.', 'Stake = what the player wagered in the round (including double, split, side bet and insurance), paid out = what the player got back, one row per player and settled round. Demo refills are not counted.')}</p>
        </Card>
        <Card title={t('Publiceringar', 'Publications')} aside={t('ur paketen', 'from the packages')}>
          {publications.length ? <table className="table"><thead><tr><th>{t('Version', 'Version')}</th><th>{t('Publicerad', 'Published')}</th></tr></thead>
            <tbody>{publications.map(row => <tr key={row.revision}><td><b>{t('revision', 'revision')} {row.revision}</b>{String(row.revision) === String(snapshot.packageRevision) ? <span className="small muted"> · {t('publicerad nu', 'currently published')}</span> : null}</td><td>{fmtDate(row.publishedAt, language)}</td></tr>)}</tbody></table>
            : <p className="muted">{t('Inga publiceringar ännu.', 'No publications yet.')}</p>}
          <p className="small muted mt">{t('Vem som publicerade står i journalen under Team (administratör).', 'Who published is in the journal under Team (administrator).')}</p>
        </Card>
      </div>
      <div className="stack">
        <Card title={t('Per spelare', 'Per player')} aside={<Chip tone="warn">{t('steg F', 'step F')}</Chip>}>
          <Note tone="warn">{t('Insatser och vinster per spelare, spelarantal och nya spelare visas när spelare knutits till bolag (steg F efter O03).', 'Stakes and wins per player, player counts and new players appear once players are linked to companies (step F after O03).')}</Note>
        </Card>
        <Card title={t('Avräkning', 'Settlement')} aside={<Chip tone="warn">{copy.notConnected}</Chip>}>
          <KV items={[[t('Modell', 'Model'), t('ingen avtalad', 'none agreed')], [t('Valuta', 'Currency'), figures?.currency ?? (figures?.mixed ? t('flera valutor', 'several currencies') : t('spelets', 'the game\'s'))], [t('Rapport', 'Report'), t('inte ansluten', 'not connected')]]} />
          <p className="small muted mt">{t('Intäktsdelning och avräkning kräver data som inte finns i dag. Visas som planerat, inte som låtsas.', 'Revenue share and settlement need data that does not exist today. Shown as planned, never as make-believe.')}</p>
        </Card>
        {!ready ? <Empty chip={copy.notConnected} title={t('Inga siffror att visa', 'No figures to show')} text={reportsUnavailableReason(reports, language)} /> : null}
      </div>
    </div>
  </Page>;
}
