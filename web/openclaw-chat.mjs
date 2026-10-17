import { normalizeConversationMemory } from '../packages/director/conversation-memory.mjs';

import { normalizeAstridObservation } from '../packages/director/astrid-observation.mjs';

class GatewayError extends Error {
  constructor(code, statusCode = 503) { super(code); this.code = code; this.statusCode = statusCode; }
}

export const OPENCLAW_SPEECH_KINDS = Object.freeze(['recordedLine', 'generatedText', 'silence']);
export const OPENCLAW_CHAT_LIMITS = Object.freeze({ message: 1000, history: 30, historyChars: 8000, generatedText: 500, events: 128, hands: 32, cards: 32 });

const RANKS = new Set(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']);
const SUITS = new Set(['♠', '♥', '♦', '♣']);
const PHASES = new Set(['bets', 'dealing', 'insurance', 'decisions', 'dealer', 'settled', 'collecting', 'idle']);
const EVENT_TYPES = new Set(['speak', 'deal', 'reveal', 'settle', 'turn', 'idle']);
const ACTIONS = new Set(['hit', 'stand', 'double', 'split']);
const OUTCOMES = new Set(['blackjack', 'win', 'push', 'lose']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const canonicalText = value => typeof value === 'string' ? value.trim().replace(/\r\n?/g, '\n') : value;
const safeText = (value, max, allowEmpty = false) => typeof value === 'string' && value.length <= max
  && (allowEmpty || value.trim().length > 0) && value === canonicalText(value)
  && !/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/.test(value);
const safeId = (value, max = 100) => typeof value === 'string' && value.length > 0 && value.length <= max && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const fail = (code, statusCode = 400) => { throw new GatewayError(code, statusCode); };

function revision(value, field) {
  if ((typeof value !== 'string' && !Number.isSafeInteger(value)) || String(value).length < 1 || String(value).length > 100) fail(`invalid_${field}`);
  return String(value);
}

function visibleCard(value) {
  if (!object(value)) fail('invalid_public_card');
  const shoeDraw = integer(value.shoeDraw, 0, 100000) ? value.shoeDraw : undefined;
  if (value.faceDown === true || value.r == null || value.s == null) return { faceDown: true, ...(shoeDraw === undefined ? {} : { shoeDraw }) };
  if (!RANKS.has(value.r) || !SUITS.has(value.s)) fail('invalid_public_card');
  return { r: value.r, s: value.s, faceDown: false, ...(shoeDraw === undefined ? {} : { shoeDraw }) };
}

function publicTotal(cards) {
  if (!cards.length || cards.some(card => card.faceDown)) return null;
  let total = 0; let aces = 0;
  for (const card of cards) {
    if (card.r === 'A') { total += 11; aces++; }
    else total += ['K', 'Q', 'J'].includes(card.r) ? 10 : Number(card.r);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function projectHand(hand, handIndex) {
  if (!object(hand) || !integer(hand.box, 0, 6) || !Array.isArray(hand.cards) || hand.cards.length > OPENCLAW_CHAT_LIMITS.cards) fail('invalid_public_hand');
  const cards = hand.cards.map(visibleCard);
  const projected = { box: hand.box, handIndex: integer(hand.handIndex, 0, 31) ? hand.handIndex : handIndex, cards, publicTotal: publicTotal(cards) };
  if (OUTCOMES.has(hand.outcome)) projected.outcome = hand.outcome;
  return projected;
}

function projectPublishedEvent(value) {
  if (!object(value) || !EVENT_TYPES.has(value.type)) fail('invalid_published_event');
  const event = { type: value.type };
  if (value.type === 'speak') {
    if (!safeId(value.line, 64)) fail('invalid_published_event');
    event.line = value.line;
    if (typeof value.blocking === 'boolean') event.blocking = value.blocking;
  } else if (value.type === 'deal') {
    if (!['box', 'dealer'].includes(value.to) || typeof value.faceDown !== 'boolean') fail('invalid_published_event');
    event.to = value.to; event.faceDown = value.faceDown;
    event.box = value.to === 'dealer' ? null : integer(value.box, 0, 6) ? value.box : fail('invalid_published_event');
    event.handIndex = value.handIndex == null ? null : integer(value.handIndex, 0, 31) ? value.handIndex : fail('invalid_published_event');
    event.card = value.faceDown ? null : visibleCard(value.card);
    if (integer(value.shoeDraw, 0, 100000)) event.shoeDraw = value.shoeDraw;
  } else if (value.type === 'reveal') {
    if (value.to !== 'dealer') fail('invalid_published_event');
    event.to = 'dealer'; event.card = visibleCard(value.card);
    if (event.card.faceDown) fail('invalid_published_event');
    if (integer(value.shoeDraw, 0, 100000)) event.shoeDraw = value.shoeDraw;
  } else if (value.type === 'settle') {
    if (!integer(value.dealerTotal, 0, 200) || typeof value.dealerBlackjack !== 'boolean'
      || !Array.isArray(value.hands) || value.hands.length > OPENCLAW_CHAT_LIMITS.hands) fail('invalid_published_event');
    event.dealerTotal = value.dealerTotal; event.dealerBlackjack = value.dealerBlackjack;
    event.hands = value.hands.map(hand => {
      if (!object(hand) || !integer(hand.box, 0, 6) || !OUTCOMES.has(hand.outcome)) fail('invalid_published_event');
      return { box: hand.box, outcome: hand.outcome };
    });
  } else if (value.type === 'turn') {
    if (!integer(value.box, 0, 6) || !integer(value.handIndex, 0, 31) || !Array.isArray(value.legalActions)
      || value.legalActions.length > ACTIONS.size || value.legalActions.some(action => !ACTIONS.has(action))) fail('invalid_published_event');
    event.box = value.box; event.handIndex = value.handIndex; event.legalActions = [...new Set(value.legalActions)];
  }
  return event;
}

function normalizePolicy(value) {
  if (!exact(value, ['recordedLines', 'generatedText', 'silence', 'mediaFamilies'])
    || !Array.isArray(value.recordedLines) || value.recordedLines.length > 256
    || typeof value.generatedText !== 'boolean' || typeof value.silence !== 'boolean'
    || !Array.isArray(value.mediaFamilies) || value.mediaFamilies.length > 256) fail('invalid_speech_policy');
  const lines = new Set();
  const recordedLines = value.recordedLines.map(line => {
    if (!exact(line, ['lineId', 'exactText', 'familyId', 'variantIds']) || !safeId(line.lineId, 64)
      || !safeText(line.exactText, OPENCLAW_CHAT_LIMITS.generatedText) || !safeId(line.familyId)
      || !Array.isArray(line.variantIds) || line.variantIds.length > 128 || line.variantIds.some(id => !safeId(id))) fail('invalid_speech_policy');
    if (lines.has(line.lineId) || new Set(line.variantIds).size !== line.variantIds.length) fail('invalid_speech_policy');
    lines.add(line.lineId);
    return { lineId: line.lineId, exactText: line.exactText, familyId: line.familyId, variantIds: [...line.variantIds] };
  });
  const families = new Set();
  const mediaFamilies = value.mediaFamilies.map(family => {
    if (!exact(family, ['familyId', 'variantIds']) || !safeId(family.familyId) || !Array.isArray(family.variantIds)
      || family.variantIds.length > 128 || family.variantIds.some(id => !safeId(id)) || families.has(family.familyId)
      || new Set(family.variantIds).size !== family.variantIds.length) fail('invalid_speech_policy');
    families.add(family.familyId);
    return { familyId: family.familyId, variantIds: [...family.variantIds] };
  });
  if (!recordedLines.length && !value.generatedText && !value.silence) fail('invalid_speech_policy');
  return { recordedLines, generatedText: value.generatedText, silence: value.silence, mediaFamilies };
}

// This projection deliberately builds a new object. It never spreads the server
// state, so a future shoe, wallet value, cookie, playerId or hidden card cannot
// enter the OpenClaw request by acquiring a new property upstream.
export function projectOpenClawGameStatus(authoritative) {
  if (!object(authoritative) || !safeId(authoritative.dealerId, 64)) fail('invalid_authoritative_status');
  const sessionRevision = revision(authoritative.sessionRevision, 'session_revision');
  const roundRevision = revision(authoritative.roundRevision, 'round_revision');
  const round = authoritative.round == null ? null : authoritative.round;
  if (round !== null && !object(round)) fail('invalid_authoritative_status');
  const phase = round?.phase ?? authoritative.roundPhase ?? 'idle';
  if (typeof phase !== 'string' || phase.length > 64 || (!PHASES.has(phase) && !safeId(phase, 64))) fail('invalid_round_phase');
  const handsSource = round?.hands ?? [];
  if (!Array.isArray(handsSource) || handsSource.length > OPENCLAW_CHAT_LIMITS.hands) fail('invalid_public_hands');
  const hands = handsSource.map(projectHand);
  const dealerCardsSource = round?.dealer ?? [];
  if (!Array.isArray(dealerCardsSource) || dealerCardsSource.length > OPENCLAW_CHAT_LIMITS.cards) fail('invalid_public_dealer');
  const dealerCards = dealerCardsSource.map(visibleCard).filter(card => !card.faceDown);
  const occupiedSource = authoritative.occupiedBoxes ?? [...new Set(hands.map(hand => hand.box))];
  if (!Array.isArray(occupiedSource) || occupiedSource.length > 7 || occupiedSource.some(box => !integer(box, 0, 6))) fail('invalid_occupied_boxes');
  const occupiedBoxes = [...new Set(occupiedSource)].sort((a, b) => a - b);
  const eventsSource = authoritative.publishedEvents ?? [];
  if (!Array.isArray(eventsSource) || eventsSource.length > OPENCLAW_CHAT_LIMITS.events) fail('invalid_published_events');
  const policy = normalizePolicy(authoritative.policy);
  const displayName = safeText(authoritative.displayName, 40) ? authoritative.displayName : 'spelaren';
  return {
    dealerId: authoritative.dealerId, sessionRevision, roundRevision, roundPhase: phase,
    displayName, publishedEvents: eventsSource.map(projectPublishedEvent),
    visibleCards: { hands, dealer: { cards: dealerCards, publicTotal: publicTotal(dealerCards) } },
    occupiedBoxes,
    ...(authoritative.dealerId === 'astrid' && authoritative.conversationMemory !== undefined
      ? { conversationMemory: normalizeConversationMemory(authoritative.conversationMemory) } : {}),
    // Explicit server-owned summary; never copy arbitrary wallet/state fields.
    ...(authoritative.playResults ? { playResults: {
      scope: authoritative.playResults.scope, accounting: authoritative.playResults.accounting,
      currencies: authoritative.playResults.currencies.map(({ currency, rounds, won, lost, net, wagered, returned }) =>
        ({ currency, rounds, won, lost, net, wagered, returned })),
      ...(authoritative.playResults.lastRound === undefined ? {} : { lastRound: authoritative.playResults.lastRound ?
        (({roundId,currency,wagered,returned,net,outcome})=>({roundId,currency,wagered,returned,net,outcome}))(authoritative.playResults.lastRound) : null }),
      currentRound: authoritative.playResults.currentRound ? {
        currency: authoritative.playResults.currentRound.currency, wagered: authoritative.playResults.currentRound.wagered,
        phase: authoritative.playResults.currentRound.phase,
      } : null,
    } } : {}),
    allowedSpeech: {
      recordedLines: policy.recordedLines.map(({ lineId, exactText, familyId, variantIds }) => ({ lineId, exactText, familyId, variantIds })),
      generatedText: policy.generatedText, silence: policy.silence, mediaFamilies: policy.mediaFamilies,
    },
  };
}

function normalizeRequest(value, dealerId) {
  if (!exact(value, ['requestId', 'message', 'history', ...(value?.observation === undefined ? [] : ['observation'])]) || !safeId(value.requestId) || !safeText(value.message, OPENCLAW_CHAT_LIMITS.message)
    || !Array.isArray(value.history) || value.history.length > OPENCLAW_CHAT_LIMITS.history) fail('invalid_chat_request');
  let total = 0;
  const history = value.history.map(entry => {
    if (!exact(entry, ['role', 'text']) || !['user', 'assistant'].includes(entry.role) || !safeText(entry.text, OPENCLAW_CHAT_LIMITS.message)) fail('invalid_chat_history');
    total += entry.text.length;
    return { role: entry.role, text: entry.text };
  });
  if (total > OPENCLAW_CHAT_LIMITS.historyChars) fail('invalid_chat_history');
  return { requestId: value.requestId, message: value.message, history,
    ...(value.observation === undefined ? {} : { observation: normalizeAstridObservation(value.observation, value.requestId, dealerId) }) };
}

function validateChoice(value, request, status) {
  if (!object(value) || !OPENCLAW_SPEECH_KINDS.includes(value.kind)) fail('invalid_openclaw_speech_choice', 502);
  const common = ['kind', 'requestId', 'dealerId', 'sessionRevision', 'roundRevision'];
  if (value.requestId !== request.requestId || value.dealerId !== status.dealerId
    || value.sessionRevision !== status.sessionRevision || value.roundRevision !== status.roundRevision) fail('stale_openclaw_speech_choice', 409);
  if (value.kind === 'recordedLine') {
    if (!exact(value, [...common, 'lineId', 'variantId']) || !safeId(value.lineId, 64)
      || !(value.variantId === null || safeId(value.variantId))) fail('invalid_openclaw_speech_choice', 502);
    const line = status.allowedSpeech.recordedLines.find(candidate => candidate.lineId === value.lineId);
    if (!line || (value.variantId !== null && !line.variantIds.includes(value.variantId))) fail('disallowed_openclaw_speech_choice', 502);
    return { kind: 'recordedLine', requestId: request.requestId, dealerId: status.dealerId,
      sessionRevision: status.sessionRevision, roundRevision: status.roundRevision,
      lineId: line.lineId, familyId: line.familyId, variantId: value.variantId, exactText: line.exactText, provider: 'responded' };
  }
  if (value.kind === 'generatedText') {
    if (!exact(value, [...common, 'text']) || !status.allowedSpeech.generatedText) fail('disallowed_openclaw_speech_choice', 502);
    const text = canonicalText(value.text);
    if (!safeText(text, OPENCLAW_CHAT_LIMITS.generatedText)) fail('invalid_openclaw_speech_choice', 502);
    return { kind: 'generatedText', requestId: request.requestId, dealerId: status.dealerId,
      sessionRevision: status.sessionRevision, roundRevision: status.roundRevision,
      exactText: text, visualMode: 'neutral', provider: 'responded' };
  }
  if (!exact(value, common) || !status.allowedSpeech.silence) fail('disallowed_openclaw_speech_choice', 502);
  return { kind: 'silence', requestId: request.requestId, dealerId: status.dealerId,
    sessionRevision: status.sessionRevision, roundRevision: status.roundRevision, provider: 'responded' };
}

// The caller must pass a status obtained from the authoritative server-side
// game object. Browser-supplied state is not an acceptable argument here.
export async function openClawChat(requestValue, authoritativeStatus, {
  settingsProvider = null, completeImpl = null, fetchImpl = fetch, model = 'gateway-default',
} = {}) {
  const status = projectOpenClawGameStatus(authoritativeStatus);
  const request = normalizeRequest(requestValue, status.dealerId);
  if (!settingsProvider) {
    const { readSettings } = await import('./director-settings.mjs');
    settingsProvider ??= readSettings;
  }
  const settings = settingsProvider();
  // Keep the ordinary game server module portable for isolated fixtures that
  // never enable product chat; load the OpenClaw transport only on a chat call.
  const { decideProductSpeech, normalizeProductSpeechEnvelope, relayProductSpeech } = await import('../packages/director/product-speech.mjs');
  const envelope = normalizeProductSpeechEnvelope({ request, status, ...(model==='gateway-default'?{}:{model}) });
  const choice = settings.speechUrl || settings.speechToken
    ? await relayProductSpeech(envelope, settings, fetchImpl)
    : await decideProductSpeech(envelope, settings, fetchImpl, completeImpl ?? undefined);
  return validateChoice(choice, request, status);
}
