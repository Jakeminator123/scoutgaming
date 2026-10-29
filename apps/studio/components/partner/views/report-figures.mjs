// Siffror ur snapshot.reports (apps/studio/lib/partner-game-readout.mjs) för de
// senaste N dagarna. Inga värden hittas på: utan ett "ready"-aggregat finns inga tal.
// Belopp visas alltid i en valuta i taget; flera valutor räknas aldrig ihop.
const round = value => Math.round(value * 100) / 100;

export function reportsReady(reports) {
  return reports?.status === 'ready' && Array.isArray(reports.rooms);
}

function addAmounts(target, source) {
  for (const [code, value] of Object.entries(source ?? {})) {
    const bucket = target[code] ??= { staked: 0, returned: 0, net: 0 };
    bucket.staked = round(bucket.staked + value.staked); bucket.returned = round(bucket.returned + value.returned);
    bucket.net = round(bucket.staked - bucket.returned);
  }
}
const amountsOf = (reports, day) => day.amounts ?? { [reports.currency ?? '']: { staked: day.staked, returned: day.returned } };
// Störst insats först, så att standardvalutan är den bolaget mest spelar i.
const byStake = amounts => Object.keys(amounts).sort((left, right) => (amounts[right].staked - amounts[left].staked) || left.localeCompare(right));

// Per spelbord och totalt för de sista `days` dagarna i fönstret (dagarna är
// kronologiska i aggregatet; den sista är i dag). Belopp summeras per valuta.
export function reportFigures(reports, days = 7) {
  if (!reportsReady(reports)) return null;
  const rooms = reports.rooms.map(room => {
    const window = room.days.slice(-days), amounts = {};
    for (const day of window) addAmounts(amounts, amountsOf(reports, day));
    return { roomId: room.roomId, rounds: window.reduce((sum, day) => sum + day.rounds, 0), amounts, perDay: window.map(day => day.rounds) };
  });
  const amounts = {};
  for (const room of rooms) addAmounts(amounts, room.amounts);
  const currencies = byStake(amounts).filter(Boolean);
  return { days, currencies, mixed: currencies.length > 1, truncated: reports.truncated === true,
    rounds: rooms.reduce((sum, room) => sum + room.rounds, 0), amounts, rooms: new Map(rooms.map(room => [room.roomId, room])) };
}

// Den valda valutan om den finns i perioden, annars den största.
export function reportCurrency(figures, chosen) {
  if (!figures) return null;
  return figures.currencies.includes(chosen) ? chosen : figures.currencies[0] ?? (Object.keys(figures.amounts)[0] || null);
}
// Ett belopp i en valuta (0 när perioden saknar rundor i valutan).
export function amountIn(figure, key, currency) {
  const bucket = figure?.amounts?.[currency ?? ''] ?? (currency === null ? Object.values(figure?.amounts ?? {})[0] : null);
  return bucket ? bucket[key] : 0;
}
export function formatMoney(value, currency, language = 'sv') {
  const text = new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'sv-SE', { maximumFractionDigits: 0 }).format(value);
  return currency ? `${text} ${currency}` : text;
}

// Rundor och netto per dag för diagrammet, i den valda valutan.
export function reportDays(reports, days = 7, currency = null, language = 'sv') {
  if (!reportsReady(reports)) return [];
  const width = Math.max(0, ...reports.rooms.map(room => room.days.length)), take = Math.min(days, width);
  const rows = Array.from({ length: take }, () => ({ day: '', rounds: 0, net: 0 }));
  for (const room of reports.rooms) {
    const window = room.days.slice(-take), offset = take - window.length;
    window.forEach((day, index) => {
      const row = rows[offset + index], bucket = amountsOf(reports, day)[currency ?? ''] ?? (currency === null ? Object.values(amountsOf(reports, day))[0] : null);
      row.day = day.day; row.rounds += day.rounds;
      if (bucket) row.net = round(row.net + bucket.staked - bucket.returned);
    });
  }
  const format = new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'sv-SE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return rows.map(row => ({ ...row, label: row.day ? format.format(new Date(row.day + 'T12:00:00Z')) : '' }));
}

// När läsningen inte räckte hela perioden. Inget om hur journalen lagras.
export function reportsTruncatedNotice(figures, language = 'sv') {
  if (!figures?.truncated) return null;
  return language === 'en' ? 'The period is longer than what could be read now; the oldest rounds may be missing.'
    : 'Perioden är längre än vad som kunde läsas nu; de äldsta rundorna kan saknas.';
}

// Varför det inte finns siffror, med användarens ord.
export function reportsUnavailableReason(reports, language = 'sv') {
  const en = language === 'en';
  if (!reports) return en ? 'Shown to roles that may see finance.' : 'Visas för roller som får se ekonomi.';
  return en ? 'Figures for rounds and stakes are not available here yet.' : 'Siffror för rundor och insatser finns inte här ännu.';
}
