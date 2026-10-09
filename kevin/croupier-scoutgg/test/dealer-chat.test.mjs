import test from 'node:test';
import assert from 'node:assert/strict';
import { guardReply, dealerReply } from '../server/dealer-chat.mjs';

test('conversation passes, advice, predictions, pressure and money talk never do', () => {
  assert.equal(guardReply('Haha, jag mår toppen, tack! Kul att ha dig vid bordet i kväll.'), 'Haha, jag mår toppen, tack! Kul att ha dig vid bordet i kväll.');
  assert.equal(guardReply("I'm grand, thanks. Dealers never get tired, we just get more cards."), "I'm grand, thanks. Dealers never get tired, we just get more cards.");
  for (const bad of ['Du borde ta ett kort på 16.', 'You should stand here.', 'Satsa mer nu när det går bra!',
    'Nästa kort blir en tia, lita på mig.', 'Kan du låna mig pengar?', 'Win it back next round!', 'Redo att sätta dig vid bordet, kung?', 'Ready to play another hand?', "The table's quiet, waiting for someone brave enough to sit down.", 'x'.repeat(300)])
    assert.equal(guardReply(bad), null, bad);
});

test('an unreachable agent or a blocked reply gives null, so the table falls back to a reviewed reply', async () => {
  process.env.AXEL_AGENT_TOKEN = 'test';
  const down = async () => { throw new Error('offline'); };
  assert.equal(await dealerReply({ text: 'hej', fetchImpl: down }), null);
  const advice = async () => ({ ok: true, text: async () => 'data: {"type":"text","text":"Dragge: Du borde dubbla nu."}\n' });
  assert.equal(await dealerReply({ text: 'hej', dealer: 'dragge', fetchImpl: advice }), null);
  const fine = async () => ({ ok: true, text: async () => 'data: {"type":"text","text":"Dragge: Jag mår som en kung, tack!"}\n' });
  assert.equal(await dealerReply({ text: 'hej', dealer: 'dragge', fetchImpl: fine }), 'Jag mår som en kung, tack!');
});

test("the agent's own errors never become a dealer's line (a session limit once went out, voiced, as Paow's reply)", async () => {
  process.env.AXEL_AGENT_TOKEN = 'test';
  const limit = async () => ({ ok: true, text: async () => 'data: {"type":"result","result":"You\'ve hit your session limit · resets 5:40pm (UTC)","is_error":true}\n' });
  assert.equal(await dealerReply({ text: 'hi', dealer: 'paow', fetchImpl: limit }), null);
  const asText = async () => ({ ok: true, text: async () => 'data: {"type":"text","text":"You\'ve hit your session limit · resets 5:40pm (UTC)"}\n' });
  assert.equal(await dealerReply({ text: 'hi', dealer: 'paow', fetchImpl: asText }), null);
  const errored = async () => ({ ok: true, text: async () => 'data: {"type":"text","text":"Paow: Lovely, thanks!"}\ndata: {"type":"error","message":"overloaded"}\n' });
  assert.equal(await dealerReply({ text: 'hi', dealer: 'paow', fetchImpl: errored }), null);
  assert.equal(guardReply('Weekly limit reached, resets 3pm'), null);
});
