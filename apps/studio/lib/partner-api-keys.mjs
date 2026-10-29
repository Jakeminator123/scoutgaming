// Partnerportalens Integration: bolagets egna API-nycklar, maskerade (Nyckel→bolag,
// docs/plans/NYCKEL-BOLAG.md). Samma pool och behörighetskedja som snapshoten; bolaget
// kommer alltid från arbetsytans session (partner-data.mjs), aldrig från adressen eller
// en body. Frågan väljer aldrig nyckel, hemlighet, wallet-adress, IP-lista eller skapare:
// partnern ser namn, status, rättigheter och tider. Nycklar skapas, roteras och
// återkallas bara i Admin; portalen hänvisar till Scoutgaming.
//
// Före spelmigrering 012 saknar croupier_auth.api_keys kolumnen operator_id, och då hör
// ingen nyckel till något bolag: läsningen svarar 'pending' utan att läsa tabellen.
// Saknas tabellen, rätten eller poolen svarar den 'not-connected' i stället för att
// fälla sidan.
export const PARTNER_API_KEY_LIMIT = 50;
const COLUMN_SQL = "/* partner-api-keys:column */ SELECT EXISTS (SELECT FROM pg_attribute WHERE attrelid=to_regclass('croupier_auth.api_keys') AND attname='operator_id' AND NOT attisdropped) AS present";
const LIST_SQL = `/* partner-api-keys:list */ SELECT k.id, k.name, k.scopes, (k.wallet_url IS NOT NULL AND k.wallet_url <> '') AS wallet_configured,
    k.created_at, k.last_used, k.revoked_at, k.operator_id
  FROM croupier_auth.api_keys k WHERE k.operator_id = $1 ORDER BY k.revoked_at IS NOT NULL, k.created_at DESC, k.id LIMIT ${PARTNER_API_KEY_LIMIT}`;
const SCOPES = new Set(['launch', 'play', 'wallet', 'history', 'lobby', 'events']);
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;
const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && !CONTROL.test(value) ? value : null;
const notConnected = reason => Object.freeze({ status: 'not-connected', reason, keys: [] });
function scopesOf(value) {
  let list = value;
  if (typeof list === 'string') { try { list = JSON.parse(list); } catch { return []; } }
  return Array.isArray(list) ? [...new Set(list.filter(scope => SCOPES.has(scope)))] : [];
}
function timestamp(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  return text(value, 64);
}

/** The company's own keys, masked; `operatorId` is the session's company. */
export async function readPartnerApiKeys({ query, operatorId } = {}) {
  if (typeof query !== 'function') return notConnected('no-pool');
  if (typeof operatorId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(operatorId)) return notConnected('no-operator');
  try {
    const column = await query(COLUMN_SQL, []);
    if (column?.rows?.[0]?.present !== true) return Object.freeze({ status: 'pending', keys: [] });
    const result = await query(LIST_SQL, [operatorId]);
    if (!Array.isArray(result?.rows)) return notConnected('read-failed');
    const keys = [];
    for (const row of result.rows) {
      // Defense in depth: a row for another company is never shown, even from a wrong query.
      if (row?.operator_id !== operatorId) return notConnected('read-failed');
      const id = text(row.id, 256);
      if (!id) continue;
      keys.push(Object.freeze({ id, operatorId, name: text(row.name, 80) ?? id, status: row.revoked_at ? 'revoked' : 'active',
        scopes: scopesOf(row.scopes), walletConfigured: row.wallet_configured === true,
        createdAt: timestamp(row.created_at), lastUsed: timestamp(row.last_used), revokedAt: row.revoked_at ? timestamp(row.revoked_at) : null }));
    }
    return Object.freeze({ status: 'connected', keys, ...(result.rows.length >= PARTNER_API_KEY_LIMIT ? { truncated: true } : {}) });
  } catch {
    return notConnected('read-failed');
  }
}
