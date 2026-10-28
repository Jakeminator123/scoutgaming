// Läsande utdrag ur spelets tabeller för Partnerportalen: avslutade rundor ur
// croupier_game.shared_table_audit (en wallet.settlement-rad per spelare och
// runda, skriven av services/game coordinator.mjs) och publicerade
// spelinställningar ur shared_table_configs. Samma pool och behörighetskedja
// som snapshoten; avgränsat till bolagets spelbord. Ingen tabell har index på
// room_id, så aggregatet cachas per bolag i minnet. Saknas tabellen, rätten
// eller poolen svarar läsningen "not-connected" i stället för att fälla sidan.
const AUDIT_TABLE = 'croupier_game.shared_table_audit';
const CONFIG_TABLE = 'croupier_game.shared_table_configs';
export const REPORT_WINDOW_DAYS = 30;
export const REPORT_ROW_LIMIT = 20000;
const CACHE_TTL_MS = 3 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

const money = value => Math.round(value * 100) / 100;
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const dayKey = at => new Date(at).toISOString().slice(0, 10);
const notConnected = reason => Object.freeze({ status: 'not-connected', reason });

export function clearPartnerGameReadoutCache() { cache.clear(); }

// En settlement-rad tolkas som services/game/storage/async-player-results.mjs:
// body är JSON med type/payload, payload är JSON-text med staked/returned/settledAt.
export function parseSettlement(row) {
  let event, payload;
  try {
    event = typeof row.body === 'string' ? JSON.parse(row.body) : row.body;
    payload = typeof event?.payload === 'string' ? JSON.parse(event.payload) : event?.payload;
  } catch { return null; }
  if (event?.type !== 'wallet.settlement' || !payload || typeof payload !== 'object') return null;
  const { roundId, staked, returned, settledAt } = payload;
  if (typeof roundId !== 'string' || !roundId || !finite(staked) || !finite(returned)) return null;
  const at = typeof settledAt === 'number' ? settledAt : typeof event.at === 'number' ? event.at : Date.parse(event.at ?? settledAt ?? '');
  if (!Number.isFinite(at)) return null;
  const currency = typeof payload.currency === 'string' && /^[A-Z]{3}$/.test(payload.currency) ? payload.currency : null;
  return { roomId: event.room ?? row.room_id, roundId, staked: money(staked), returned: money(returned), at, currency };
}

function emptyDays(from, to) {
  const days = [];
  for (let day = Math.floor(from / DAY_MS) * DAY_MS; day < to; day += DAY_MS) days.push({ day: dayKey(day), rounds: 0, staked: 0, returned: 0 });
  return days;
}

export function aggregateSettlements(rows, { roomIds, from, to, truncated = false }) {
  const rooms = new Map(roomIds.map(id => [id, { roomId: id, rounds: 0, staked: 0, returned: 0, net: 0, days: emptyDays(from, to), seen: new Map() }]));
  let currency = null;
  for (const row of rows) {
    const settlement = parseSettlement(row);
    if (!settlement || settlement.at < from || settlement.at >= to || !rooms.has(settlement.roomId)) continue;
    const room = rooms.get(settlement.roomId), day = room.days.find(item => item.day === dayKey(settlement.at));
    currency ??= settlement.currency;
    room.staked = money(room.staked + settlement.staked); room.returned = money(room.returned + settlement.returned);
    if (day) { day.staked = money(day.staked + settlement.staked); day.returned = money(day.returned + settlement.returned); }
    if (!room.seen.has(settlement.roundId)) { room.seen.set(settlement.roundId, true); room.rounds += 1; if (day) day.rounds += 1; }
  }
  return {
    status: 'ready', from, to, windowDays: Math.round((to - from) / DAY_MS), currency, truncated,
    rooms: [...rooms.values()].map(({ seen, ...room }) => ({ ...room, net: money(room.staked - room.returned) })),
  };
}

async function tableReady(query, table) {
  const result = await query(`/* partner-game-readout:ready */ SELECT to_regclass($1) AS ready`, [table]);
  return Boolean(result?.rows?.[0]?.ready);
}

// Rundor, insatser, utbetalt och netto per spelbord och dag för bolagets rum,
// bara avslutade rundor, senaste REPORT_WINDOW_DAYS dagarna, högst
// REPORT_ROW_LIMIT settlement-rader (nyaste först).
export async function readPartnerReports({ query, operatorId, roomIds, now = Date.now(), ttlMs = CACHE_TTL_MS, limit = REPORT_ROW_LIMIT, windowDays = REPORT_WINDOW_DAYS } = {}) {
  const ids = [...new Set((roomIds ?? []).filter(id => typeof id === 'string' && id))].sort();
  if (typeof query !== 'function') return notConnected('no-pool');
  const key = `${operatorId}:${ids.join(',')}`, cached = cache.get(key);
  if (cached && now - cached.at < ttlMs) return cached.value;
  const to = now, from = now - windowDays * DAY_MS;
  let value;
  try {
    if (!await tableReady(query, AUDIT_TABLE)) value = notConnected('table-missing');
    else if (!ids.length) value = aggregateSettlements([], { roomIds: ids, from, to });
    else {
      const result = await query(`/* partner-game-readout:settlements */ SELECT a.seq, a.room_id, a.body FROM ${AUDIT_TABLE} a
        WHERE a.room_id = ANY($1::text[]) AND a.body::jsonb->>'type'='wallet.settlement' ORDER BY a.seq DESC LIMIT $2`, [ids, limit]);
      const rows = Array.isArray(result?.rows) ? result.rows : [];
      value = aggregateSettlements(rows, { roomIds: ids, from, to, truncated: rows.length >= limit });
    }
  } catch { value = notConnected('read-failed'); }
  cache.set(key, { at: now, value });
  return value;
}

// Publicerade spelinställningar (språk, insatsprofil) per spelbord, lästa ur
// den version paketet binder (branding.roomGameConfigVersions). Saknas
// bindning eller tabell saknas raden; inget hittas på.
export async function readPublishedRoomSettings({ query, operatorId, rooms } = {}) {
  const bound = (rooms ?? []).filter(room => typeof room?.id === 'string' && typeof room.configVersion === 'string');
  const settings = new Map();
  if (typeof query !== 'function' || !bound.length) return settings;
  try {
    if (!await tableReady(query, CONFIG_TABLE)) return settings;
    const result = await query(`/* partner-game-readout:settings */ SELECT room_id, version, body FROM ${CONFIG_TABLE} WHERE room_id = ANY($1::text[])`, [bound.map(room => room.id)]);
    for (const row of result?.rows ?? []) {
      const room = bound.find(item => item.id === row.room_id && item.configVersion === row.version);
      if (!room) continue;
      let value; try { value = typeof row.body === 'string' ? JSON.parse(row.body) : row.body; } catch { continue; }
      if (value?.operatorId !== operatorId || value.roomId !== room.id || !['en', 'sv'].includes(value.language) || typeof value.limitPreset !== 'string') continue;
      settings.set(room.id, { language: value.language, limitPreset: value.limitPreset, packageRevision: value.packageRevision ?? null });
    }
  } catch { return new Map(); }
  return settings;
}
