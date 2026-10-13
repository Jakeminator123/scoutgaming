export const JOURNAL_LIMIT = 100;
const unavailable = () => { throw Error('Journalen kunde inte läsas. Försök igen.'); };
const titles = { open: 'Öppningssaldo', start: 'Insats · Blackjack', collect: 'Utbetalning · Blackjack',
  roulette_bet: 'Insats · Roulette', roulette_payout: 'Utbetalning · Roulette' };
export function journalType(type) { return Object.hasOwn(titles,type) ? titles[type] : 'Övriga händelser'; }

// The existing endpoint returns the latest 100 rows, not an accounting period.
// Keep currencies separate and never infer GGR or revenue from this sample.
export function readEconomyJournal(payload) {
  if (!payload || !Array.isArray(payload.tx) || payload.tx.length > JOURNAL_LIMIT) unavailable();
  return payload.tx.map((row, index) => {
    if (!row || typeof row.at !== 'string' || row.at.length > 40 || !Number.isFinite(Date.parse(row.at))
      || typeof row.currency !== 'string' || !/^[A-Z]{3}$/.test(row.currency)
      || typeof row.type !== 'string' || !row.type || row.type.length > 100
      || typeof row.player_id !== 'string' || row.player_id.length > 254
      || !['number','string'].includes(typeof row.amount)
      || typeof row.amount === 'string' && !/^-?\d+(?:\.\d+)?$/.test(row.amount)) unavailable();
    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || Math.abs(amount) > Number.MAX_SAFE_INTEGER / (100 * JOURNAL_LIMIT)) unavailable();
    return { key: String(index), at: new Date(row.at).toISOString(), playerId: row.player_id,
      type: row.type, currency: row.currency, amount };
  });
}

export function summarizeEconomyJournal(journal, {currency, days = 0, now = Date.now()} = {}) {
  if (![0,7,30].includes(days) || !Number.isFinite(now)) unavailable();
  const currencies = [...new Set(journal.map(row => row.currency))].sort();
  const selected = currencies.includes(currency) ? currency : journal[0]?.currency ?? null;
  const today = Date.parse(new Date(now).toISOString().slice(0,10) + 'T00:00:00Z');
  const cutoff = days ? today - (days - 1) * 86_400_000 : -Infinity;
  const rows = journal.filter(row => row.currency === selected && Date.parse(row.at) >= cutoff);
  const byDay = new Map(), byType = new Map();
  let credit = 0, debit = 0;
  for (const row of rows) {
    const day = row.at.slice(0,10), point = byDay.get(day) ?? {day, credit:0, debit:0, count:0};
    if (row.amount >= 0) {credit += row.amount; point.credit += row.amount;}
    else {debit -= row.amount; point.debit -= row.amount;}
    point.count += 1; byDay.set(day,point);
    const type = journalType(row.type); byType.set(type,(byType.get(type) ?? 0) + 1);
  }
  const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
  const dates = journal.map(row => row.at).sort();
  return {currencies,currency:selected,rows,count:rows.length,credit:round(credit),debit:round(debit),net:round(credit-debit),
    daily:[...byDay.values()].sort((a,b)=>a.day.localeCompare(b.day)).map(row=>({...row,credit:round(row.credit),debit:round(row.debit)})),
    types:[...byType].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count),
    sourceCount:journal.length,sourceFrom:dates[0] ?? null,sourceTo:dates.at(-1) ?? null};
}
