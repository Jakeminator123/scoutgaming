import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { handleSharedRoomHttp } from '../services/game/shared-room-http.mjs';
import { createSharedRoomChat, sharedRoomChatRound } from '../services/game/shared-room-chat.mjs';
import { projectOpenClawGameStatus } from '../services/game/openclaw-chat.mjs';

const origin = 'https://player.example.test', cookie = 'croupier_session=alice';
const snapshot = (over = {}) => ({ contract: 'blackjack-table/1', roomId: 'room-a', version: 9, presentationVer: 3, configVersion: 'config-a',
  windowId: 'window-a', phase: 'decisions', roundId: 'shared-room-a-round-4', owners: ['player-a', null, 'player-b', null, null, null, null],
  round: { phase: 'decisions', holeDraw: 5, active: 0,
    hands: [{ box: 0, stake: 10, cards: [{ r: '9', s: '♣', shoeDraw: 1 }, { r: '7', s: '♦', shoeDraw: 3 }] }],
    // A defective upstream projection must still never forward the hole card (shoeDraw 5).
    dealer: [{ r: 'K', s: '♠', shoeDraw: 2 }, { r: 'Q', s: '♥', shoeDraw: 5 }], legalActions: ['hit', 'stand'] },
  me: { id: 'player-a', seats: [0], active: true, available: 100 }, ...over });
const binding = { actorId: 'player-a', sessionId: 'player-' + 'f'.repeat(64), operatorId: 'operator-a', roomId: 'room-a', packageRevision: 2, expiresAt: Date.now() + 60000 };

