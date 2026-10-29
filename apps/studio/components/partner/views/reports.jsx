// Ekonomi: rundor, insatser, utbetalt och netto per spelbord för avslutade rundor,
// i en valuta i taget, med rundor och netto per dag i ett diagram.
import React, { useState } from 'react';
import { Activity, ArrowDownLeft, Coins, TrendingUp } from 'lucide-react';
import { Bars, Card, Chip, Empty, Note, Page, Stat, Tip, TrendChart, fmtInt } from './ui.jsx';
import { CurrencySwitch } from './overview.jsx';
import { amountIn, formatMoney, reportCurrency, reportDays, reportFigures, reportsReady, reportsTruncatedNotice, reportsUnavailableReason } from './report-figures.mjs';

const PRESETS = { casual: 'Casual', prive: 'Privé', high: 'High' };

export function PartnerReports({ snapshot, copy, language = 'sv' }) {
  const en = language === 'en', t = (sv, english) => en ? english : sv;
  const [days, setDays] = useState(7);
  const [chosen, setChosen] = useState(null);
  const reports = snapshot.reports, ready = reportsReady(reports), figures = reportFigures(reports, days);
  const currency = reportCurrency(figures, chosen);
  const money = (figure, key) => formatMoney(amountIn(figure, key, currency), currency, language);
  const staked = amountIn(figures, 'staked', currency), net = amountIn(figures, 'net', currency);
  const share = ready && staked ? ` · ${Math.round((net / staked) * 100)} %` : '';
  const series = ready ? reportDays(reports, days, currency, language) : [];
  const tables = snapshot.tables ?? [];
  const periods = [[7, t('7 dagar', '7 days')], [30, t('30 dagar', '30 days')]];
  return <Page title={copy.reports} intro={t('Hur det går per spelbord: rundor, insatser, utbetalt och netto för avslutade rundor.', 'How each table does: rounds, stakes, payouts and net for settled rounds.')}
    actions={<>{figures ? <CurrencySwitch currencies={figures.currencies} value={currency} onChange={setChosen} label={t('Valuta', 'Currency')} /> : null}
      <div className="seg" role="group" aria-label={t('Period', 'Period')}>{periods.map(([value, label]) => <button key={value} type="button" aria-pressed={days === value ? 'true' : 'false'} onClick={() => setDays(value)}>{label}</button>)}</div></>}>
    {!ready ? <Empty icon={<Activity size={20} />} title={copy.notConnected} text={reportsUnavailableReason(reports, language)} /> : <>
      {figures.truncated ? <Note tone="warn" role="status">{reportsTruncatedNotice(figures, language)}</Note> : null}
      <div className="grid c4 stats">
        <Card><Stat icon={<Activity size={16} />} value={fmtInt(figures.rounds, language)} label={t('rundor', 'rounds')} /></Card>
        <Card><Stat icon={<Coins size={16} />} value={money(figures, 'staked')} label={t('insatser', 'stakes')} /></Card>
        <Card><Stat icon={<ArrowDownLeft size={16} />} value={money(figures, 'returned')} label={t('utbetalt', 'paid out')} /></Card>
        <Card><Stat icon={<TrendingUp size={16} />} value={money(figures, 'net')} label={share ? t(`netto${share} av insatserna`, `net${share} of stakes`) : t('netto', 'net')} /></Card>
      </div>
      <div className="grid wide-2">
        <Card title={t('Rundor och netto per dag', 'Rounds and net per day')}>
          {series.some(day => day.rounds) ? <TrendChart data={series} label={t(`Rundor och netto per dag, ${days} dagar`, `Rounds and net per day, ${days} days`)}
            bars={{ key: 'rounds', label: t('Rundor', 'Rounds') }} line={{ key: 'net', label: t('Netto', 'Net'), format: value => formatMoney(value, currency, language) }} />
            : <p className="muted">{t('Inga avslutade rundor under perioden.', 'No settled rounds in the period.')}</p>}
        </Card>
        <Card title={t('Per spelbord', 'Per table')}>
          {tables.length ? <div className="scroll-x"><table className="table">
            <thead><tr><th>{t('Spelbord', 'Table')}</th><th className="num">{t('Rundor', 'Rounds')}</th><th className="num">{t('Insatser', 'Stakes')}</th><th className="num">{t('Utbetalt', 'Paid out')}</th><th className="num">{t('Netto', 'Net')}</th><th>{t('Per dag', 'Per day')}</th></tr></thead>
            <tbody>{tables.map(room => {
              const figure = figures.rooms.get(room.id), open = room.state === 'live' || room.status === 'active';
              return <tr key={room.id}>
                <td className="name-cell"><Tip content={room.name}><b className="ellipsis">{room.name}</b></Tip><div className="small muted">{[room.settings?.limitPreset ? PRESETS[room.settings.limitPreset] ?? room.settings.limitPreset : null, open ? t('öppet', 'open') : t('pausat', 'paused')].filter(Boolean).join(' · ')}</div></td>
                <td className="num">{figure ? fmtInt(figure.rounds, language) : '—'}</td>
                <td className="num">{figure ? money(figure, 'staked') : '—'}</td>
                <td className="num">{figure ? money(figure, 'returned') : '—'}</td>
                <td className="num strong">{figure ? money(figure, 'net') : '—'}</td>
                <td>{figure ? <Bars values={figure.perDay} label={t(`${figure.rounds} rundor`, `${figure.rounds} rounds`)} /> : <span className="faint small">—</span>}</td>
              </tr>;
            })}</tbody>
          </table></div> : <p className="muted">{t('Inga spelbord ännu.', 'No tables yet.')}</p>}
          <p className="small muted mt">{t('Insats är det spelaren satsat i rundan (dubbling, split, sidoinsats och försäkring ingår); utbetalt är det spelaren fått tillbaka. Demokrediter räknas inte.', 'Stake is what the player wagered in the round (double, split, side bet and insurance included); paid out is what the player got back. Demo credits are not counted.')}</p>
        </Card>
      </div>
      {figures.mixed ? <p className="small muted"><Chip>{currency}</Chip> {t('Perioden har spel i flera valutor; byt valuta överst. Beloppen räknas aldrig ihop.', 'The period has play in several currencies; switch currency at the top. Amounts are never added together.')}</p> : null}
    </>}
  </Page>;
}
