import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { identity, route, mergeNotes, pendingResult, acknowledge, formatMessage, checkRemote, apiClient, normalizeNote, recordSent, envelope, acquireLock, checkShared, validateReply, OUTPUT_LIMIT, main } from '../tools/croupier-inbox.mjs';

const jakob = identity('Jakob', 'Granska ändringar', 'chat-a');
const otherJakob = identity('Jakob', 'OpenClaw', 'chat-b');
const kevin = identity('Kevin', 'Media', 'chat-c');
const emil = identity('Emil', 'Video', 'chat-d');
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
  assert.equal(pendingResult(s).notes.length, 5);
  assert.equal(pendingResult(s).omittedCount, 200);
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

test('Kevin questions never invite Emil; CC grants information but no reply ownership', () => {
  const n = normalizeNote(note(1, formatMessage(jakob, { to: kevin.id, cc: 'Emil', topic: 'media', kind: 'question', body: 'Vilken take?' })));
  assert.equal(route(n, kevin), 'direct');
  assert.equal(route(n, emil), 'info');
  assert.throws(() => validateReply(emil, { parent: n, to: jakob.id, confirmOwner: 'Emil' }), /Not assigned/);
  assert.equal(validateReply(kevin, { parent: n, to: jakob.id }), true);
  assert.throws(() => validateReply(kevin, { parent: n, to: emil.id }), /original sender/);
  const plain = normalizeNote(note(2, '@Kevinnegash1 Kan du granska detta?'));
  assert.equal(route(plain, emil), 'ignore');
  assert.throws(() => validateReply(emil, { parent: plain, to: 'Jakob', confirmOwner: 'Emil' }), /Not assigned/);
  assert.equal(route(normalizeNote(note(3, 'To: Emil\nKan du granska?')), kevin), 'ignore');
});

test('owner-wide question needs explicit local assignment; broadcasts/replies cannot start answer loops', () => {
  const n = normalizeNote(note(1, msg(jakob, 'Kevin', 'Vilken take?', 'question')));
  assert.throws(() => validateReply(kevin, { parent: n, to: jakob.id }), /Not assigned/);
  assert.equal(validateReply(kevin, { parent: n, to: jakob.id, confirmOwner: 'Kevin' }), true);
  assert.throws(() => validateReply(emil, { parent: n, to: jakob.id, confirmOwner: 'Emil' }), /Not assigned/);
  assert.throws(() => formatMessage(jakob, { to: 'all', kind: 'question', body: 'Hej' }), /one responsible/);
  assert.throws(() => formatMessage(jakob, { to: 'Kevin,Emil', kind: 'handoff', body: 'Hej' }), /one responsible/);
  assert.throws(() => validateReply(kevin, { parent: normalizeNote(note(2, msg(jakob, kevin.id))), to: jakob.id }), /No automatic/);
});

test('output is bounded, prioritizes direct questions and keeps full notes on disk', () => {
  const s = state(kevin);
  mergeNotes(s, Array.from({ length: 30 }, (_, i) => note(i + 1, 'x'.repeat(6000))));
  mergeNotes(s, [note(90, msg(jakob, kevin.id, 'Beslut?', 'question'))]);
  const result = pendingResult(s);
  assert.equal(result.notes[0].id, '90');
  assert.equal(result.notes[0].mayReply, true);
  assert.ok(JSON.stringify(result).length <= OUTPUT_LIMIT);
  assert.ok(result.notes.length <= 5);
  assert.equal(result.pendingCount, 31);
  assert.equal(result.omittedCount, 31 - result.notes.length);
  assert.equal(s.pending[1].body.length, 6000);
  assert.ok(JSON.stringify(pendingResult(state(kevin))).length < 250);
});

test('normalized notes keep their version through JSON cache round trips', () => {
  const n = normalizeNote(note(1));
  assert.deepEqual(normalizeNote(JSON.parse(JSON.stringify(n))), n);
  const s = state(kevin);
  mergeNotes(s, [note(1, 'Nyare', '2026-09-21T10:00:00Z')]);
  acknowledge(s, '1', s.pending[1].version, 'delivered');
  mergeNotes(s, [n]);
  assert.equal(pendingResult(s).pendingCount, 0);
});

