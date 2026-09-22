// Context is derived from received public facts, never hypothetical test values.
// Director receives only bounded observed chat plus public context, never
// authentication, money or identity fields from the original game response.
export function observationContext(sequence, step, records = []) {
  const index = sequence.steps.findIndex(item => item.id === step.id);
  const lastGap = Math.max(-1, ...sequence.notices.filter(notice => ['gap', 'conflict', 'limit'].includes(notice.kind) && notice.recordIndex <= step.recordIndex).map(notice => notice.recordIndex));
  let wins = 0, losses = 0, settlements = 0;
  for (const item of sequence.steps.slice(0, index + 1)) {
    if (item.blocked || item.recordIndex <= lastGap || item.event?.type !== 'settle') continue;
    settlements++;
    for (const hand of item.event.hands ?? []) {
      if (['win', 'blackjack'].includes(hand.outcome)) wins++;
      if (hand.outcome === 'lose') losses++;
    }
  }
  const chat = records.slice(lastGap + 1, step.recordIndex + 1).filter(record => record.kind === 'chat' && record.source === 'native');
  // Only an explicit signal from the source is usable. Free-form text is not
  // classified here and cannot become an emotional diagnosis or hidden memory.
  const signal = [...chat].reverse().find(record => ['none', 'praise', 'inappropriate'].includes(record.data?.signal))?.data.signal ?? 'none';
  let length = 0;
  const messages = chat.filter(record => ['user', 'assistant'].includes(record.data?.role) && typeof record.data?.text === 'string'
    && Number.isFinite(Date.parse(record.time)) && Date.parse(record.time) <= Date.parse(step.receivedAt)).slice(-8).reverse().flatMap(record => {
      const text = record.data.text.slice(0, Math.min(600, 3200 - length)); length += text.length;
      return text ? [{ role: record.data.role, text, at: record.time }] : [];
    }).reverse();
  return { context: { chat: { signal }, playerHistory: { returning: false, preferredLanguage: null },
    session: { recentWins: Math.min(100, wins), recentLosses: Math.min(100, losses) },
    ...(messages.length ? { observedChat: { source: 'native-observation', before: step.receivedAt, messages } } : {}) },
    evidence: { origin: 'observed-public-events', settlements, scope: 'received-hands-since-last-gap',
      chatMessagesObserved: chat.length, chatSignal: signal === 'none' ? 'not-provided' : 'source-provided',
      unavailable: ['player-history', 'preferred-language', 'temperament', ...(signal === 'none' ? ['chat-classification'] : [])],
      defaultsAreNotEvidence: true, gapBefore: lastGap >= 0, sourceRequestId: step.requestId } };
}

export function observedTable(records, sequence) {
  const latest = [...records].reverse().find(record => record.source === 'native' && record.data?.view);
  if (latest) return { source: 'native-server-response', version: latest.data.view.version,
    round: latest.data.view.round ?? null, shoe: latest.data.view.shoe ?? null, partial: false };
  let hands = [], dealer = [], phase = null, active = null, version = null, seenBatch = '';
  for (const step of sequence.steps) {
    if (step.blocked) continue;
    const batch = `${step.requestId}:${step.version}`;
    if (batch !== seenBatch && ['start', 'collect'].includes(step.op)) { hands = []; dealer = []; active = null; }
    seenBatch = batch; version = step.version; phase = step.phase;
    const event = step.event;
    if (event?.type === 'deal') {
      const card = { ...(event.faceDown ? {} : event.card), faceDown: event.faceDown, shoeDraw: event.shoeDraw };
      if (event.to === 'dealer') dealer.push(card);
      else { let hand = hands.find(item => item.box === event.box && item.handIndex === event.handIndex);
        if (!hand) { hand = { box: event.box, handIndex: event.handIndex, cards: [] }; hands.push(hand); }
        hand.cards.push(card); }
    } else if (event?.type === 'reveal') {
      const index = dealer.findIndex(card => card.faceDown && (event.shoeDraw == null || card.shoeDraw === event.shoeDraw));
      if (index >= 0) dealer[index] = { ...event.card, shoeDraw: event.shoeDraw };
    } else if (event?.type === 'turn') active = event.handIndex;
    else if (event?.type === 'settle') {
      for (const result of event.hands ?? []) { const hand = hands.find(item => item.box === result.box && !item.outcome); if (hand) hand.outcome = result.outcome; }
    }
  }
  return { source: 'received-presentation', version, round: hands.length || dealer.length ? { hands, dealer, phase, active } : null, shoe: null, partial: true };
}
