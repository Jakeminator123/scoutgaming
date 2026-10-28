// Läsande utdrag ur spelets tabeller för Partnerportalen: avslutade rundor ur
// croupier_game.shared_table_audit (en wallet.settlement-rad per spelare och
// runda, skriven av services/game coordinator.mjs) och publicerade
// spelinställningar ur shared_table_configs. Samma pool och behörighetskedja
// som snapshoten; avgränsat till bolagets spelbord. Aggregeringen sker i SQL
// (SUM/COUNT per spelbord, dag och valuta) så att inga journalrader tolkas i
// Node; tabellen saknar index på room_id (DDL efter O03), så frågan läser aldrig
// längre tillbaka än REPORT_SEQ_WINDOW rader från huvudet via primärnyckeln och
// resultatet cachas per bolag i minnet. Saknas tabellen, rätten eller poolen
// svarar läsningen "not-connected" i stället för att fälla sidan.
const AUDIT_TABLE = 'croupier_game.shared_table_audit';
const CONFIG_TABLE = 'croupier_game.shared_table_configs';
export const REPORT_WINDOW_DAYS = 30;
export const REPORT_SEQ_WINDOW = 100_000;
const CACHE_TTL_MS = 3 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

const money = value => Math.round(value * 100) / 100;
const dayKey = at => new Date(at).toISOString().slice(0, 10);
const notConnected = reason => Object.freeze({ status: 'not-connected', reason });
const currencyCode = value => typeof value === 'string' && /^[A-Z]{3}$/.test(value) ? value : '';
const amount = value => { const number = Number(value); return Number.isFinite(number) && number >= 0 ? money(number) : null; };
const count = value => { const number = Number(value); return Number.isSafeInteger(number) && number >= 0 ? number : null; };

export function clearPartnerGameReadoutCache() { cache.clear(); }

// Raden tolkas som services/game/storage/async-player-results.mjs: body är JSON
// med type/at/payload, payload är JSON-text med roundId/staked/returned/currency.
// Här görs tolkningen av PostgreSQL. Tidsstämpeln är händelsens `at` (ms, satt av
// coordinatorns klocka i samma transaktion som avräkningen).
const BOUNDS_SQL = `/* partner-game-readout:bounds */ WITH head AS (SELECT COALESCE(MAX(seq), 0) AS seq FROM ${AUDIT_TABLE})
  SELECT GREATEST(head.seq - $1::bigint, 1) AS floor,
    (SELECT CASE WHEN jsonb_typeof(a.body::jsonb->'at') = 'number' THEN (a.body::jsonb->>'at')::numeric END
       FROM ${AUDIT_TABLE} a WHERE a.seq >= GREATEST(head.seq - $1::bigint, 1) ORDER BY a.seq LIMIT 1) AS oldest_at
  FROM head`;
const SETTLEMENTS_SQL = `/* partner-game-readout:settlements */ SELECT s.room_id,
    to_char(to_timestamp((s.at / 1000)::double precision) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
    s.payload->>'currency' AS currency,
    COUNT(DISTINCT s.payload->>'roundId') AS rounds,
    SUM((s.payload->>'staked')::numeric) AS staked,
    SUM((s.payload->>'returned')::numeric) AS returned
  FROM (SELECT a.room_id,
      CASE WHEN jsonb_typeof(a.body::jsonb->'at') = 'number' THEN (a.body::jsonb->>'at')::numeric END AS at,
      (a.body::jsonb->>'payload')::jsonb AS payload
    FROM ${AUDIT_TABLE} a
    WHERE a.seq >= $2 AND a.room_id = ANY($1::text[]) AND a.body::jsonb->>'type' = 'wallet.settlement') s
  WHERE s.at >= $3 AND s.at < $4
    AND jsonb_typeof(s.payload->'roundId') = 'string' AND s.payload->>'roundId' <> ''
    AND jsonb_typeof(s.payload->'staked') = 'number' AND jsonb_typeof(s.payload->'returned') = 'number'
    AND (s.payload->>'staked')::numeric >= 0 AND (s.payload->>'returned')::numeric >= 0
  GROUP BY s.room_id, day, currency
  ORDER BY s.room_id, day, currency`;

