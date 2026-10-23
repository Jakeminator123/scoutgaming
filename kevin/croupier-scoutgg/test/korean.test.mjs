import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.ELEVENLABS_VIDEO_KEY = 'test-key'; process.env.DRAGGE_RUNPOD_API_KEY = 'test-key';

// Emil 19 Oct: Dragan, Paow and Astrid 2.0 speak Korean, as they speak Portuguese: the recorded lines (mouth baked in),
// the chat in his own voice, and the same responsible-gambling guard. Mårten does not (not asked for).
globalThis.location = { search: '?dealer=paow' };
const { DEALERS } = await import('../public/dealers.js');
const { guardReply } = await import('../server/dealer-chat.mjs');
const { localResponse, RESPONSES } = await import('../server/dealer-policy.mjs');
const { localizeResponse, personalizedGreeting } = await import('../server/dealer-responses-localized.mjs');
const { draggeSay } = await import('../server/dragge-voice.mjs');
const { STUDIO_CHOICES } = await import('../server/studio-tables.mjs');
const { LANGS } = await import('../server/cartesia.mjs');

const KOREAN = ['dragge', 'paow', 'astrid2'];
const pub = p => new URL(`../public${p}`, import.meta.url);

test('Dragan, Paow and Astrid 2.0 have all their lines in Korean, each with what they say in it, the same lines as in English', () => {
  for (const id of KOREAN) {
    const d = DEALERS[id];
    assert.ok(d.lines.includes('ko'), id);
    const en = readdirSync(pub(`${d.linesDir}en/`)).filter(f => f.endsWith('.mp4')).sort();
    const ko = readdirSync(pub(`${d.linesDir}ko/`)).filter(f => f.endsWith('.mp4')).sort();
    assert.deepEqual(ko, en, id);
    const texts = JSON.parse(readFileSync(pub(`${d.linesDir}ko/texter.json`), 'utf8'));
    assert.deepEqual(Object.keys(texts).sort(), en.map(f => f.slice(0, -4)), id);
  }
  // each introduces himself by his own name, in Hangul
  for (const [id, name] of [['dragge', '드라간'], ['paow', '파오'], ['astrid2', '아스트리드']])
    assert.match(JSON.parse(readFileSync(pub(`/media/dealers/${id}/repliker/ko/texter.json`), 'utf8')).greeting_1, new RegExp(`저는 ${name}`));
});

test('a studio table can be Korean, and Astrid 2.0 answers in her Korean Freja', () => {
  assert.ok(STUDIO_CHOICES.lang.includes('ko'));
  assert.ok(LANGS.ko.voice);
  for (const id of KOREAN) assert.ok(existsSync(pub(`/media/dealers/${id}/repliker/ko/greeting_1.mp4`)), id);
});

test('the guard stops Korean advice, pressure, predictions and personal data, and lets banter through', () => {
  for (const bad of ['히트하세요, 그게 나아요.', '더 베팅하세요, 운이 트였어요!', '자, 앉으세요. 베팅해 주세요!',
    '다음 카드는 십이에요.', '이번엔 이기실 거예요, 보장해요.', '비밀번호 알려 주실래요?', '돈을 빌려 드릴게요.'])
    assert.equal(guardReply(bad), null, bad);
  const ok = '하하, 저는 아주 잘 지내요, 고마워요! 딜러는 절대 지치지 않거든요.';
  assert.equal(guardReply(ok), ok);
});

test('a Korean player in distress or sharing personal data gets the reviewed response, in Korean', () => {
  assert.equal(localResponse('오늘 돈을 많이 잃었어요'), 'support');
  assert.equal(localResponse('도박 중독인 것 같아요'), 'support');
  assert.equal(localResponse('저 16살이에요'), 'support');
  assert.equal(localResponse('제 비밀번호는 1234예요'), 'privacy');
  assert.match(localizeResponse(RESPONSES.support, 'ko'), /24시간/);
  assert.equal(personalizedGreeting('Ana', 'ko'), '안녕하세요 Ana님, 환영합니다! 오늘 기분 어떠세요?');
});

test('the ElevenLabs dealers read Korean with the Korean language code', async () => {
  for (const dealer of ['dragge', 'paow']) {
    const seen = [];
    await draggeSay('행운을 빌어요.', 'ko', path.join(os.tmpdir(), 'dealer-voice-test'), { dealer, fetchImpl: async (url, opts) => {
      if (url.includes('elevenlabs')) { seen.push(JSON.parse(opts.body)); return { ok: true, arrayBuffer: async () => new ArrayBuffer(4800) }; }
      return { json: async () => ({ status: 'COMPLETED', output: { mp4_b64: '', frames: 1 } }) };
    } });
    assert.equal(seen[0].language_code, 'ko');
  }
});
