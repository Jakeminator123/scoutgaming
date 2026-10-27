import {createStatementDb, duplicateKey} from './statement-db.mjs';

// Postgres-shaped players, api_keys and partner_players rows for the async
// partner API. Nested work joins the outer transaction like the production store.
export function createPartnerDb() {
  const tables = {players: [], api_keys: [], partner_players: []};
  const forUpdate = 'SELECT id,name,currency,balance,status FROM players WHERE id=? FOR UPDATE';
  const statements = {
    'INSERT INTO api_keys (id,name,key,secret,scopes,wallet_url,ip_allow,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)': (id, name, key, secret, scopes, wallet_url, ip_allow, created_by, created_at) => {
      if (tables.api_keys.some(row => row.id === id || row.key === key)) duplicateKey();
      tables.api_keys.push({id, name, key, secret, scopes, wallet_url, ip_allow, created_by, created_at, last_used: null, revoked_at: null});
      return {changes: 1};
    },
    'SELECT * FROM api_keys WHERE id=? AND revoked_at IS NULL': id => tables.api_keys.filter(row => row.id === id && row.revoked_at === null),
    'SELECT * FROM api_keys WHERE key=? AND revoked_at IS NULL': key => tables.api_keys.filter(row => row.key === key && row.revoked_at === null),
    'SELECT secret,revoked_at FROM api_keys WHERE id=?': id => tables.api_keys.filter(row => row.id === id).map(({secret, revoked_at}) => ({secret, revoked_at})),
    'UPDATE api_keys SET last_used=? WHERE id=?': (at, id) => {
      const hit = tables.api_keys.filter(row => row.id === id);
      for (const row of hit) row.last_used = at;
      return {changes: hit.length};
    },
    'SELECT player_id FROM partner_players WHERE key_id=? AND partner_player=?': (keyId, partnerPlayer) => tables.partner_players
      .filter(row => row.key_id === keyId && row.partner_player === partnerPlayer).map(({player_id}) => ({player_id})),
    'INSERT INTO partner_players VALUES (?,?,?)': (key_id, partner_player, player_id) => {
      if (tables.partner_players.some(row => row.key_id === key_id && row.partner_player === partner_player)) duplicateKey();
      tables.partner_players.push({key_id, partner_player, player_id});
      return {changes: 1};
    },
    [forUpdate]: id => tables.players.filter(row => row.id === id).map(({id, name, currency, balance, status}) => ({id, name, currency, balance, status})),
    'SELECT * FROM players WHERE id=?': id => tables.players.filter(row => row.id === id),
    'INSERT INTO players (id,name,currency,balance,created_at) VALUES (?,?,?,?,?)': (id, name, currency, balance, created_at) => {
      if (tables.players.some(row => row.id === id)) duplicateKey();
      tables.players.push({id, name, currency, balance, created_at, status: 'active'});
      return {changes: 1};
    },
  };
  return createStatementDb({tables, statements, transactional: [forUpdate], nested: 'join'});
}
