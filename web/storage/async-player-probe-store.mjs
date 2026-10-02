// PostgreSQL implementation; explicit schema is installed before service initialization.
import { createHash, randomUUID } from 'node:crypto';
import { projectConversationMemory } from '../../open-claw/lab/src/conversation-memory.mjs';

const DAY = 86400000;
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normalize = text => text.toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]/gu, '');
const fail = code => { throw Object.assign(new Error(code), { code, statusCode: 409 }); };
const activeStates = ['reserved', 'generated', 'playing'];
const evidenceKey = fact => fact.type === 'player' && typeof fact.source?.quote === 'string'
  ? `player-${hash(normalize(fact.source.quote))}` : `fact-${fact.id}`;
const commonWords = new Set('actually correction instead i my me we our am are is was were have has had do does did not never don dont didn didnt isn isnt wasnt arent werent no longer now the a an and but to of for in on at with it this that then than what when how who why about as be been being going through like said say told know sure name named called learning learn playing play jag min mitt mina mig vi vår vårt våra är var har hade att och men en ett det den som på till med om nu inte aldrig istället rättelse namn heter'.split(' '));
const relatedWords = new Map([
  ...'trip travel honeymoon holiday vacation resa resan smekmånad'.split(' ').map(word => [word, 'travel']),
  ...'dog dogs hund hunden'.split(' ').map(word => [word, 'dog']),
  ...'divorce divorced separation skilsmässa skild'.split(' ').map(word => [word, 'divorce']),
]);
const subjectTerms = value => new Set((value.toLocaleLowerCase('en').match(/[\p{L}\p{N}]+/gu) ?? [])
  .filter(word => word.length > 2 && !commonWords.has(word)).map(word => relatedWords.get(word) ?? word));
function correctedFacts(text, facts) {
  const terms = new Set();
  for (const clause of text.match(/[^.!?\n]+[.!?]?/g) ?? []) {
    // Questions and ordinary uncertainty are not retractions of saved facts.
    if (clause.trim().endsWith('?') || /\b(not sure|not certain|don't know|do not know|didn't know|inte säker|vet inte|osäker)\b/i.test(clause)) continue;
    const explicit = /(?:^|[^\p{L}])(correction|cancelled|canceled|rättelse|avbokad|ändrat)(?!\p{L})/iu.test(clause);
    const denial = /\b(i|we|my|our|jag|min|mitt|mina|vi|vår|vårt|våra)\b.{0,100}\b(not|never|don't|didn't|isn't|wasn't|aren't|weren't|no longer|inte|aldrig)\b/i.test(clause);
    if (explicit || denial) for (const term of subjectTerms(clause)) terms.add(term);
  }
  if (!terms.size) return [];
  return facts.filter(fact => fact.type === 'player' && [...subjectTerms(`${fact.topicId} ${fact.source.quote}`)].some(term => terms.has(term)));
}

