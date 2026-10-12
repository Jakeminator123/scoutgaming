import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createStudioActivity, sidOf } from '../server/studio-activity.mjs';

test('a sign-in is followed by its sid, rounds are credited to it, and chat text is never stored (Kevin 12 Oct)', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'act-')), tableDb = path.join(dir, 'demo.sqlite');
  const t = new DatabaseSync(tableDb);
  t.exec(`CREATE TABLE shared_players (room TEXT, token TEXT, id TEXT, name TEXT, balance REAL, seen REAL, last_return REAL);
          CREATE TABLE shared_settlements (room TEXT, round_id TEXT, player_id TEXT, receipt TEXT);`);
  t.prepare('INSERT INTO shared_players VALUES (?,?,?,?,?,?,?)').run('tbl-a', 'g'.repeat(64), 'p1', 'Guest 1', 1000, 0, null);
  t.prepare('INSERT INTO shared_players VALUES (?,?,?,?,?,?,?)').run('tbl-a', 'h'.repeat(64), 'p2', 'Guest 2', 1000, 0, null);
  t.prepare('INSERT INTO shared_settlements VALUES (?,?,?,?)').run('tbl-a', 'r1', 'p1', JSON.stringify({ settledAt: Date.now() + 60000, staked: 10, net: 10 }));
  t.prepare('INSERT INTO shared_settlements VALUES (?,?,?,?)').run('tbl-a', 'r1', 'p2', JSON.stringify({ settledAt: Date.now() + 60000, staked: 50, net: -50 }));
  t.close();
  const sid = sidOf({ cookie: 'astrid_guest=x; bo_jwt=aaa.bbb.ccc' });
  assert.match(sid, /^[0-9a-f]{16}$/);
  assert.equal(sidOf({ cookie: 'astrid_guest=x' }), null);
  const a = createStudioActivity(path.join(dir, 'act.sqlite'), tableDb);
  a.log({ user: 'TestPlayer@Scout.com', sid, ip: '1.2.3.4', ua: 'Safari', kind: 'table.opened', table: 'tbl-a', guest: 'g'.repeat(64) });
  a.log({ user: 'testplayer@scout.com', sid, kind: 'chat', table: 'tbl-a', detail: { len: 12 } });
  const { events } = a.list({ user: 'TESTPLAYER@scout.com' });
  assert.deepEqual(events.map(e => e.kind), ['table.opened', 'chat', 'round']);
  const round = events.find(e => e.kind === 'round');
  assert.deepEqual(round.detail, { bet: 10, net: 10, result: 'win' });   // only Guest 1, whose cookie this sign-in used
  assert.equal(round.sid, sid);
  assert.equal(readFileSync(path.join(dir, 'act.sqlite')).includes('aaa.bbb.ccc'), false);   // never the token
});
