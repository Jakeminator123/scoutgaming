// Siffror ur snapshot.reports (apps/studio/lib/partner-game-readout.mjs) för de
// senaste N dagarna. Inga värden hittas på: utan ett "ready"-aggregat finns inga tal.
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
const total = (amounts, key) => round(Object.values(amounts).reduce((sum, value) => sum + value[key], 0));

// Per spelbord och totalt för de sista `days` dagarna i fönstret (dagarna är
// kronologiska i aggregatet; den sista är i dag). Belopp summeras per valuta;
// `currency` finns bara när en enda valuta förekommer, annars är `mixed` satt.
export function reportFigures(reports, days = 7) {
  if (!reportsReady(reports)) return null;
  const fallback = reports.currency ?? '';
  const amountsOf = day => day.amounts ?? { [fallback]: { staked: day.staked, returned: day.returned } };
  const rooms = reports.rooms.map(room => {
    const window = room.days.slice(-days), amounts = {};
    for (const day of window) addAmounts(amounts, amountsOf(day));
    const staked = total(amounts, 'staked'), returned = total(amounts, 'returned');
    return { roomId: room.roomId, rounds: window.reduce((sum, day) => sum + day.rounds, 0), staked, returned, net: round(staked - returned), amounts, perDay: window.map(day => day.rounds) };
  });
  const amounts = {};
  for (const room of rooms) addAmounts(amounts, room.amounts);
  const currencies = Object.keys(amounts).sort();
  return { days, currency: currencies.length === 1 ? currencies[0] || null : null, currencies, mixed: currencies.length > 1, truncated: reports.truncated === true,
    seqWindow: Number.isSafeInteger(reports.seqWindow) ? reports.seqWindow : null,
    rounds: rooms.reduce((sum, room) => sum + room.rounds, 0), staked: total(amounts, 'staked'), returned: total(amounts, 'returned'), net: total(amounts, 'net'),
    amounts, rooms: new Map(rooms.map(room => [room.roomId, room])) };
}

// Ett belopp per valuta som text: "600 USD" eller "600 USD · 20 EUR". Utan
// belopp (inga rundor) visas 0 i rapportens valuta när den är känd, annars 0.
export function amountText(amounts, key, language = 'sv', currency = null) {
  const format = value => new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'sv-SE', { maximumFractionDigits: 0 }).format(value);
  const entries = Object.entries(amounts ?? {}).sort(([left], [right]) => left.localeCompare(right));
  if (!entries.length) return currency ? `${format(0)} ${currency}` : format(0);
  return entries.map(([code, value]) => code ? `${format(value[key])} ${code}` : format(value[key])).join(' · ');
}

// Varningen när läsfönstret inte nådde hela perioden. Journalen delas av alla
// bolag, så "de senaste N raderna" nämns bara när det faktiskt avkortats.
export function reportsTruncatedNotice(figures, language = 'sv') {
  if (!figures?.truncated) return null;
  const en = language === 'en', rows = figures.seqWindow ? new Intl.NumberFormat(en ? 'en-GB' : 'sv-SE').format(figures.seqWindow) : null;
  if (!rows) return en ? 'The journal is longer than the read window; the oldest rounds in the period may be missing.' : 'Journalen är längre än läsfönstret; de äldsta rundorna i perioden kan saknas.';
  return en ? `The figures are based on the latest ${rows} journal rows (shared by every company), so the oldest rounds in the period may be missing.`
    : `Siffrorna bygger på de senaste ${rows} journalraderna (journalen delas av alla bolag), så de äldsta rundorna i perioden kan saknas.`;
}

// Varför det inte finns siffror, med användarens ord.
export function reportsUnavailableReason(reports, language = 'sv') {
  const en = language === 'en';
  if (!reports) return en ? 'Shown to roles with reports.read.' : 'Visas för roller med behörigheten reports.read.';
  if (reports.reason === 'table-missing') return en ? 'The game journal is not installed in this environment.' : 'Spelets journal finns inte i den här miljön.';
  if (reports.reason === 'no-pool') return en ? 'No game database is connected to the portal here.' : 'Ingen speldatabas är ansluten till portalen här.';
  return en ? 'The game journal could not be read right now.' : 'Spelets journal kunde inte läsas just nu.';
}