async function fixture(t, { settings = { speechUrl: 'https://director.invalid', speechToken: 'token' }, read = () => snapshot(), decide, now } = {}) {
  const emitted = [], decided = [], contexts = [], members = [];
  let engineOrigin, clock = 1000;
  // chatMember is the unlocked admission read; chatContext stands for the locked read (room lock,
  // the player's FOR UPDATE row and the audit advisory lock), counted in contexts.
  const service = {
    async chatMember(request, { roomId }) {
      members.push(roomId);
      if (request.headers.get('cookie') !== cookie) throw Object.assign(Error('private'), { statusCode: 401 });
      return { binding, snapshot: read('member', members.length) };
    },
    async chatContext(request, { roomId }) {
      contexts.push(roomId);
      if (request.headers.get('cookie') !== cookie) throw Object.assign(Error('private'), { statusCode: 401 });
      return { binding, dealerId: 'paow', snapshot: read('locked', contexts.length) };
    },
    emitChat: (roomId, entry) => emitted.push({ roomId, ...entry }),
  };
  let chat;
  const server = createServer(async (req, res) => {
    if (!(await handleSharedRoomHttp(req, res, { command: null, chat, engineOrigin }))) { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  engineOrigin = `http://127.0.0.1:${server.address().port}`;
  chat = createSharedRoomChat({ service, origin, engineOrigin, settingsProvider: () => settings, now: now ?? (() => clock),
    decide: decide ?? (async (request, status) => { decided.push({ request, status });
      return { kind: 'generatedText', requestId: request.requestId, exactText: 'Du har sexton, jag skulle stanna.' }; }) });
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const post = (body, { headers = {}, method = 'POST', room = 'room-a' } = {}) => fetch(`${engineOrigin}/api/shared-room/${room}/chat`, {
    method, headers: { origin, cookie, 'content-type': 'application/json', ...headers },
    ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
  return { post, emitted, decided, contexts, members, tick: ms => { clock += ms; } };
}
const ask = (over = {}) => ({ requestId: 'chat-1', message: '  Vad har jag?  ', roundRevision: 'shared-room-a-round-4', acceptsSpeechStream: false, ...over });
const frames = async response => (await response.text()).trim().split('\n').map(line => JSON.parse(line));

test('a member question streams NDJSON and reaches the room as question and dealer answer', async t => {
  const h = await fixture(t);
  const response = await h.post(ask());
  assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /application\/x-ndjson/);
  const body = await frames(response);
  assert.deepEqual(body.map(frame => frame.type), ['progress', 'preview', 'result']);
  const { questionLineId, lineId, ...decision } = body.at(-1).decision;
  assert.deepEqual(decision, { kind: 'generatedText', requestId: 'chat-1', dealerId: 'paow', exactText: 'Du har sexton, jag skulle stanna.' });
  assert.deepEqual(h.emitted.map(entry => entry.lineId), [questionLineId, lineId], 'NDJSON and the room carry the same server line ids');
  assert.deepEqual(h.emitted.map(({ roomId, requestId, actorId, seat, text }) => ({ roomId, requestId, actorId, seat, text })), [
    { roomId: 'room-a', requestId: 'chat-1', actorId: 'player-a', seat: 1, text: 'Vad har jag?' },
    { roomId: 'room-a', requestId: 'chat-1', actorId: null, seat: null, text: 'Du har sexton, jag skulle stanna.' }]);
  assert.equal(h.contexts.length, 2, 'authorization and round are read again before the answer is published');
  assert.equal(sharedRoomChatRound({ roundId: null, windowId: 'w' }), 'window:w');
});

test('OpenClaw gets only a public projection: no hole card, holeDraw, room id or session id', async t => {
  const h = await fixture(t);
  assert.equal((await h.post(ask())).status, 200);
  const { status, request } = h.decided[0], wire = JSON.stringify(projectOpenClawGameStatus(status));
  assert.deepEqual(request, { requestId: 'chat-1', message: 'Vad har jag?', history: [] });
  assert.ok(!JSON.stringify(status).includes('holeDraw')); assert.ok(!wire.includes('holeDraw'));
  assert.deepEqual(projectOpenClawGameStatus(status).visibleCards.dealer.cards, [{ r: 'K', s: '♠', faceDown: false }]);
  assert.ok(!wire.includes('"r":"Q"'));
  for (const secret of ['room-a', binding.sessionId, 'player-a', 'shared-room-a-round-4', 'available', 'stake']) assert.ok(!wire.includes(secret), secret);
});

test('origin, method, JSON, membership and authentication fail closed before OpenClaw', async t => {
  const h = await fixture(t, { read: () => snapshot({ me: { id: 'player-a', seats: [], active: false } }) });
  const cases = [
    [await h.post(ask(), { headers: { origin: 'https://evil.example.test' } }), 403, 'shared_room_invalid_origin'],
    [await h.post(ask(), { headers: { authorization: 'Bearer x' } }), 403, 'shared_room_invalid_origin'],
    [await h.post(null, { method: 'GET' }), 405, 'shared_room_method_not_allowed'],
    [await h.post(ask(), { headers: { 'content-type': 'text/plain' } }), 415, 'shared_room_json_required'],
    [await h.post({ ...ask(), extra: 1 }), 400, 'shared_room_invalid_request'],
    [await h.post(ask({ message: 'x'.repeat(1001) })), 400, 'shared_room_invalid_request'],
    [await h.post(ask(), { headers: { cookie: 'croupier_session=mallory' } }), 401, 'shared_room_authentication_required'],
    [await h.post(ask()), 403, 'shared_room_chat_not_member'],
  ];
  for (const [response, status, error] of cases) {
    assert.equal(response.status, status, error); assert.deepEqual(await response.json(), { error });
  }
  assert.equal(h.decided.length, 0); assert.equal(h.emitted.length, 0);
});

test('a question for another round is 409; a round that moves during the answer is never published', async t => {
  let reads = 0;
  const h = await fixture(t, { read: kind => kind === 'locked' && ++reads === 2 ? snapshot({ roundId: 'shared-room-a-round-5' }) : snapshot() });
  const stale = await h.post(ask({ roundRevision: 'shared-room-a-round-3' }));
  assert.equal(stale.status, 409); assert.deepEqual(await stale.json(), { error: 'stale_round_revision' });
  assert.equal(h.decided.length, 0); assert.equal(h.contexts.length, 0, 'a stale question takes no lock');
  const moved = await frames(await h.post(ask({ requestId: 'chat-2' })));
  assert.deepEqual(moved.at(-1), { type: 'error', error: 'stale_round_revision' });
  assert.deepEqual(h.emitted.map(entry => entry.actorId), ['player-a'], 'no dealer line for a stale answer');
});

test('missing OpenClaw keys answer 503 with their code and never call OpenClaw or publish', async t => {
  for (const [settings, error] of [[{}, 'openclaw_not_configured'], [{ speechUrl: 'https://director.invalid' }, 'product_speech_relay_not_configured']]) {
    const h = await fixture(t, { settings });
    const response = await h.post(ask());
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error });
    assert.equal(h.decided.length, 0); assert.equal(h.emitted.length, 0);
  }
});

test('one open question per actor and ten seconds between questions', async t => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const h = await fixture(t, { decide: async request => { await gate; return { kind: 'generatedText', requestId: request.requestId, exactText: 'Visst.' }; } });
  const first = h.post(ask());
  await new Promise(resolve => setTimeout(resolve, 50));
  const busy = await h.post(ask({ requestId: 'chat-2' }));
  assert.equal(busy.status, 429); assert.deepEqual(await busy.json(), { error: 'shared_room_chat_busy' });
  release(); assert.equal((await first).status, 200);
  h.tick(9999);
  const soon = await h.post(ask({ requestId: 'chat-3' }));
  assert.equal(soon.status, 429); assert.deepEqual(await soon.json(), { error: 'shared_room_chat_too_soon' });
  h.tick(1);
  assert.equal((await h.post(ask({ requestId: 'chat-4' }))).status, 200);
});

test('review fix: 20 parallel questions from one member take at most one locked read', async t => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const h = await fixture(t, { decide: async request => { await gate; return { kind: 'generatedText', requestId: request.requestId, exactText: 'Visst.' }; } });
  const pending = Array.from({ length: 20 }, (_, index) => h.post(ask({ requestId: 'chat-' + index })));
  const settled = [];
  for (const response of pending) settled.push(await Promise.race([response, new Promise(resolve => setTimeout(() => resolve(null), 300))]));
  const refused = settled.filter(response => response?.status === 429);
  assert.equal(refused.length, 19);
  for (const response of refused) assert.deepEqual(await response.json(), { error: 'shared_room_chat_busy' });
  assert.ok(h.contexts.length <= 1, `locked reads before the answer: ${h.contexts.length}`);
  release(); await Promise.all(pending);
  assert.equal(h.contexts.length, 2, 'the admitted question: one locked read before and one after the answer');
  // Missing keys are refused before any lock as well.
  const off = await fixture(t, { settings: {} });
  for (let index = 0; index < 5; index++) assert.equal((await off.post(ask({ requestId: 'off-' + index }))).status, 503);
  assert.equal(off.contexts.length, 0);
});

