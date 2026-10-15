import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.ELEVENLABS_VIDEO_KEY = 'test-key'; process.env.DRAGGE_RUNPOD_API_KEY = 'test-key';

// Emil 15 Oct: every dealer speaks Brazilian Portuguese: the recorded lines (mouth baked in), the chat in his own voice,
// and the same responsible-gambling guard as in Swedish and English.
globalThis.location = { search: '?dealer=paow' };
const { DEALERS } = await import('../public/dealers.js');
const { guardReply } = await import('../server/dealer-chat.mjs');
const { localResponse, RESPONSES } = await import('../server/dealer-policy.mjs');
const { localizeResponse, personalizedGreeting } = await import('../server/dealer-responses-localized.mjs');
const { draggeSay } = await import('../server/dragge-voice.mjs');
const { STUDIO_CHOICES } = await import('../server/studio-tables.mjs');
const { LANGS } = await import('../server/cartesia.mjs');

const READY = ['dragge', 'paow', 'marten', 'astrid2'];
const pub = p => new URL(`../public${p}`, import.meta.url);

test('every ready dealer has all his lines in Portuguese, each with what he says in it, the same lines as in English', () => {
  for (const id of READY) {
    const d = DEALERS[id];
    assert.ok(d.lines.includes('pt'), id);
    const en = readdirSync(pub(`${d.linesDir}en/`)).filter(f => f.endsWith('.mp4')).sort();
    const pt = readdirSync(pub(`${d.linesDir}pt/`)).filter(f => f.endsWith('.mp4')).sort();
    assert.deepEqual(pt, en, id);
    const texts = JSON.parse(readFileSync(pub(`${d.linesDir}pt/texter.json`), 'utf8'));
    assert.deepEqual(Object.keys(texts).sort(), en.map(f => f.slice(0, -4)), id);
  }
  // he introduces himself by his own name
  for (const [id, name] of [['dragge', 'Dragan'], ['paow', 'Paow'], ['marten', 'Mårten'], ['astrid2', 'Astrid']])
    assert.match(JSON.parse(readFileSync(pub(`/media/dealers/${id}/repliker/pt/texter.json`), 'utf8')).greeting_1, new RegExp(`Eu sou ${name}`));
});

test('a studio table can be Portuguese, and Astrid 2.0 answers in her Portuguese Freja', () => {
  assert.ok(STUDIO_CHOICES.lang.includes('pt'));
  assert.ok(LANGS.pt.voice);
  for (const id of READY) assert.ok(existsSync(pub(`/media/dealers/${id}/repliker/pt/greeting_1.mp4`)), id);
});

test('the guard stops Portuguese advice, pressure, predictions and personal data, and lets banter through', () => {
  for (const bad of ['Você deveria pedir mais uma carta.', 'Aposte mais, a sorte está com você!', 'Vamos jogar, façam suas apostas!',
    'A próxima carta vai ser um dez.', 'Você vai ganhar essa, garantido.', 'Me passa sua senha?', 'Posso te emprestar dinheiro.'])
    assert.equal(guardReply(bad), null, bad);
  const ok = 'Haha, eu estou ótima, obrigada! Dealers nunca se cansam, só ganham mais cartas.';
  assert.equal(guardReply(ok), ok);
});

test('a Portuguese player in distress or sharing personal data gets the reviewed response, in Portuguese', () => {
  assert.equal(localResponse('Perdi muito dinheiro hoje'), 'support');
  assert.equal(localResponse('acho que tenho um vício'), 'support');
  assert.equal(localResponse('tenho 16 anos'), 'support');
  assert.equal(localResponse('minha senha é 1234'), 'privacy');
  assert.match(localizeResponse(RESPONSES.support, 'pt'), /pausa de 24 horas/);
  assert.match(localizeResponse(RESPONSES.social, 'sv'), /Tack/);   // a Swedish table's fallback no longer throws
  assert.equal(personalizedGreeting('Ana', 'pt'), 'Oi Ana, como você está hoje?');
});

test('the ElevenLabs dealers read Portuguese with the Portuguese language code', async () => {
  for (const dealer of ['dragge', 'paow']) {
    const seen = [];
    await draggeSay('Boa sorte.', 'pt', path.join(os.tmpdir(), 'dealer-voice-test'), { dealer, fetchImpl: async (url, opts) => {
      if (url.includes('elevenlabs')) { seen.push(JSON.parse(opts.body)); return { ok: true, arrayBuffer: async () => new ArrayBuffer(4800) }; }
      return { json: async () => ({ status: 'COMPLETED', output: { mp4_b64: '', frames: 1 } }) };
    } });
    assert.equal(seen[0].language_code, 'pt');
  }
});
