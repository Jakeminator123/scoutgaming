import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createDealerMemory } from '../server/dealer-memory.mjs';

test('the dealer remembers a visitor across visits, never their personal data', () => {
  const m = createDealerMemory(path.join(mkdtempSync(path.join(tmpdir(), 'mem-')), 'm.sqlite'));
  const kevin = m.key('guest-cookie-1');
  assert.equal(m.recall(kevin, 'dragge').known, false);
  m.remember(kevin, 'dragge', { name: 'Kevin', said: 'hej jugge kung', reply: 'Hej kung!', note: 'calls Dragge "jugge kung"' });
  m.remember(kevin, 'dragge', { name: 'Kevin', said: 'min mail är a@b.se', reply: 'Dela inte sånt.', note: 'email a@b.se' });
  const r = m.recall(kevin, 'dragge');
  assert.ok(r.known);
  assert.match(r.text, /"Kevin"/);
  assert.match(r.text, /jugge kung/);
  assert.doesNotMatch(r.text, /a@b\.se/);
  assert.equal(r.lines.length, 4);
  assert.equal(m.recall(kevin, 'astrid').known, false, 'each dealer has their own memory');
  assert.notEqual(m.key('guest-cookie-2'), kevin);
  m.close();
});
