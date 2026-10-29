import test from 'node:test';
import assert from 'node:assert/strict';
import { createPartnerJournalClient, readPartnerJournal } from '../components/partner-journal-loader.mjs';
const entry = { id: 'event-1', atMs: 1700000000000, actor: '42', accessClass: 'internal-admin', action: 'team.role', resourceType: 'membership', resourceId: '44', beforeRevision: 1, afterRevision: 2, requestId: 'request-1' };
const page = { operatorId: 'north', entries: [entry], nextCursor: null };
test('journal rejects other operators, malformed pages and unsafe revision metadata', () => {
  assert.deepEqual(readPartnerJournal(page, 'north'), page);
  assert.equal(readPartnerJournal(page, 'south'), null);
  for (const bad of [{ ...page, nextCursor: 12 }, { ...page, entries: [{ ...entry, afterRevision: -1 }] }, { ...page, entries: [{ ...entry, actor: {} }] }, { ...page, entries: Array(101).fill(entry) }]) assert.equal(readPartnerJournal(bad, 'north'), null);
  assert.equal(readPartnerJournal({ ...page, entries: [{ ...entry, privateToken: 'not-for-the-view' }] }, 'north').entries[0].privateToken, undefined);
});
test('journal pagination is encoded, uncached and scoped; failed or mismatched responses expose no entries', async () => {
  const calls = [];
  let response = new Response(JSON.stringify(page));
  const client = createPartnerJournalClient({ base: '/studio/api/partner', operatorSlug: 'north', operatorId: 'north', fetcher: async (url, init) => { calls.push({ url, init }); return response; } });
  assert.deepEqual((await client.read('cursor+value')).journal, page);
  assert.equal(calls[0].url, '/studio/api/partner/journal?operator=north&limit=25&cursor=cursor%2Bvalue');
  assert.equal(calls[0].init.credentials, 'same-origin'); assert.equal(calls[0].init.cache, 'no-store');
  response = new Response(JSON.stringify(page), { status: 403 }); assert.equal((await client.read()).journal, null);
  response = new Response(JSON.stringify({ ...page, operatorId: 'south' })); assert.equal((await client.read()).journal, null);
});
// Spelbordets Historik: GET /journal?kind=publications (reports.read) bär bara id, tid och revisioner.
test('publication history reads the narrow form with kind=publications and keeps only id, time and revisions', async () => {
  const publication = { id: 'event-2', atMs: 1700000000000, beforeRevision: 6, afterRevision: 7 };
  const narrow = { operatorId: 'north', entries: [publication], nextCursor: null };
  assert.deepEqual(readPartnerJournal(narrow, 'north', 'publications'), narrow);
  assert.equal(readPartnerJournal(narrow, 'north'), null, 'the full journal form still requires actor and action');
  assert.equal(readPartnerJournal(narrow, 'south', 'publications'), null);
  assert.equal(readPartnerJournal(narrow, 'north', 'team'), null);
  for (const bad of [{ ...publication, id: 7 }, { ...publication, atMs: -1 }, { ...publication, afterRevision: 0 }]) assert.equal(readPartnerJournal({ ...narrow, entries: [bad] }, 'north', 'publications'), null);
  assert.deepEqual(Object.keys(readPartnerJournal({ ...narrow, entries: [{ ...publication, actor: '42', changes: {} }] }, 'north', 'publications').entries[0]).sort(), ['afterRevision', 'atMs', 'beforeRevision', 'id']);
  const calls = [];
  const client = createPartnerJournalClient({ base: '/studio/api/partner', operatorSlug: 'north', operatorId: 'north', kind: 'publications', fetcher: async url => { calls.push(url); return new Response(JSON.stringify(narrow)); } });
  assert.deepEqual((await client.read('next')).journal, narrow);
  assert.equal(calls[0], '/studio/api/partner/journal?operator=north&limit=25&kind=publications&cursor=next');
});