test('shared cache skips duplicate fetches, keeps per-agent acknowledgements, expires and supports force', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'croupier-cache-test-'));
  const a = state(kevin), b = state(emil), n = note(1, msg(jakob, 'all'));
  let calls = 0;
  const request = async () => { calls++; return { data: [n], nextPage: '' }; };
  const options = { directory, credentialKey: 'test', request };
  try {
    assert.equal((await checkShared(a, options)).source, 'api');
    assert.equal(calls, 2);
    acknowledge(a, '1', a.pending[1].version, 'delivered');
    assert.equal((await checkShared(b, options)).source, 'shared_cache');
    assert.equal(calls, 2); assert.equal(pendingResult(b).pendingCount, 1);
    await checkShared(a, options); assert.equal(pendingResult(a).pendingCount, 0);
    await checkShared(b, { ...options, force: true }); assert.equal(calls, 3);
    await checkShared(b, { ...options, now: Date.now() + 31_000 }); assert.equal(calls, 4);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('simultaneous agents do not duplicate a cold fetch or claim a busy check succeeded', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'croupier-cache-test-'));
  let ready, release;
  const entered = new Promise(resolve => { ready = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const a = state(kevin), b = state(emil);
  const options = { directory, credentialKey: 'test', request: async () => { ready(); await gate; return { data: [], nextPage: '' }; } };
  const first = checkShared(a, options);
  try {
    await entered;
    assert.equal((await checkShared(b, options)).source, 'busy');
    assert.equal(b.lastCheckedAt, undefined);
    release(); await first;
    assert.equal((await checkShared(b, options)).source, 'shared_cache');
  } finally { release(); await first; await rm(directory, { recursive: true, force: true }); }
});

test('failed refresh preserves shared file and private cursor; credential caches are separate', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'croupier-cache-test-'));
  const a = state(kevin), options = { directory, credentialKey: 'one', request: async () => ({ data: [note(1)], nextPage: '' }) };
  try {
    await checkShared(a, options);
    const before = await readFile(path.join(directory, 'remote-one.json'), 'utf8');
    const old = structuredClone(a);
    await assert.rejects(checkShared(a, { ...options, force: true, request: async () => { throw new Error('offline'); } }));
    assert.deepEqual(a, old);
    assert.equal(await readFile(path.join(directory, 'remote-one.json'), 'utf8'), before);
    assert.equal((await checkShared(state(emil), { ...options, credentialKey: 'two' })).source, 'api');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('CLI draft/send guard rejects wrong agent and edited parent before any POST; confirmed retries do not repost', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'croupier-cli-test-'));
  const oldLog = console.log, outputs = [];
  console.log = value => outputs.push(JSON.parse(value));
  let parent = note(55, msg(jakob, kevin.id, 'Vilken take?', 'question')), posts = 0;
  const bodyFile = path.join(root, 'body.txt'), importFile = path.join(root, 'notes.json');
  const env = { CODEX_THREAD_ID: 'chat-c', GITLAB_TOKEN: 'test-not-a-real-token' };
  const fetchImpl = async (url, options) => {
    if (options.method === 'POST') { posts++; return { ok: true, headers: new Headers(), json: async () => note(56, JSON.parse(options.body).body) }; }
    assert.match(url.pathname, /notes\/55$/);
    return { ok: true, headers: new Headers(), json: async () => parent };
  };
  const run = argv => main(argv, { root, env, fetchImpl });
  try {
    await writeFile(bodyFile, 'Take B.'); await writeFile(importFile, JSON.stringify([parent]));
    await run(['init', '--owner', 'Kevin', '--title', 'Media']);
    await run(['import', '--file', importFile]);
    await assert.rejects(run(['draft', '--to', emil.id, '--kind', 'reply', '--reply-to', '55', '--body-file', bodyFile]), /original sender/);
    await run(['draft', '--to', jakob.id, '--kind', 'reply', '--reply-to', '55', '--body-file', bodyFile]);
    const draftFile = outputs.at(-1).draftFile, original = parent;
    parent = { ...parent, body: parent.body + ' Rättelse.' };
    await assert.rejects(run(['send', '--file', draftFile]), /Parent changed/);
    assert.equal(posts, 0);
    parent = original;
    await run(['send', '--file', draftFile]); await run(['send', '--file', draftFile]);
    assert.equal(posts, 1); assert.equal(outputs.at(-1).status, 'already_sent');
  } finally { console.log = oldLog; await rm(root, { recursive: true, force: true }); }
});
