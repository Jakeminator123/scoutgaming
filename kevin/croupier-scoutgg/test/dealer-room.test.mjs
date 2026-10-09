import test from 'node:test';
import assert from 'node:assert/strict';
import { dealerRoom } from '../public/dealers.js';

// CH: a player who went from Dragge to Astrid stayed in the boxes at Dragge's table. Each dealer now
// has his own public table, so switching dealer is switching table; Astrid keeps the original room.
test('every dealer has his own public table, Astrid keeps the original room', () => {
  assert.equal(dealerRoom('astrid'), 'astrid');
  assert.equal(dealerRoom('dragge'), 'dragge');
  assert.equal(dealerRoom('paow'), 'paow');
  assert.notEqual(dealerRoom('dragge'), dealerRoom('astrid'));
});