test('review fix: line ids are the server\'s; a reused requestId from another member never matches', async t => {
  const h = await fixture(t);
  const one = (await frames(await h.post(ask()))).at(-1).decision;
  h.tick(10000);
  const two = (await frames(await h.post(ask()))).at(-1).decision;
  for (const value of [one.questionLineId, one.lineId, two.questionLineId, two.lineId]) assert.match(value, /^[qa]-[0-9a-f]{24}$/);
  assert.equal(new Set([one.questionLineId, one.lineId, two.questionLineId, two.lineId]).size, 4, 'the same requestId twice gives four distinct rows');
  assert.ok(!one.lineId.includes('chat-1'));
});

test('review fix: control, bidi and zero-width characters are refused before the room sees the question', async t => {
  const h = await fixture(t);
  for (const message of ['Hej\u0007', 'Hej \u202edu', 'Hej\u2066du\u2069', 'H\u200bej', 'Hej\u200f', 'He\ufeffj', 'a\u2028b']) {
    const response = await h.post(ask({ message }));
    assert.equal(response.status, 400, JSON.stringify(message)); assert.deepEqual(await response.json(), { error: 'shared_room_invalid_request' });
  }
  assert.equal(h.emitted.length, 0); assert.equal(h.decided.length, 0); assert.equal(h.members.length, 0);
  assert.equal((await h.post(ask({ message: 'Rad ett\nrad två å ä ö 👍' }))).status, 200);
});

