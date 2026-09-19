import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { identity, route, mergeNotes, pendingResult, acknowledge, formatMessage, checkRemote, apiClient, normalizeNote, recordSent, envelope, acquireLock } from '../tools/croupier-inbox.mjs';

const jakob = identity('Jakob', 'Granska ändringar', 'chat-a');
const otherJakob = identity('Jakob', 'OpenClaw', 'chat-b');
const kevin = identity('Kevin', 'Media', 'chat-c');
const state = agent => ({ agent, pending: {}, seen: {}, sent: {} });
const note = (id, body = 'Har vi ett svar?', updated_at = '2026-09-20T10:00:00Z') => ({ id, body, updated_at, author: { username: 'Jakeminator123' } });
const msg = (from, to, body = 'Aktuell status', kind = 'info') => formatMessage(from, { to, body, kind });

test('identity is stable across renames and distinct across chats', () => {
  assert.equal(identity('Jakob', 'Nytt namn', 'chat-a').id, jakob.id);
  assert.notEqual(jakob.id, otherJakob.id);
  assert.equal(jakob.name, 'Agent-granska-andringar, Jakob');
  assert.throws(() => identity('unknown', 'Test', 'x'));
});

test('routing distinguishes agents sharing one GitLab account and routes human notes for review', () => {
  assert.equal(route(normalizeNote(note(1, msg(otherJakob, jakob.id))), jakob), 'direct');
  assert.equal(route(normalizeNote(note(2, msg(jakob, 'Kevin'))), jakob), 'review');
  assert.equal(route(normalizeNote(note(3, msg(kevin, otherJakob.id))), jakob), 'ignore');
  assert.equal(route(normalizeNote(note(4, msg(kevin, 'Jakob'))), jakob), 'review');
  assert.equal(route(normalizeNote(note(5, 'Kevin: Jag godkänner orden.')) , jakob), 'review');
  assert.equal(route(normalizeNote(note(6, `Exempel:\n\n${msg(kevin, 'Emil')}`)), jakob), 'review');
  assert.equal(route(normalizeNote(note(7, msg(kevin, 'all', 'Här finns jag', 'register'))), jakob), 'review');
});

test('one chat acknowledging a note cannot consume it for another chat', () => {
  const a = state(jakob), b = state(otherJakob);
  const n = note(1, msg(kevin, 'Jakob'));
  mergeNotes(a, [n]); mergeNotes(b, [n]);
  acknowledge(a, '1', a.pending['1'].version, 'delivered');
  assert.equal(pendingResult(a).pendingCount, 0);
  assert.equal(pendingResult(b).pendingCount, 1);
});

test('checks leave relevant messages pending until explicit delivery or irrelevance', () => {
  const s = state(jakob), n = note(1, msg(kevin, jakob.id));
  mergeNotes(s, [n]); mergeNotes(s, [n]);
  assert.equal(pendingResult(s).pendingCount, 1);
  const oldVersion = s.pending['1'].version;
  acknowledge(s, '1', oldVersion, 'delivered');
  mergeNotes(s, [n]); assert.equal(pendingResult(s).pendingCount, 0);
  mergeNotes(s, [note(1, msg(kevin, jakob.id, 'Rättelse'), '2026-09-20T10:01:00Z')]);
  assert.equal(pendingResult(s).pendingCount, 1);
  assert.throws(() => acknowledge(s, '1', oldVersion, 'delivered'));
});

test('read-only warm path uses one request, no writes and preserves pending', async () => {
  const s = state(jakob); mergeNotes(s, [note(1)]); s.etag = 'old';
  let calls = 0;
  await checkRemote(s, async (query, options) => {
    calls++; assert.equal(query.per_page, '1');
    assert.equal(options.headers['If-None-Match'], 'old');
    assert.equal(options.method, undefined); return { unchanged: true };
  });
  assert.equal(calls, 1); assert.equal(pendingResult(s).pendingCount, 1);
});

test('same latest version without ETag is also one request', async () => {
  const s = state(jakob), n = note(1); s.headSignature = normalizeNote(n).version;
  let calls = 0;
  await checkRemote(s, async () => { calls++; return { data: [n] }; });
  assert.equal(calls, 1);
});