function emptyDays(from, to) {
  const days = [];
  for (let day = Math.floor(from / DAY_MS) * DAY_MS; day < to; day += DAY_MS) days.push({ day: dayKey(day), rounds: 0, staked: 0, returned: 0, amounts: {} });
  return days;
}
function addAmount(target, code, staked, returned) {
  const bucket = target.amounts[code] ??= { staked: 0, returned: 0 };
  bucket.staked = money(bucket.staked + staked); bucket.returned = money(bucket.returned + returned);
  target.staked = money(target.staked + staked); target.returned = money(target.returned + returned);
}

// Rader ur SETTLEMENTS_SQL (room_id, day, currency, rounds, staked, returned) till
// rapporten: per spelbord totalt och per dag, belopp per valuta. `staked`/`returned`
// utan valuta är summan över alla valutor och bara meningsfull när en valuta finns;
// `currency` sätts då, annars listar `currencies` dem som förekommer.
export function aggregateReportRows(rows, { roomIds, from, to, truncated = false }) {
  const rooms = new Map(roomIds.map(id => [id, { roomId: id, rounds: 0, staked: 0, returned: 0, net: 0, amounts: {}, days: emptyDays(from, to) }]));
  for (const row of Array.isArray(rows) ? rows : []) {
    const room = rooms.get(row?.room_id), day = room?.days.find(item => item.day === row.day);
    const rounds = count(row?.rounds), staked = amount(row?.staked), returned = amount(row?.returned);
    if (!room || !day || rounds === null || staked === null || returned === null) continue;
    const code = currencyCode(row.currency);
    room.rounds += rounds; day.rounds += rounds;
    addAmount(room, code, staked, returned); addAmount(day, code, staked, returned);
  }
  const currencies = [...new Set([...rooms.values()].flatMap(room => Object.keys(room.amounts)))].sort();
  return {
    status: 'ready', from, to, windowDays: Math.round((to - from) / DAY_MS),
    currency: currencies.length === 1 ? currencies[0] || null : null, currencies, truncated,
    rooms: [...rooms.values()].map(room => ({ ...room, net: money(room.staked - room.returned),
      amounts: Object.fromEntries(Object.entries(room.amounts).map(([code, value]) => [code, { ...value, net: money(value.staked - value.returned) }])) })),
  };
}

async function tableReady(query, table) {
  const result = await query(`/* partner-game-readout:ready */ SELECT to_regclass($1) AS ready`, [table]);
  return Boolean(result?.rows?.[0]?.ready);
}

// Rundor, insatser, utbetalt och netto per spelbord och dag för bolagets rum,
// bara avslutade rundor, senaste REPORT_WINDOW_DAYS dagarna. Läsningen går aldrig
// längre tillbaka än REPORT_SEQ_WINDOW journalrader; når den inte hela perioden
// märks rapporten `truncated`.
export async function readPartnerReports({ query, operatorId, roomIds, now = Date.now(), ttlMs = CACHE_TTL_MS, seqWindow = REPORT_SEQ_WINDOW, windowDays = REPORT_WINDOW_DAYS } = {}) {
  const ids = [...new Set((roomIds ?? []).filter(id => typeof id === 'string' && id))].sort();
  if (typeof query !== 'function') return notConnected('no-pool');
  const key = `${operatorId}:${ids.join(',')}`, cached = cache.get(key);
  if (cached && now - cached.at < ttlMs) return cached.value;
  const to = now, from = now - windowDays * DAY_MS;
  let value;
  try {
    if (!await tableReady(query, AUDIT_TABLE)) value = notConnected('table-missing');
    else if (!ids.length) value = aggregateReportRows([], { roomIds: ids, from, to });
    else {
      const bounds = (await query(BOUNDS_SQL, [seqWindow]))?.rows?.[0];
      const floor = Math.max(1, Math.trunc(Number(bounds?.floor)) || 1);
      const oldest = bounds?.oldest_at == null ? null : Number(bounds.oldest_at);
      const result = await query(SETTLEMENTS_SQL, [ids, floor, from, to]);
      // Fönstret nådde inte hela perioden när dess äldsta rad är yngre än `from`.
      const truncated = floor > 1 && Number.isFinite(oldest) && oldest > from;
      value = aggregateReportRows(result?.rows, { roomIds: ids, from, to, truncated });
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
