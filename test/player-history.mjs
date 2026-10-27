import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerHistoryHandler } from '../services/game/player-history.mjs';
import { readPlayerResults } from '../services/game/storage/async-player-results.mjs';

function memoryDb(rows) {
  return {
    prepare() {
      return {
        async all(playerId) {
          return rows.filter(row => row.player_id === playerId).map(row => ({ ...row }));
        },
      };
    },
  };
}

function handler(rows, players) {
  return createPlayerHistoryHandler({
    db: memoryDb(rows),
    getPlayer: async id => players[id] ?? null,
    readGame: async () => ({ round: null, paid: true }),
    readPlayerResults,
  });
}

const secretId = 'secret-player';
const emptyId = 'empty-player';
const players = {
  [secretId]: { id: secretId, name: 'Ada Secret', currency: 'SEK', balance: 1000 },
  [emptyId]: { id: emptyId, name: 'Bo Secret', currency: 'EUR', balance: 40 },
};

test('history aggregates one currency across a win and a loss without identifiers', async () => {
  const rows = [
    { id: 41, player_id: secretId, type: 'start', amount: -10, currency: 'SEK' },
    { id: 42, player_id: secretId, type: 'collect', amount: 25, currency: 'SEK' },
    { id: 43, player_id: secretId, type: 'start', amount: -6, currency: 'SEK' },
    { id: 90, player_id: 'other-player', type: 'start', amount: -100, currency: 'SEK' },
    { id: 91, player_id: 'other-player', type: 'collect', amount: 1000, currency: 'SEK' },
  ];
  const output = await handler(rows, players)(secretId);
  assert.deepEqual(output, {
    scope: 'saved-demo-profile',
    accounting: 'collected-rounds',
    currencies: [{ currency: 'SEK', rounds: 2, won: 15, lost: 6, net: 9, wagered: 16, returned: 25 }],
    lastRound: { currency: 'SEK', wagered: 6, returned: 0, net: -6, outcome: 'loss' },
    currentRound: null,
  });
  const text = JSON.stringify(output);
  assert.equal(text.includes(secretId), false);
  assert.equal(text.includes('other-player'), false);
  assert.equal(text.includes('native-ledger'), false);
  assert.equal(text.includes('Ada Secret'), false);
  for (const id of [41, 42, 43, 90, 91]) assert.equal(text.includes(String(id)), false);
});

test('empty ledger returns the currency bucket and no last round', async () => {
  const output = await handler([], players)(emptyId);
  assert.deepEqual(output, {
    scope: 'saved-demo-profile',
    accounting: 'collected-rounds',
    currencies: [{ currency: 'EUR', rounds: 0, won: 0, lost: 0, net: 0, wagered: 0, returned: 0 }],
    lastRound: null,
    currentRound: null,
  });
  assert.equal(JSON.stringify(output).includes(emptyId), false);
});