// All identities come from the existing authenticated chat-memory service.
// A persistent activity epoch invalidates pending work across processes/restarts.
export async function createPlayerProbeStore(db, memory, { now = Date.now, random = Math.random } = {}) {


  const transaction = async work => (await db.transaction(work));
  const scopeFor = async input => {
    const profile = (await memory.profile(input));
    return { scope: `${profile.playerRef}:${profile.dealerId}`, revision: profile.revision };
  };
  const rowFor = async scope => (await db.prepare('SELECT * FROM player_probe_profiles WHERE scope=?').get(scope));
  async function ensure(scope) {
    (await db.prepare('INSERT OR IGNORE INTO player_probe_profiles(scope,epoch,generation,activity,reason) VALUES(?,0,?,?,?)')
      .run(scope, randomUUID(), now(), 'inactive'));
    return (await rowFor(scope));
  }
  async function prune() {
    const at = now();
    (await db.prepare('DELETE FROM player_probe_facts WHERE expires<=?').run(at));
    (await db.prepare('DELETE FROM player_probe_sources WHERE created<=?').run(at - 30 * DAY));
    (await db.prepare('DELETE FROM player_probe_rounds WHERE completed<=?').run(at - 30 * DAY));
    (await db.prepare('DELETE FROM player_probe_attempts WHERE started<=?').run(at - 31 * DAY));
    (await db.prepare('DELETE FROM player_probe_sessions WHERE seen<=?').run(at - DAY));
    (await db.prepare("UPDATE player_probe_attempts SET state='interrupted' WHERE state IN ('reserved','generated','playing') AND started<=?").run(at - 360000));
  }
  async function invalidate(scope, reason = 'cancelled') {
    (await db.prepare("UPDATE player_probe_attempts SET state=? WHERE scope=? AND state IN ('reserved','generated','playing')").run(reason, scope));
    (await db.prepare('UPDATE player_probe_profiles SET sampled=CASE WHEN sampled IS NULL THEN NULL ELSE epoch+1 END, epoch=epoch+1, reason=? WHERE scope=?').run(reason, scope));
  }
  async function remember(scope, fact, maxFacts) {
    // The extractor can rename a topic between runs. An identical assertion
    // still refers to the existing source and fixed expiry, not a new anecdote.
    const aliases = fact.type === 'player' ? (await db.prepare("SELECT * FROM player_probe_facts WHERE scope=? AND type='player' AND expires>?").all(scope, now())).map(factView)
      .filter(row => evidenceKey(row) === evidenceKey(fact)) : [];
    if (aliases.some(row => row.source.messageId === fact.source.messageId)) return;
    for (const alias of aliases) (await db.prepare('DELETE FROM player_probe_facts WHERE scope=? AND id=?').run(scope, alias.id));
    (await db.prepare('DELETE FROM player_probe_facts WHERE scope=? AND topic=?').run(scope, fact.topicId));
    (await db.prepare('INSERT INTO player_probe_facts VALUES(?,?,?,?,?,?,?,?,?)').run(scope, fact.id, fact.topicId, fact.type,
      fact.content, JSON.stringify(fact.source), fact.createdAt, fact.expiresAt, fact.notBefore ?? 0));
    (await db.prepare('DELETE FROM player_probe_facts WHERE scope=? AND id NOT IN (SELECT id FROM player_probe_facts WHERE scope=? ORDER BY created DESC,id LIMIT ?)').run(scope, scope, maxFacts));
  }
  const factView = row => ({ id: row.id, topicId: row.topic, type: row.type, content: row.content,
    source: JSON.parse(row.source), createdAt: row.created, expiresAt: row.expires, notBefore: row.not_before });
  async function storedFacts(scope, policy) {
    return policy.memoryEnabled ? (await db.prepare('SELECT * FROM player_probe_facts WHERE scope=? AND expires>? AND created>? ORDER BY created DESC,id LIMIT ?')
      .all(scope, now(), now() - policy.memoryDays * DAY, 20)).map(factView) : [];
  }
  async function facts(scope, policy) {
    const seen = new Set();
    return (await storedFacts(scope, policy)).filter(fact => {
      const key = evidenceKey(fact);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, policy.maxFacts);
  }
  const attempt = async (scope, requestId) => (await db.prepare('SELECT * FROM player_probe_attempts WHERE scope=? AND id=?').get(scope, requestId));
  const policyKey = (policy, revision) => hash([policy, revision]);
  async function syncPolicy(scope, policy, revision) {
    const key = policyKey(policy, revision);
    if ((await ensure(scope)).policy !== key) {
      (await invalidate(scope));
      // A policy edit invalidates work but does not create a new activity opportunity.
      (await db.prepare('UPDATE player_probe_profiles SET policy=?, sampled=CASE WHEN sampled IS NULL THEN NULL ELSE epoch END WHERE scope=?').run(key, scope));
    }
    return key;
  }
  async function presence(scope, owner, tab) {
    const session = (await db.prepare('SELECT * FROM player_probe_sessions WHERE scope=? AND session=? AND tab=?').get(scope, hash(owner), tab));
    if (!session || session.seen < now() - 15000) return 'absent';
    const flags = JSON.parse(session.flags);
    if (!flags.present) return 'absent';
    if (!flags.enabled || !flags.sound) return 'muted';
    if (!flags.quiet || flags.typing) return 'quiet';
    const other = (await db.prepare('SELECT flags FROM player_probe_sessions WHERE scope=? AND seen>?').all(scope, now() - 15000));
    if (other.some(row => { const flag = JSON.parse(row.flags); return flag.present && (flag.typing || !flag.quiet); })) return 'quiet';
    return null;
  }
  async function current(scope, ticket, policy, revision, owner, tab, quiet) {
    const key = (await syncPolicy(scope, policy, revision));
    const row = (await attempt(scope, ticket)), profile = (await rowFor(scope));
    return row && activeStates.includes(row.state) && row.epoch === profile.epoch && row.generation === profile.generation
      && row.policy === key && row.session === hash(owner) && row.tab === tab && policy.mode === 'automatic'
      && quiet && row.started > now() - 360000 && !(await presence(scope, owner, tab));
  }
  (await prune());
  return {
    async generation(input) { const {scope}=(await scopeFor(input));return (await ensure(scope)).generation; },
    async conversation(input, policy) {
      const { scope } = (await scopeFor(input));
      (await prune());
      // Proactive cooldown/notBefore only govern unsolicited initiatives. A
      // player may discuss a future trip or a recently discussed memory now.
      return { scope, generation: (await ensure(scope)).generation, policy,
        context: projectConversationMemory((await facts(scope, policy)), now()) };
    },
    async conversationCurrent(input, snapshot) {
      const { scope } = (await scopeFor(input));
      if (scope !== snapshot.scope || (await ensure(scope)).generation !== snapshot.generation) return false;
      const current = projectConversationMemory((await facts(scope, snapshot.policy)), now());
      return snapshot.context.facts.every(fact => current.facts.some(row => row.id === fact.id && hash(row) === hash(fact)));
    },
    async isPresent(input, owner, tab) { return !(await presence((await scopeFor(input)).scope, owner, tab)); },
    async activity(input) {
      const { scope } = (await scopeFor(input));
      return (await transaction(async () => { (await ensure(scope)); (await invalidate(scope)); (await db.prepare('UPDATE player_probe_profiles SET activity=?, sampled=NULL,reason=? WHERE scope=?').run(now(), 'inactive', scope)); }));
    },
    async observe(input, { owner, tab, flags, activity = false, policy, revision }) {
      if (!id(tab) || typeof owner !== 'string' || !owner) (await fail('invalid_probe_session'));
      if (!flags || ['present', 'quiet', 'typing', 'enabled', 'sound'].some(key => typeof flags[key] !== 'boolean')
        || Object.keys(flags).length !== 5) (await fail('invalid_probe_presence'));
      const { scope } = (await scopeFor(input));
      return (await transaction(async () => {
        (await prune()); (await ensure(scope)); (await syncPolicy(scope, policy, revision));
        (await db.prepare('INSERT INTO player_probe_sessions VALUES(?,?,?,?,?) ON CONFLICT(scope,session,tab) DO UPDATE SET seen=excluded.seen,flags=excluded.flags')
          .run(scope, hash(owner), tab, now(), JSON.stringify(flags)));
        if (activity) { (await invalidate(scope)); (await db.prepare('UPDATE player_probe_profiles SET activity=?,sampled=NULL,reason=? WHERE scope=?').run(now(), 'inactive', scope)); }
        else if ((await presence(scope, owner, tab))) (await invalidate(scope));
        return { reason: (await rowFor(scope)).reason };
      }));
    },
    async reserve(input, { requestId, owner, tab, policy, revision, quiet }) {
      if (!id(requestId)) (await fail('invalid_probe_request'));
      const { scope, revision: memoryRevision } = (await scopeFor(input));
      return (await transaction(async () => {
        (await prune()); const key = (await syncPolicy(scope, policy, revision)), profile = (await rowFor(scope));
        const refuse = async reason => { (await db.prepare('UPDATE player_probe_profiles SET reason=? WHERE scope=?').run(reason, scope)); return { reason }; };
        if (policy.mode !== 'automatic') return (await refuse(policy.mode));
        if ((await attempt(scope, requestId))) return (await refuse('sampled'));
        const blocked = (await presence(scope, owner, tab));
        if (blocked || !quiet) return (await refuse(blocked ?? 'quiet'));
        if (now() - profile.activity < policy.inactivityMs) return (await refuse('inactive'));
        if ((await db.prepare("SELECT 1 FROM player_probe_attempts WHERE scope=? AND state IN ('reserved','generated','playing')").get(scope))) return (await refuse('busy'));
        if (profile.sampled === profile.epoch) return (await refuse('sampled'));
        const last = (await db.prepare('SELECT started FROM player_probe_attempts WHERE scope=? ORDER BY started DESC LIMIT 1').get(scope));
        if (last && now() - last.started < policy.cooldownMs) return (await refuse('cooldown'));
        if ((await db.prepare('SELECT COUNT(*) AS n FROM player_probe_attempts WHERE scope=? AND started>?').get(scope, now() - 3600000)).n >= policy.maxPerHour) return (await refuse('hourly'));
        (await db.prepare('UPDATE player_probe_profiles SET sampled=epoch WHERE scope=?').run(scope));
        if (random() >= policy.probability) return (await refuse('chance'));
        (await db.prepare('INSERT INTO player_probe_attempts(scope,id,epoch,generation,session,tab,policy,started,state,memory_revision) VALUES(?,?,?,?,?,?,?,?,?,?)')
          .run(scope, requestId, profile.epoch, profile.generation, hash(owner), tab, key, now(), 'reserved', memoryRevision));
        const recent = (await db.prepare("SELECT topic,memories,text,evidence FROM player_probe_attempts WHERE scope=? AND state='played' AND played>?")
          .all(scope, now() - policy.anecdoteCooldownDays * DAY));
        const used = new Set(recent.flatMap(row => JSON.parse(row.memories)));
        const topics = [...new Set(recent.map(row => row.topic))];
        const usedEvidence = new Set(recent.flatMap(row => JSON.parse(row.evidence)));
        // Older receipts predate evidence fingerprints. Resolve their retained
        // source rows too, including duplicate topic aliases in existing files.
        for (const fact of (await storedFacts(scope, policy))) if (used.has(fact.id) || topics.includes(fact.topicId)) usedEvidence.add(evidenceKey(fact));
        const nameAllowed = !(await db.prepare("SELECT 1 FROM player_probe_attempts WHERE scope=? AND session=? AND topic='name-check' AND state='played'").get(scope, hash(owner)));
        return { ticket: requestId, reason: 'reserved', memories: (await facts(scope, policy)).filter(row => row.notBefore <= now() && !used.has(row.id) && !topics.includes(row.topicId) && !usedEvidence.has(evidenceKey(row))).slice(0, 5),
          recentTopics: topics.slice(-20), nameAllowed, memoryRevision };
      }));
    },
    async current(input, options) {
      const { scope } = (await scopeFor(input));
      return (await transaction(async () => { (await prune()); return Boolean((await current(scope, options.ticket, options.policy, options.revision, options.owner, options.tab, options.quiet))); }));
    },
    async generated(input, ticket, choice) {
      const { scope } = (await scopeFor(input));
      return (await transaction(async () => {
        const row = (await attempt(scope, ticket)); if (!row || row.state !== 'reserved') (await fail('stale_probe'));
        const seen = (await db.prepare("SELECT text FROM player_probe_attempts WHERE scope=? AND state='played' AND played>?").all(scope, now() - 30 * DAY));
        const repeated = choice.speak && seen.some(item => normalize(item.text) === normalize(choice.text));
        const state = repeated ? 'repeated' : choice.speak ? 'generated' : 'silence';
        const evidence = (await db.prepare('SELECT * FROM player_probe_facts WHERE scope=?').all(scope)).map(factView)
          .filter(fact => choice.memoryIds.includes(fact.id)).map(evidenceKey);
        (await db.prepare('UPDATE player_probe_attempts SET state=?,text=?,topic=?,memories=?,evidence=? WHERE scope=? AND id=?')
          .run(state, choice.text, choice.topicId, JSON.stringify(choice.memoryIds), JSON.stringify([...new Set(evidence)]), scope, ticket));
        (await db.prepare('UPDATE player_probe_profiles SET reason=? WHERE scope=?').run(state, scope));
        return state;
      }));
    },
    async finish(input, ticket, state) {
      if (!['cancelled', 'failed', 'playing', 'played'].includes(state)) (await fail('invalid_probe_receipt'));
      const { scope } = (await scopeFor(input));
      const row = (await attempt(scope, ticket));
      if (!row || !activeStates.includes(row.state)) return false;
      if ((state === 'played' && row.state !== 'playing') || (state === 'playing' && !['generated','playing'].includes(row.state))) (await fail('invalid_probe_receipt'));
      const commitReceipt = async () => {
        // Recheck inside the write transaction, including cancellation by another process.
        const currentRow=(await attempt(scope,ticket)),profile=(await rowFor(scope));
        if(!currentRow || currentRow.state!==row.state || currentRow.epoch!==profile.epoch || currentRow.generation!==profile.generation)(await fail('stale_probe'));
        (await db.prepare('UPDATE player_probe_attempts SET state=?,played=? WHERE scope=? AND id=?').run(state, state === 'played' ? now() : null, scope, ticket));
        (await db.prepare('UPDATE player_probe_profiles SET reason=? WHERE scope=?').run(state, scope));
      };
      if (state === 'played') (await memory.playedInitiative({ ...input, text: row.text, expectedRevision: row.memory_revision }, commitReceipt));
      else (await transaction(commitReceipt));
      return true;
    },
    async inspect(input, policy) {
      const { scope } = (await scopeFor(input)); (await prune()); const profile = (await ensure(scope));
      const latest = (await db.prepare('SELECT id,state,started,played,topic FROM player_probe_attempts WHERE scope=? ORDER BY started DESC LIMIT 1').get(scope));
      return { facts: (await facts(scope, policy)), reason: profile.reason, latest: latest ?? null };
    },
    async forget(input, factId) {
      const { scope } = (await scopeFor(input));
      (await transaction(async () => {
        (await ensure(scope)); (await invalidate(scope));
        (await db.prepare('UPDATE player_probe_profiles SET generation=?,messages=0 WHERE scope=?').run(randomUUID(), scope));
        // Delete source material too, so a queued extractor cannot recreate a forgotten fact.
        (await db.prepare('DELETE FROM player_probe_sources WHERE scope=?').run(scope));
        if (factId) {
          const rows = (await db.prepare('SELECT * FROM player_probe_facts WHERE scope=?').all(scope)).map(factView);
          const selected = (await rows.find(fact => fact.id === factId));
          for (const fact of rows) if (fact.id === factId || selected && evidenceKey(fact) === evidenceKey(selected)) {
            (await db.prepare('DELETE FROM player_probe_facts WHERE scope=? AND id=?').run(scope, fact.id));
          }
        }
        else {
          (await db.prepare('DELETE FROM player_probe_facts WHERE scope=?').run(scope));
          (await db.prepare('DELETE FROM player_probe_rounds WHERE scope=?').run(scope));
          (await db.prepare("UPDATE player_probe_attempts SET text='',memories='[]',evidence='[]' WHERE scope=?").run(scope));
        }
      }));
    },
    async message(input, requestId, text, expectedGeneration) {
      const { scope } = (await scopeFor(input));
      if (!id(requestId) || typeof text !== 'string' || !text.trim() || text.length > 1000) (await fail('invalid_memory_source'));
      return (await transaction(async () => {
        const profile=(await ensure(scope));
        if(expectedGeneration!==undefined && profile.generation!==expectedGeneration)return false;
        const inserted = (await db.prepare('INSERT OR IGNORE INTO player_probe_sources VALUES(?,?,?,?)').run(scope, requestId, text, now())).changes;
        if (inserted) (await db.prepare('UPDATE player_probe_profiles SET messages=messages+1 WHERE scope=?').run(scope));
        // Retire only evidence related to an actual correction/denial. A casual
        // "not sure" or question must never wipe unrelated player memories.
        const retired = inserted ? correctedFacts(text, (await db.prepare('SELECT * FROM player_probe_facts WHERE scope=?').all(scope)).map(factView)) : [];
        if (retired.length) {
          for (const fact of retired) {
            (await db.prepare('DELETE FROM player_probe_facts WHERE scope=? AND id=?').run(scope, fact.id));
            (await db.prepare('DELETE FROM player_probe_sources WHERE scope=? AND id=? AND id<>?').run(scope, fact.source.messageId, requestId));
          }
          // Queued extraction cannot recreate the old assertion after correction.
          (await db.prepare('UPDATE player_probe_profiles SET generation=? WHERE scope=?').run(randomUUID(), scope));
        }
        (await db.prepare('DELETE FROM player_probe_sources WHERE scope=? AND id NOT IN (SELECT id FROM player_probe_sources WHERE scope=? ORDER BY created DESC,id LIMIT 30)').run(scope, scope));
      }));
    },
    async extraction(input, policy) {
      if (!policy.memoryEnabled) return null;
      const { scope } = (await scopeFor(input));
      return (await transaction(async () => {
        (await prune()); const profile = (await ensure(scope));
        if (profile.messages < 8 || profile.extraction_at > now() - 60000) return null;
        (await db.prepare('UPDATE player_probe_profiles SET messages=0,extraction_at=? WHERE scope=?').run(now(), scope));
        return { generation: profile.generation, epoch: profile.epoch,
          sources: (await db.prepare('SELECT id,text,created AS createdAt FROM player_probe_sources WHERE scope=? ORDER BY created DESC,id LIMIT 30').all(scope)).reverse() };
      }));
    },
    async saveExtraction(input, job, proposals, policy) {
      const { scope } = (await scopeFor(input));
      return (await transaction(async () => {
        (await prune()); const profile = (await ensure(scope));
        if (profile.generation !== job.generation || profile.epoch !== job.epoch) return false;
        if (!Array.isArray(proposals) || proposals.length > 5) (await fail('invalid_memory_extraction'));
        for (const fact of proposals) {
          const source = (await job.sources.find(row => row.id === fact.sourceId));
          if (!source || !id(fact.topicId) || typeof fact.quote !== 'string' || !fact.quote.trim() || fact.quote.length>550 || !source.text.includes(fact.quote)
            || typeof fact.content !== 'string' || !fact.content.trim() || fact.content.length > 300) (await fail('invalid_memory_extraction'));
          // Store the quoted assertion verbatim; generated summaries are not a new fact.
          if (/[?"“”]/u.test(fact.quote) || /\b(wish|if|maybe|not|never|don't|didn't|inte|aldrig|önskar|kanske)\b/i.test(fact.quote)
            || !/\b(I|my|I'm|I've|we|our|jag|min|mitt|mina|vi|vår)\b/i.test(fact.quote)) continue;
          const expires = Math.min(source.createdAt + policy.memoryDays * DAY, Number.isSafeInteger(fact.expiresAt) ? fact.expiresAt : Infinity);
          const duration = fact.quote.match(/\b(?:for|borta|i)\s+(\d{1,3})\s*(days?|dagar|weeks?|veckor)\b/i);
          const durationMs = duration ? Number(duration[1]) * (/week|veck/i.test(duration[2]) ? 7 : 1) * DAY : 0;
          const notBefore = Math.max(Number.isSafeInteger(fact.notBefore) ? fact.notBefore : 0, durationMs ? source.createdAt+durationMs : 0);
          if (expires <= now() || notBefore >= expires) continue;
          (await remember(scope, { id: `memory-${hash([fact.topicId, source.id, fact.quote]).slice(0,24)}`, topicId: fact.topicId, type: 'player',
            content: `Player said: ${fact.quote}`, source: { kind: 'player-message', messageId: source.id, quote: fact.quote, at: source.createdAt },
            createdAt: source.createdAt, expiresAt: expires, notBefore }, policy.maxFacts));
        }
        return true;
      }));
    },
    async completedRound(input, { roundId, sequence, hands }, policy, expectedGeneration) {
      if (!policy.memoryEnabled || !id(roundId) || !Number.isSafeInteger(sequence) || !Array.isArray(hands)) return;
      const { scope } = (await scopeFor(input));
      // Only caller-supplied *server snapshots after collection* enter this method.
      // A split or multiple boxes break the single-hand consecutive-win sequence.
      if (hands.some(hand => !['win','blackjack','push','lose'].includes(hand.outcome) || !Array.isArray(hand.cards)
        || hand.cards.some(card => card.faceDown || !['A','2','3','4','5','6','7','8','9','10','J','Q','K'].includes(card.r) || !['♠','♥','♦','♣'].includes(card.s)))) return;
      (await transaction(async () => {
        (await prune());const profile=(await ensure(scope));
        if(expectedGeneration!==undefined && profile.generation!==expectedGeneration)return false;
        const changed = (await db.prepare('INSERT OR IGNORE INTO player_probe_rounds VALUES(?,?,?,?,?)').run(scope, roundId, sequence, JSON.stringify(hands), now())).changes;
        if (!changed) return;
        const rounds = (await db.prepare('SELECT * FROM player_probe_rounds WHERE scope=? ORDER BY sequence DESC LIMIT 2').all(scope));
        const win = row => { const rows = JSON.parse(row.hands); return rows.length === 1 && !rows[0].split && rows[0].cards.length === 2 && ['win','blackjack'].includes(rows[0].outcome) ? rows[0] : null; };
        const [a,b] = rounds.map(win);
        const signature = hand => hand.cards.map(card => `${card.r}${card.s}`).sort().join(' ');
        if (!a || !b || rounds[0].sequence !== rounds[1].sequence+1 || signature(a) !== signature(b) || !a.cards.some(card => card.r === 'A') || !a.cards.some(card => ['10','J','Q','K'].includes(card.r))) return;
        (await remember(scope, { id: `hand-${hash(rounds.map(row=>row.id)).slice(0,24)}`, type: 'hand', topicId: `double-win-${hash(signature(a)).slice(0,16)}`,
          content: `Two consecutive collected rounds each had exactly one hand, winning with ${signature(a)}.`,
          source: { kind: 'completed-server-hands', rounds: rounds.reverse().map(row => ({ roundId: row.id, sequence: row.sequence, hands: JSON.parse(row.hands), completedAt: row.completed })) },
          createdAt: now(), expiresAt: now() + policy.memoryDays * DAY }, policy.maxFacts));
      }));
    },
  };
}
