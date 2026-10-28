import test from 'node:test';
import assert from 'node:assert/strict';
import { WAIT_REFRESH_MS, WAITING_TEXT, createSharedRoomWaiting, waitingForSeat } from '../services/game/public/shared-room-waiting.mjs';
import { FULL_TABLE } from '../services/game/games/blackjack/table/coordinator.mjs';

// K6 (docs/plans/KEVIN-PORT.md, P-C): the client renews a viewer's wait for a seat while the shown table is full.
const me = (extra = {}) => ({ id: 'carol', seats: [], memberGen: 0, active: false, available: 1000, pausedUntil: 0, ...extra });
const full = (extra = {}) => ({ owners: Array(7).fill('bob'), serverNow: 1000, me: me(), ...extra });
const free = () => full({ owners: ['bob', 'bob', 'bob', null, 'bob', 'bob', 'bob'] });

function harness({ snapshot = full(), connected = true } = {}) {
  let time = 0, nextId = 0;
  const timers = new Map(), clients = [], sends = [], replies = [];
  const view = { snapshot, connected, closed: false };
  const createCommands = options => {
    assert.deepEqual(options, { roomId: 'room-a' });
    const client = { state: 'idle', stopped: false,
      async send(intent) {
        sends.push({ client: clients.indexOf(client), intent });
        const reply = replies.shift() ?? { status: 'ok', result: { op: 'wait', version: 1, waiting: true } };
        if (reply.status === 'uncertain') client.state = 'uncertain';
        if (reply instanceof Error) throw reply;
        return reply;
      },
      stop() { client.stopped = true; client.state = 'stopped'; } };
    clients.push(client); return client;
  };
  const waiting = createSharedRoomWaiting({ roomId: 'room-a', createCommands, state: () => view, now: () => time,
    setTimer: (fn, ms) => { const id = ++nextId; timers.set(id, { fn, at: time + ms }); return id; },
    clearTimer: id => { timers.delete(id); } });
  // Runs every timer due by `to`, in time order, letting each send settle.
  async function advance(to) {
    for (;;) {
      const due = [...timers].filter(([, t]) => t.at <= to).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]); time = due[1].at; await due[1].fn();
    }
    time = to;
  }
  return { view, waiting, clients, sends, replies, timers, advance, get time() { return time; } };
}

test('a viewer waits for a seat only at a full table, without a seat and without a pause', () => {
  assert.equal(waitingForSeat(full()), true);
  assert.equal(waitingForSeat(free()), false, 'a free seat is joined, not waited for');
  assert.equal(waitingForSeat(full({ owners: Array(7).fill('carol'), me: me({ seats: [0, 1, 2, 3, 4, 5, 6] }) })), false);
  assert.equal(waitingForSeat(full({ me: me({ pausedUntil: 2000 }) })), false, 'a paused account does not wait');
  assert.equal(waitingForSeat(full({ me: me({ pausedUntil: 2000 }) }), 3000), true, 'until the pause is over');
  for (const value of [null, undefined, {}, { owners: [], me: me() }, full({ me: null })]) assert.equal(waitingForSeat(value), false);
  assert.equal(WAITING_TEXT, 'Väntar på plats');
});

test('a renewal comes well inside the server\'s registration: at least three fit in one', () => {
  assert.ok(WAIT_REFRESH_MS * 3 <= FULL_TABLE.waitingMs, `${WAIT_REFRESH_MS} ms against ${FULL_TABLE.waitingMs} ms`);
});

test('the wait is sent once the full table shows and renewed every interval while it stays full', async () => {
  const h = harness();
  h.waiting.update(); h.waiting.update(); h.waiting.update();
  await h.advance(0);
  assert.deepEqual(h.sends, [{ client: 0, intent: { op: 'wait' } }], 'one send, however many snapshots arrive');
  for (let i = 0; i < 5; i++) h.waiting.update();
  await h.advance(WAIT_REFRESH_MS - 1);
  assert.equal(h.sends.length, 1);
  await h.advance(WAIT_REFRESH_MS * 3);
  assert.equal(h.sends.length, 4, 'renewed every interval');
  assert.equal(h.clients.length, 1, 'one command client while its replies arrive');
  h.view.snapshot = free(); h.waiting.update();
  await h.advance(WAIT_REFRESH_MS * 10);
  assert.equal(h.sends.length, 4, 'a free seat ends the renewals');
  assert.equal(h.timers.size, 0);
});

test('nothing is sent while the table is lost, and a reconnect renews at once once the interval has passed', async () => {
  const h = harness();
  h.waiting.update(); await h.advance(0);
  h.view.connected = false;
  await h.advance(WAIT_REFRESH_MS * 3);
  assert.equal(h.sends.length, 1, 'the timer finds the socket closed and sends nothing');
  assert.equal(h.timers.size, 0, 'and does not keep a timer');
  h.view.connected = true; h.waiting.update();
  await h.advance(h.time);
  assert.equal(h.sends.length, 2);
});

test('a lost reply never blocks the next renewal: an uncertain client is replaced, a thrown send is retried later', async () => {
  const h = harness();
  h.replies.push({ status: 'uncertain', code: 'shared_room_command_uncertain' }, new Error('network'));
  h.waiting.update(); await h.advance(0);
  await h.advance(WAIT_REFRESH_MS);
  await h.advance(WAIT_REFRESH_MS * 2);
  assert.deepEqual(h.sends.map(s => s.client), [0, 1, 1]);
  assert.equal(h.clients[0].stopped, true, 'the uncertain client is stopped, not retried');
  assert.equal(h.clients[1].stopped, false);
});

test('a refused sign-in or room access ends the waiting, other refusals do not', async () => {
  for (const [httpStatus, more] of [[409, true], [401, false], [403, false]]) {
    const h = harness();
    h.replies.push({ status: 'rejected', httpStatus, code: httpStatus === 409 ? 'NO_ROOM' : 'shared_room_forbidden' });
    h.waiting.update(); await h.advance(0); await h.advance(WAIT_REFRESH_MS);
    assert.equal(h.sends.length, more ? 2 : 1, String(httpStatus));
  }
});

test('stop cancels the renewal and stops its command client; a paused or seated viewer sends nothing', async () => {
  const h = harness();
  h.waiting.update(); await h.advance(0);
  h.waiting.stop(); h.waiting.stop();
  h.waiting.update(); await h.advance(WAIT_REFRESH_MS * 5);
  assert.equal(h.sends.length, 1); assert.equal(h.clients[0].stopped, true); assert.equal(h.timers.size, 0);
  for (const snapshot of [full({ me: me({ pausedUntil: 5000 }) }), full({ owners: ['carol', ...Array(6).fill('bob')], me: me({ seats: [0] }) })]) {
    const other = harness({ snapshot });
    other.waiting.update(); await other.advance(WAIT_REFRESH_MS * 3);
    assert.deepEqual(other.sends, []); assert.equal(other.clients.length, 0, 'no command client is created');
  }
  assert.throws(() => createSharedRoomWaiting({ roomId: 'room-a', createCommands: null, state: () => null }), TypeError);
});
