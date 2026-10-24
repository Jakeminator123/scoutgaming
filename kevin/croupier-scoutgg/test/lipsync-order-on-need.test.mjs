import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Kevin 24 Oct: "jag vill bara att läppsynken ska funka som de gjorde förut inte massa onödigt skit"
test('opening the page orders no GPU for the first Astrid; a chat to her does', async () => {
  const { ServerlessLipsync } = await import('../server/serverless.mjs');
  const calls = [];
  const lip = new ServerlessLipsync({ endpointId: 'x', apiKey: 'k', sessionUrl: () => 'wss://x', log: () => {},
    fetchImpl: async u => { calls.push(String(u)); return { ok: true, json: async () => ({ id: 'j' }) }; } });
  lip.notifyPlayers(1); lip.notifyPlayers(2);
  await new Promise(r => setTimeout(r, 5));
  assert.equal(lip.wanted, false);
  assert.equal(calls.filter(u => u.endsWith('/run')).length, 0, 'a visitor alone orders nothing');
  lip.notifyActivity('chattmeddelande');
  await new Promise(r => setTimeout(r, 5));
  assert.equal(lip.wanted, true);
  clearInterval(lip.tick); clearTimeout(lip.graceTimer);
});

test('only a chat to the first Astrid starts her GPU, and no Dragan/Paow warm-up where the moving lip sync speaks', () => {
  const src = readFileSync(new URL('../server/server.mjs', import.meta.url), 'utf8');
  assert.match(src, /if\(!localQA&&!hasVoice\(dealerOf\(session\)\)\)lip\.notifyActivity\("chattmeddelande"\)/);
  assert.match(src, /if \(hasVoice\(j\.dealer\) && !\(rorlig && rorligOn\(\) && rorlig\.dealers\.includes\(j\.dealer\)\)\) draggeWarm\(j\.dealer\)/);
});
