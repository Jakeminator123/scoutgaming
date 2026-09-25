import test from 'node:test';
import assert from 'node:assert/strict';
import { idleReactionInput } from '../lib/idle-reaction-input.mjs';

const at = '2026-09-25T15:00:00.000Z';
const message = (sequence, role, text, time = at) => ({ id: `native:bound-channel:${sequence}`, source: 'native', kind: 'chat', time, data: { role, text } });
const base = () => ({ records: [message(1, 'user', 'A real observed message')], project: { idlePolicy: { variants: [{ use: 'openclaw' }] } },
  dealerId: 'astrid', mode: 'active', channel: 'bound-channel', revision: 3, requestId: 'advice-1', now: Date.parse(at) + 1000 });
test('idle advice binds the latest actual user message, not a fabricated game instruction', () => {
  const result = idleReactionInput(base());
  assert.deepEqual(result.sourceRef, { kind: 'renderer-idle', channel: 'bound-channel', revision: 3, messageId: 'native:bound-channel:1', at });
  assert.equal(Object.hasOwn(result, 'sourceEvent'), false);
  assert.deepEqual(result.observedChat.messages, [{ role: 'user', text: 'A real observed message', at }]);
});
test('wrong window/imports, stale/future messages, inactive selection and other dealers cannot ask', () => {
  for (const patch of [{ channel: 'other' }, { mode: 'off' }, { mode: 'rules' }, { mode: 'random' }, { dealerId: 'mei' },
    { revision: null }, { now: Date.parse(at) + 30001 }, { now: Date.parse(at) - 1 }, { project: {} },
    { records: [{ ...message(1, 'user', 'Imported'), source: 'import' }] }]) assert.equal(idleReactionInput({ ...base(), ...patch }), null);
});
test('gaps discard prior chat and post-cutoff assistant text is not attached to the earlier message', () => {
  assert.equal(idleReactionInput({ ...base(), records: [...base().records, { kind: 'gap' }] }), null);
  const result = idleReactionInput({ ...base(), records: [...base().records, message(2, 'assistant', 'Later', '2026-09-25T15:00:00.500Z')] });
  assert.equal(result.observedChat.messages.length, 1);
});
test('message count, individual text and total text are bounded with no extra private fields', () => {
  const result = idleReactionInput({ ...base(), records: Array.from({ length: 15 }, (_, i) => ({ ...message(i, i === 14 ? 'user' : 'assistant', 'a'.repeat(1000)), secret: 'not projected' })) });
  assert.ok(result.observedChat.messages.length <= 8);
  assert.ok(result.observedChat.messages.every(item => item.text.length <= 600));
  assert.ok(result.observedChat.messages.reduce((sum, item) => sum + item.text.length, 0) <= 3200);
  assert.equal(JSON.stringify(result).includes('not projected'), false);
});
