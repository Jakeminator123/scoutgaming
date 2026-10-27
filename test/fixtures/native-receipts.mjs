import assert from 'node:assert/strict';

// Per-player committed presentation receipts ({version, payload}) keyed by player id.
// Answers only the query the presentation API issues against native_presentations;
// the caller keeps the Map and may change a receipt between requests.
export function nativeReceipts(rows) {
  return {
    prepare: sql => {
      assert.match(sql, /^SELECT version, payload FROM native_presentations WHERE player_id=\?$/);
      return {get: async playerId => rows.has(playerId) ? {...rows.get(playerId)} : undefined};
    },
  };
}
