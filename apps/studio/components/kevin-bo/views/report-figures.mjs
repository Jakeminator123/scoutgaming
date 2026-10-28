// Siffror ur snapshot.reports (apps/studio/lib/partner-game-readout.mjs) för de
// senaste N dagarna. Inga värden hittas på: utan ett "ready"-aggregat finns inga tal.
const round = value => Math.round(value * 100) / 100;

export function reportsReady(reports) {
  return reports?.status === 'ready' && Array.isArray(reports.rooms);
}

// Per spelbord och totalt för de sista `days` dagarna i fönstret (dagarna är
// kronologiska i aggregatet; den sista är i dag).
export function reportFigures(reports, days = 7) {
  if (!reportsReady(reports)) return null;
  const rooms = reports.rooms.map(room => {
    const window = room.days.slice(-days);
    const sum = key => round(window.reduce((total, day) => total + day[key], 0));
    const staked = sum('staked'), returned = sum('returned');
    return { roomId: room.roomId, rounds: window.reduce((total, day) => total + day.rounds, 0), staked, returned, net: round(staked - returned), perDay: window.map(day => day.rounds) };
  });
  const total = key => round(rooms.reduce((sum, room) => sum + room[key], 0));
  return { days, currency: reports.currency ?? null, truncated: reports.truncated === true,
    rounds: rooms.reduce((sum, room) => sum + room.rounds, 0), staked: total('staked'), returned: total('returned'), net: total('net'),
    rooms: new Map(rooms.map(room => [room.roomId, room])) };
}

// Varför det inte finns siffror, med användarens ord.
export function reportsUnavailableReason(reports, language = 'sv') {
  const en = language === 'en';
  if (!reports) return en ? 'Shown to roles with reports.read.' : 'Visas för roller med behörigheten reports.read.';
  if (reports.reason === 'table-missing') return en ? 'The game journal (shared_table_audit) is not installed in this environment.' : 'Spelets journal (shared_table_audit) finns inte i den här miljön.';
  if (reports.reason === 'no-pool') return en ? 'No game database is connected to the portal here.' : 'Ingen speldatabas är ansluten till portalen här.';
  return en ? 'The game journal could not be read right now.' : 'Spelets journal kunde inte läsas just nu.';
}