// Fake DOM for the 1b chat panel: only what createSharedRoomChatPanel touches.
function fakeDocument() {
  const node = tag => {
    const element = { tagName: tag, className: '', textContent: '', hidden: false, id: '', value: '', children: [], attributes: {}, listeners: {},
      style: { setProperty() {} }, classList: { toggle() {} }, scrollTop: 0, scrollHeight: 0,
      setAttribute(name, value) { this.attributes[name] = value; }, focus() {},
      addEventListener(type, listener) { this.listeners[type] = listener; }, removeEventListener(type) { delete this.listeners[type]; },
      append(...nodes) { for (const child of nodes) { child.parent = this; this.children.push(child); } },
      remove() { const list = this.parent?.children; if (list) list.splice(list.indexOf(this), 1); },
      get firstElementChild() { return this.children[0] ?? null; } };
    return element;
  };
  return { createElement: node, body: node('body') };
}

test('review fix (1b): the panel deduplicates on server line ids, so a reused requestId never replaces the asker\'s answer', async () => {
  const { createSharedRoomChatPanel } = await import('../services/game/public/shared-room-chat.mjs');
  const document = fakeDocument(), ids = { bobQ: 'q-' + 'b'.repeat(24), bobA: 'a-' + 'b'.repeat(24), aliceQ: 'q-' + 'a'.repeat(24), aliceA: 'a-' + 'a'.repeat(24) };
  let panel;
  const fetchImpl = async (url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.requestId, 'chat-x');
    // Bob reused Alice's requestId; his lines and Alice's own question echo arrive over the socket first.
    panel.receive({ lineId: ids.bobQ, requestId: 'chat-x', who: 'player', seat: 3, text: 'Bobs fråga', at: 1 });
    panel.receive({ lineId: ids.bobA, requestId: 'chat-x', who: 'dealer', seat: null, text: 'Svar till Bob', at: 2 });
    panel.receive({ lineId: ids.aliceQ, requestId: 'chat-x', who: 'you', seat: 1, text: 'Alices fråga', at: 3 });
    const frames = [{ type: 'progress', stage: 'text', elapsedMs: 0 }, { type: 'preview', exactText: 'Svar till Alice' },
      { type: 'result', decision: { kind: 'generatedText', requestId: 'chat-x', dealerId: 'paow', questionLineId: ids.aliceQ, exactText: 'Svar till Alice', lineId: ids.aliceA } }];
    return new Response(frames.map(frame => JSON.stringify(frame) + '\n').join(''), { headers: { 'content-type': 'application/x-ndjson' } });
  };
  panel = createSharedRoomChatPanel({ document, roomId: 'room-a', state: () => ({ snapshot: snapshot() }), fetchImpl, randomId: () => 'x' });
  const root = document.body.children[0], body = root.children[1], log = body.children[0], form = body.children[2], input = form.children[0];
  input.value = 'Alices fråga';
  await form.listeners.submit({ preventDefault() {} });
  panel.receive({ lineId: ids.aliceA, requestId: 'chat-x', who: 'dealer', seat: null, text: 'Svar till Alice', at: 4 });
  const lines = log.children.map(item => item.children.map(part => part.textContent));
  assert.deepEqual(lines, [['plats 3', 'Bobs fråga'], ['dealern', 'Svar till Bob'], ['du', 'Alices fråga'], ['dealern', 'Svar till Alice']]);
  panel.close();
});
