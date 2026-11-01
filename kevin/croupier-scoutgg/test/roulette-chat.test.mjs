// The roulette dealer's chat without tokens: a fake Gemini that echoes the first offered life entry.
// (Copied into kevin-staging as test/roulette-chat.test.mjs.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRouletteChat } from '../server/roulette-chat.mjs';

const PERSONAS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'roulette-personas');
function setup(say = 'Lovely to see you, Marco.') {
  const sent = [];
  const fetchImpl = async (url, o) => {
    const b = JSON.parse(o.body); sent.push(b);
    const id = /\[([a-z-]+)\]/.exec(b.contents[0].parts[0].text)?.[1] ?? 'none';
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ say, memory: id === 'none' ? 'none' : 'likes saunas', lore_used: id }) }] } }] }) };
  };
  const chat = createRouletteChat({ personasDir: PERSONAS, memoryFile: path.join(mkdtempSync(path.join(tmpdir(), 'rchat-')), 'mem.sqlite'), apiKey: 'x', fetchImpl, random: () => 0.9 });
  return { chat, sent };
}
const guest = 'a'.repeat(64);

test('a story from her life is offered only on topic, and never twice to the same player', async () => {
  const { chat, sent } = setup();
  assert.equal((await chat.reply({ guest, name: 'Marco', text: 'hello astrid' })).lore, null);
  assert.match(sent.at(-1).contents[0].parts[0].text, /Do not bring up your past/);
  assert.equal((await chat.reply({ guest, name: 'Marco', text: 'do you like sauna?' })).lore, 'sauna');
  assert.equal((await chat.reply({ guest, name: 'Marco', text: 'do you like sauna?' })).lore, null);
  assert.deepEqual(chat.player(guest).heard, ['sauna']);
  assert.deepEqual(chat.player(guest).notes, ['likes saunas']);
  assert.match(sent[0].systemInstruction.parts[0].text, /You are Astrid/);
  chat.close();
});

test('distress and personal data get the reviewed reply without calling the model', async () => {
  const { chat, sent } = setup();
  assert.equal((await chat.reply({ guest, name: 'Tom', text: 'I lost everything, I need to win it back' })).fixed, 'support');
  assert.equal((await chat.reply({ guest, name: 'Tom', text: 'my email is tom@example.com' })).fixed, 'privacy');
  assert.equal(sent.length, 0);
  // ordinary table talk is not distress (simulation 1 Nov: "fika breaks", "break my heart", "lost this round")
  for (const t of ['do you get fika breaks?', 'you break my heart with that wheel', 'lost this round haha', 'my bank account is crying lol']) assert.equal((await chat.reply({ guest, name: 'Lina', text: t })).fixed, null);
  chat.close();
});

test('predictions and soft invitations to play never pass the guard', async () => {
  const { chat } = setup('Seventeen is due, Marco, good luck on the next spin!');
  const r = await chat.reply({ guest, name: 'Marco', text: 'is 17 coming?' });
  assert.equal(r.fixed, 'fallback');
  chat.close();
});

test('a failing main model falls back to the fallback model', async () => {
  const models = [];
  const fetchImpl = async (url) => { models.push(/models\/([^:]+):/.exec(url)[1]);
    return models.length === 1 ? { ok: false, status: 429, json: async () => ({ error: { message: 'quota' } }) }
      : { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ say: 'Evening, Lina.', memory: 'none', lore_used: 'none' }) }] } }] }) }; };
  const chat = createRouletteChat({ personasDir: PERSONAS, memoryFile: path.join(mkdtempSync(path.join(tmpdir(), 'rchat-')), 'mem.sqlite'), apiKey: 'x', fetchImpl });
  assert.equal((await chat.reply({ guest, name: 'Lina', text: 'evening!' })).text, 'Evening, Lina.');
  assert.deepEqual(models, ['gemini-3.6-flash', 'gemini-3.5-flash-lite']);
  chat.close();
});

test('a default guest name never overwrites the name the dealer remembers', async () => {
  const { chat, sent } = setup();
  await chat.reply({ guest, name: 'Anders', text: 'hi' });
  await chat.reply({ guest, name: 'Guest 342', text: 'hello again' });
  assert.match(sent.at(-1).contents[0].parts[0].text, /PLAYER: Anders\./);
  assert.equal(chat.player(guest).row.name, 'Anders');
  await chat.reply({ guest, name: 'Emil', text: 'call me Emil now' });
  assert.equal(chat.player(guest).row.name, 'Emil');
  chat.close();
});

test('forget me removes what the dealer remembers', async () => {
  const { chat } = setup();
  await chat.reply({ guest, name: 'Lina', text: 'tell me about sauna' });
  chat.forget(guest);
  assert.equal(chat.player(guest).row, undefined);
  assert.deepEqual(chat.player(guest).heard, []);
  chat.close();
});
