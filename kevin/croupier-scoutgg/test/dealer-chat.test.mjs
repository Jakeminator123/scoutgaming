import test from 'node:test';
import assert from 'node:assert/strict';
import { guardReply, dealerReply, dealerTalk } from '../server/dealer-chat.mjs';

test('conversation passes, advice, predictions, pressure and money talk never do', () => {
  assert.equal(guardReply('Haha, jag mår toppen, tack! Kul att ha dig vid bordet i kväll.'), 'Haha, jag mår toppen, tack! Kul att ha dig vid bordet i kväll.');
  assert.equal(guardReply("I'm grand, thanks. Dealers never get tired, we just get more cards."), "I'm grand, thanks. Dealers never get tired, we just get more cards.");
  for (const bad of ['Du borde ta ett kort på 16.', 'You should stand here.', 'Satsa mer nu när det går bra!',
    'Nästa kort blir en tia, lita på mig.', 'Kan du låna mig pengar?', 'Win it back next round!', 'Redo att sätta dig vid bordet, kung?', 'Ready to play another hand?', "The table's quiet, waiting for someone brave enough to sit down.", 'x'.repeat(300)])
    assert.equal(guardReply(bad), null, bad);
});

// Gemini's answer shape; the game never calls the Claude agent (Kevin 12 Oct).
const gemini = text => async (url) => { if (!/generativelanguage\.googleapis\.com/.test(url)) throw new Error('only Gemini may be called: ' + url); return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) }; };
process.env.GEMINI_API_KEY = 'test-gemini';

test('an unreachable provider or a blocked reply gives null, so the table falls back to a reviewed reply', async () => {
  const down = async () => { throw new Error('offline'); };
  assert.equal(await dealerReply({ text: 'hej', fetchImpl: down }), null);
  assert.equal(await dealerReply({ text: 'hej', dealer: 'dragge', fetchImpl: gemini('Dragge: Du borde dubbla nu.') }), null);
  assert.equal(await dealerReply({ text: 'hej', dealer: 'dragge', fetchImpl: gemini('Dragge: Jag mår som en kung, tack!') }), 'Jag mår som en kung, tack!');
  assert.equal(await dealerReply({ text: 'hej', dealer: 'dragge', fetchImpl: async () => ({ ok: false, json: async () => ({}) }) }), null);
});

test('the dealers talk through Gemini only: same persona, rules and guard, memory note kept, no agent call', async () => {
  const asked = []; const spy = async (url, opts) => { asked.push(url); return gemini('Paow: Hey you! Lovely to see you at my table.\nMEMORY: says hey a lot')(url, opts); };
  const r = await dealerTalk({ text: 'Hey paow', dealer: 'paow', fetchImpl: spy });
  assert.equal(r.text, 'Hey you! Lovely to see you at my table.'); assert.equal(r.note, 'says hey a lot');
  assert.ok(asked.length >= 1 && asked.every(u => /generativelanguage/.test(u)), 'only Gemini was asked');
  const body = []; await dealerTalk({ text: 'Hey paow', dealer: 'paow', fetchImpl: async (u, o) => { body.push(JSON.parse(o.body).contents[0].parts[0].text); return gemini('Paow: Hi!')(u, o); } });
  assert.match(body[0], /You are Paow/); assert.match(body[0], /Never give betting or playing advice/); assert.match(body[0], /Hey paow/);
  const saved = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = 'local-qa-disabled';
  try { assert.equal(await dealerReply({ text: 'hi', dealer: 'paow', fetchImpl: gemini('Paow: Hi!') }), null, 'no key: reviewed fallback'); } finally { process.env.GEMINI_API_KEY = saved; }
});

test("a provider's own error text never becomes a dealer's line", async () => {
  assert.equal(await dealerReply({ text: 'hi', dealer: 'paow', fetchImpl: gemini("You've hit your weekly limit · resets Oct 14, 7pm (UTC)") }), null);
  assert.equal(guardReply('Weekly limit reached, resets 3pm'), null);
});
