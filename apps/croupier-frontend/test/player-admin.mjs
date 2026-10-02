import test from 'node:test';
import assert from 'node:assert/strict';
import {playerAdministrationHtml, changePlayerStatus} from '../../../web/public/bo/player-admin.mjs';

const player = {id: 'fixture-player', username: 'demo', name: '<img src=x onerror=alert(1)>', currency: 'USD', balance: 1000, status: 'active', created_at: '2026-10-02'};

test('reader sees escaped demo data without account mutation controls; closed accounts cannot reactivate', () => {
  const html = playerAdministrationHtml([player], 'reader');
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/); assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /data-player=|player-create/); assert.match(html, /Read-only/);
  assert.doesNotMatch(playerAdministrationHtml([player], 'admin', false), /data-player=|player-create/);
  const closed = playerAdministrationHtml([{...player, status: 'closed'}], 'admin');
  assert.match(closed, /CLOSED/); assert.doesNotMatch(closed, /data-player=|REACTIVATE/);
});

test('permanent close requires meaningful confirmation and reason, preserves identity, and propagates server rejection', async () => {
  const calls = [];
  const api = async (...args) => {calls.push(args); return {ok: true};};
  const command = {player, status: 'closed', reason: ' Operator request ', role: 'admin'};
  assert.equal(await changePlayerStatus(command, {api, confirmClose: message => {assert.match(message, /cannot be undone/); assert.match(message, /history and balances remain/); return false;}}), false);
  assert.equal(calls.length, 0);
  await assert.rejects(changePlayerStatus({...command, reason: ' '}, {api, confirmClose: () => true}), /reason/);
  await assert.rejects(changePlayerStatus({...command, role: 'staff'}, {api, confirmClose: () => true}), /ADMIN/);
  await assert.rejects(changePlayerStatus({...command, player: {...player, status: 'closed'}, status: 'active'}, {api, confirmClose: () => true}), /cannot be changed/);
  assert.equal(calls.length, 0);
  assert.equal(await changePlayerStatus(command, {api, confirmClose: () => true}), true);
  assert.deepEqual(calls, [['/api/bo/players/status', {playerId: player.id, status: 'closed', reason: 'Operator request'}]]);
  await assert.rejects(changePlayerStatus(command, {api: async () => ({ok: false, error: 'Collect the ongoing hand first.'}), confirmClose: () => true}), /Collect the ongoing hand/);
});