test('pagination retrieves over eight and over one hundred new notes, including timestamp ties', async () => {
  const s = state(jakob); s.watermark = '2026-09-20T09:00:00.000Z';
  const notes = Array.from({ length: 205 }, (_, i) => note(i + 1));
  const queries = [];
  await checkRemote(s, async q => {
    queries.push(q);
    if (q.per_page === '1') return { data: [notes[0]], etag: 'new' };
    const offset = (Number(q.page) - 1) * 100;
    return { data: notes.slice(offset, offset + 100), nextPage: offset < 200 ? String(Number(q.page) + 1) : '' };
  });
  assert.equal(Object.keys(s.pending).length, 205);
  assert.equal(queries.length, 4);
  assert.equal(pendingResult(s).notes.length, 10);
});

test('pagination failure cannot advance the cursor or lose unread notes', async () => {
  const s = state(jakob); mergeNotes(s, [note(1)]); s.watermark = '2026-09-19T00:00:00.000Z';
  const before = structuredClone(s);
  await assert.rejects(checkRemote(s, async q => {
    if (q.per_page === '1') return { data: [note(2)] };
    if (q.page === '1') return { data: [note(2)], nextPage: '2' };
    throw new Error('timeout');
  }));
  assert.deepEqual(s, before);
});

test('old note edits are detected and cannot be hidden by a greater numeric note ID', async () => {
  const s = state(jakob); s.watermark = '2026-09-20T10:00:00.000Z';
  mergeNotes(s, [note(100)]); acknowledge(s, '100', s.pending['100'].version, 'irrelevant');
  const changed = note(2, 'Uppdaterat svar', '2026-09-20T10:05:00Z');
  await checkRemote(s, async q => ({ data: q.per_page === '1' ? [changed] : [changed, note(100)], nextPage: '' }));
  assert.equal(s.pending['2'].body, 'Uppdaterat svar');
});

test('message format requires routing, explicit reply linkage, and blocks quick actions', () => {
  assert.throws(() => formatMessage(jakob, { to: 'Kevin', kind: 'reply', body: 'Svar' }));
  assert.throws(() => formatMessage(jakob, { to: 'Kevin\nTo: all', body: 'Test' }));
  assert.throws(() => formatMessage(jakob, { to: 'Kevin', body: '/close' }));
  const reply = formatMessage(jakob, { to: kevin.id, kind: 'reply', replyTo: '123', body: 'Min slutsats.' });
  assert.match(reply, /Reply-To: 123/); assert.match(reply, /Agent-ID: jakob\//);
  assert.doesNotMatch(reply, /@Kevinnegash1/);
  assert.doesNotMatch(msg(jakob, 'Emil', 'Fråga', 'question'), /@/);
});

test('transport errors do not expose credentials and refuse redirects', async () => {
  const request = apiClient('secret-value', async (_url, options) => {
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer secret-value');
    return { status: 403, ok: false };
  });
  await assert.rejects(request(), error => error.message.includes('403') && !error.message.includes('secret-value'));
});

test('a copied self identity cannot suppress a note; only confirmed own message IDs are ignored', () => {
  const body = msg(jakob, 'Kevin');
  const meta = envelope(body);
  const n = normalizeNote(note(44, body));
  assert.equal(route(n, jakob), 'review');
  assert.equal(route(n, jakob, { [meta['message-id']]: { id: '44' } }), 'ignore');
  assert.equal(route(normalizeNote(note(45, body)), jakob, { [meta['message-id']]: { id: '44' } }), 'review');
});

test('uncertain and browser sends can be reconciled only against the exact saved draft', () => {
  const s = state(jakob), body = msg(jakob, 'Kevin');
  const id = envelope(body)['message-id'];
  s.drafts = { [id]: createHash('sha256').update(body).digest('hex') };
  s.sending = { messageId: id };
  assert.throws(() => recordSent(s, note(44, body + 'Ändring')));
  recordSent(s, note(44, body));
  assert.equal(s.sent[id].id, '44'); assert.equal(s.registrationNote, '44');
  assert.equal(s.sending, undefined);
});

test('an active process lock prevents concurrent access and can be released', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'croupier-inbox-test-'));
  const file = path.join(dir, 'chat.lock');
  try {
    const handle = await acquireLock(file);
    await assert.rejects(acquireLock(file), /busy/);
    await handle.close(); await unlink(file);
    const next = await acquireLock(file); await next.close(); await unlink(file);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('unknown lock ownership cannot be silently stolen', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'croupier-inbox-test-'));
  const file = path.join(dir, 'chat.lock');
  try { await writeFile(file, '{}'); await assert.rejects(acquireLock(file), /ownership unknown/); }
  finally { await rm(dir, { recursive: true, force: true }); }
});
