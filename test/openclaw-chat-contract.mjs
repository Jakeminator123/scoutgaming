import test from 'node:test';
import assert from 'node:assert/strict';
import { openClawChat, projectOpenClawGameStatus } from '../web/openclaw-chat.mjs';

const policy = () => ({
  recordedLines: [{ lineId: 'goodluck', exactText: 'Good luck.', familyId: 'speak.goodluck', variantIds: ['goodluck.warm'] }],
  generatedText: true,
  silence: true,
  mediaFamilies: [{ familyId: 'social.neutral', variantIds: ['neutral.nod'] }],
});

const authoritative = () => ({
  dealerId: 'astrid', sessionRevision: 7, roundRevision: 12, displayName: 'Jakob',
  playerId: 'raw-player-must-not-leak', wallet: { balance: 1234 }, futureShoe: [{ r: 'A', s: '♠' }],
  cookie: 'private-cookie', apiKey: 'private-key', occupiedBoxes: [4, 1, 4], policy: policy(),
  round: {
    phase: 'decisions', holeCard: { r: 'K', s: '♣' },
    hands: [{ box: 1, stake: 500, playerId: 'nested-player', cards: [{ r: 'A', s: '♥', shoeDraw: 2 }, { r: '9', s: '♠', shoeDraw: 4 }] }],
    dealer: [{ r: '7', s: '♦', shoeDraw: 3 }, { r: 'K', s: '♣', shoeDraw: 5, faceDown: true }],
  },
  publishedEvents: [
    { type: 'deal', to: 'dealer', box: null, handIndex: null, faceDown: true, card: { r: 'K', s: '♣' }, shoeDraw: 5, clip: { path: '/secret.mp4' } },
    { type: 'deal', to: 'box', box: 3, handIndex: 0, faceDown: false, card: { r: '5', s: '♠' }, shoeDraw: 6 },
    { type: 'turn', box: 1, handIndex: 0, legalActions: ['hit', 'stand'] },
  ],
});

const request = () => ({ requestId: 'chat-request-001', message: 'Hej Astrid', history: [{ role: 'user', text: 'Hej' }] });
const settings = Object.freeze({ baseUrl: 'https://gateway.example', gatewayKey: 'never-log-this', chatAgent: 'openclaw/croupier-chat', adviceTimeoutMs: 2345 });

test('authoritative projection allowlists public facts and removes identity, money, future shoe and hidden hole', () => {
  const projected = projectOpenClawGameStatus(authoritative());
  assert.deepEqual(projected.occupiedBoxes, [1, 4]);
  assert.equal(projected.visibleCards.hands[0].publicTotal, 20);
  assert.deepEqual(projected.visibleCards.dealer.cards, [{ r: '7', s: '♦', faceDown: false, shoeDraw: 3 }]);
  assert.equal(projected.publishedEvents[0].card, null);
  assert.deepEqual(projected.publishedEvents[1], { type: 'deal', to: 'box', box: 3, handIndex: 0, faceDown: false, card: { r: '5', s: '♠', faceDown: false }, shoeDraw: 6 });
  const serialized = JSON.stringify(projected);
  for (const forbidden of ['raw-player-must-not-leak', 'nested-player', 'private-cookie', 'private-key', 'futureShoe', 'wallet', 'holeCard', '/secret.mp4']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test('product chat reuses existing settings/complete and accepts only a policy-owned recorded line', async () => {
  let capture;
  const result = await openClawChat(request(), authoritative(), {
    settingsProvider: () => settings,
    completeImpl: async (...args) => {
      capture = args;
      return JSON.stringify({ kind: 'recordedLine', requestId: 'chat-request-001', dealerId: 'astrid',
        sessionRevision: '7', roundRevision: '12', lineId: 'goodluck', variantId: 'goodluck.warm' });
    },
    fetchImpl: async () => assert.fail('completeImpl owns transport'),
  });
  assert.equal(capture[0], settings);
  assert.equal(capture[1].model, settings.chatAgent);
  assert.equal(capture[1].tool_choice, 'none');
  assert.equal(capture[2], settings.adviceTimeoutMs);
  const modelInput = capture[1].messages[1].content;
  assert.equal(modelInput.includes('raw-player-must-not-leak'), false);
  assert.equal(modelInput.includes('private-key'), false);
  assert.deepEqual(result, { kind: 'recordedLine', requestId: 'chat-request-001', dealerId: 'astrid',
    sessionRevision: '7', roundRevision: '12', lineId: 'goodluck', familyId: 'speak.goodluck',
    variantId: 'goodluck.warm', exactText: 'Good luck.', provider: 'responded' });
});

test('generated text is normalized to the neutral visual contract and silence is explicit', async () => {
  const generated = await openClawChat(request(), authoritative(), {
    settingsProvider: () => settings,
    completeImpl: async () => JSON.stringify({ kind: 'generatedText', requestId: 'chat-request-001', dealerId: 'astrid',
      sessionRevision: '7', roundRevision: '12', text: '  Ett lugnt svar.\r\nTack.  ' }),
  });
  assert.equal(generated.exactText, 'Ett lugnt svar.\nTack.');
  assert.equal(generated.visualMode, 'neutral');

  const silent = await openClawChat(request(), authoritative(), {
    settingsProvider: () => settings,
    completeImpl: async () => JSON.stringify({ kind: 'silence', requestId: 'chat-request-001', dealerId: 'astrid', sessionRevision: '7', roundRevision: '12' }),
  });
  assert.equal(silent.kind, 'silence');
  assert.equal(Object.hasOwn(silent, 'exactText'), false);
});

test('paths, URLs, timing, playNow, unknown lines and stale revisions are rejected model output', async () => {
  const attempts = [
    { kind: 'recordedLine', requestId: 'chat-request-001', dealerId: 'astrid', sessionRevision: '7', roundRevision: '12', lineId: 'goodluck', variantId: null, path: '/take.mp4' },
    { kind: 'recordedLine', requestId: 'chat-request-001', dealerId: 'astrid', sessionRevision: '7', roundRevision: '12', lineId: 'invented', variantId: null },
    { kind: 'generatedText', requestId: 'chat-request-001', dealerId: 'astrid', sessionRevision: '7', roundRevision: '11', text: 'Sent svar' },
    { kind: 'generatedText', requestId: 'chat-request-001', dealerId: 'astrid', sessionRevision: '7', roundRevision: '12', text: 'Hej', url: 'https://evil.test', playNow: true, timing: 0 },
  ];
  for (const choice of attempts) {
    await assert.rejects(openClawChat(request(), authoritative(), {
      settingsProvider: () => settings, completeImpl: async () => JSON.stringify(choice),
    }), error => ['invalid_openclaw_speech_choice', 'disallowed_openclaw_speech_choice', 'stale_openclaw_speech_choice'].includes(error.code));
  }
});
