import { createHash, randomUUID } from 'node:crypto';
import { projectConversationMemory } from '../open-claw/lab/src/conversation-memory.mjs';

const DAY = 86400000;
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normalize = text => text.toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]/gu, '');
const fail = code => { throw Object.assign(new Error(code), { code, statusCode: 409 }); };
const activeStates = ['reserved', 'generated', 'playing'];

// All identities come from the existing authenticated chat-memory service.
// A persistent activity epoch invalidates pending work across processes/restarts.
export function createPlayerProbeStore(db, memory, { now = Date.now, random = Math.random } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS player_probe_profiles (
      scope TEXT PRIMARY KEY, epoch INTEGER NOT NULL, generation TEXT NOT NULL,
      activity INTEGER NOT NULL, sampled INTEGER, policy TEXT, reason TEXT NOT NULL,
      messages INTEGER NOT NULL DEFAULT 0, extraction_at INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS player_probe_sessions (
      scope TEXT NOT NULL, session TEXT NOT NULL, tab TEXT NOT NULL, seen INTEGER NOT NULL, flags TEXT NOT NULL,
      PRIMARY KEY(scope, session, tab));
    CREATE TABLE IF NOT EXISTS player_probe_attempts (
      scope TEXT NOT NULL, id TEXT NOT NULL, epoch INTEGER NOT NULL, generation TEXT NOT NULL,
      session TEXT NOT NULL, tab TEXT NOT NULL, policy TEXT NOT NULL, started INTEGER NOT NULL,
      state TEXT NOT NULL, text TEXT NOT NULL DEFAULT '', topic TEXT NOT NULL DEFAULT '',
      memories TEXT NOT NULL DEFAULT '[]', played INTEGER, memory_revision TEXT NOT NULL,
      PRIMARY KEY(scope,id));
    CREATE TABLE IF NOT EXISTS player_probe_sources (
      scope TEXT NOT NULL, id TEXT NOT NULL, text TEXT NOT NULL, created INTEGER NOT NULL,
      PRIMARY KEY(scope,id));
    CREATE TABLE IF NOT EXISTS player_probe_facts (
      scope TEXT NOT NULL, id TEXT NOT NULL, topic TEXT NOT NULL, type TEXT NOT NULL,
      content TEXT NOT NULL, source TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL,
      not_before INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(scope,id));
    CREATE TABLE IF NOT EXISTS player_probe_rounds (
      scope TEXT NOT NULL, id TEXT NOT NULL, sequence INTEGER NOT NULL, hands TEXT NOT NULL,
      completed INTEGER NOT NULL, PRIMARY KEY(scope,id));
    CREATE INDEX IF NOT EXISTS player_probe_attempt_age ON player_probe_attempts(scope,started);
  `);
  const transaction = work => {
    db.exec('BEGIN IMMEDIATE');
    try { const value = work(); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const scopeFor = input => {
    const profile = memory.profile(input);
    return { scope: `${profile.playerRef}:${profile.dealerId}`, revision: profile.revision };
  };
  const rowFor = scope => db.prepare('SELECT * FROM player_probe_profiles WHERE scope=?').get(scope);
  function ensure(scope) {
    db.prepare('INSERT OR IGNORE INTO player_probe_profiles(scope,epoch,generation,activity,reason) VALUES(?,0,?,?,?)')
      .run(scope, randomUUID(), now(), 'inactive');
    return rowFor(scope);
  }
  function prune() {
    const at = now();
    db.prepare('DELETE FROM player_probe_facts WHERE expires<=?').run(at);
    db.prepare('DELETE FROM player_probe_sources WHERE created<=?').run(at - 30 * DAY);
    db.prepare('DELETE FROM player_probe_rounds WHERE completed<=?').run(at - 30 * DAY);
    db.prepare('DELETE FROM player_probe_attempts WHERE started<=?').run(at - 31 * DAY);
    db.prepare('DELETE FROM player_probe_sessions WHERE seen<=?').run(at - DAY);
    db.prepare("UPDATE player_probe_attempts SET state='interrupted' WHERE state IN ('reserved','generated','playing') AND started<=?").run(at - 360000);
  }
  function invalidate(scope, reason = 'cancelled') {
    db.prepare("UPDATE player_probe_attempts SET state=? WHERE scope=? AND state IN ('reserved','generated','playing')").run(reason, scope);
    db.prepare('UPDATE player_probe_profiles SET sampled=CASE WHEN sampled IS NULL THEN NULL ELSE epoch+1 END, epoch=epoch+1, reason=? WHERE scope=?').run(reason, scope);
  }
  function remember(scope, fact, maxFacts) {
    db.prepare('DELETE FROM player_probe_facts WHERE scope=? AND topic=?').run(scope, fact.topicId);
    db.prepare('INSERT INTO player_probe_facts VALUES(?,?,?,?,?,?,?,?,?)').run(scope, fact.id, fact.topicId, fact.type,
      fact.content, JSON.stringify(fact.source), fact.createdAt, fact.expiresAt, fact.notBefore ?? 0);
    db.prepare('DELETE FROM player_probe_facts WHERE scope=? AND id NOT IN (SELECT id FROM player_probe_facts WHERE scope=? ORDER BY created DESC,id LIMIT ?)').run(scope, scope, maxFacts);
  }
  const factView = row => ({ id: row.id, topicId: row.topic, type: row.type, content: row.content,
    source: JSON.parse(row.source), createdAt: row.created, expiresAt: row.expires, notBefore: row.not_before });
  function facts(scope, policy) {
    return policy.memoryEnabled ? db.prepare('SELECT * FROM player_probe_facts WHERE scope=? AND expires>? AND created>? ORDER BY created DESC,id LIMIT ?')
      .all(scope, now(), now() - policy.memoryDays * DAY, policy.maxFacts).map(factView) : [];
  }
  const attempt = (scope, requestId) => db.prepare('SELECT * FROM player_probe_attempts WHERE scope=? AND id=?').get(scope, requestId);
  const policyKey = (policy, revision) => hash([policy, revision]);
  function syncPolicy(scope, policy, revision) {
    const key = policyKey(policy, revision);
    if (ensure(scope).policy !== key) {
      invalidate(scope);
      // A policy edit invalidates work but does not create a new activity opportunity.
      db.prepare('UPDATE player_probe_profiles SET policy=?, sampled=CASE WHEN sampled IS NULL THEN NULL ELSE epoch END WHERE scope=?').run(key, scope);
    }
    return key;
  }
  function presence(scope, owner, tab) {
    const session = db.prepare('SELECT * FROM player_probe_sessions WHERE scope=? AND session=? AND tab=?').get(scope, hash(owner), tab);
    if (!session || session.seen < now() - 15000) return 'absent';
    const flags = JSON.parse(session.flags);
    if (!flags.present) return 'absent';
    if (!flags.enabled || !flags.sound) return 'muted';
    if (!flags.quiet || flags.typing) return 'quiet';
    const other = db.prepare('SELECT flags FROM player_probe_sessions WHERE scope=? AND seen>?').all(scope, now() - 15000);
    if (other.some(row => { const flag = JSON.parse(row.flags); return flag.present && (flag.typing || !flag.quiet); })) return 'quiet';
    return null;
  }
  function current(scope, ticket, policy, revision, owner, tab, quiet) {
    const key = syncPolicy(scope, policy, revision);
    const row = attempt(scope, ticket), profile = rowFor(scope);
    return row && activeStates.includes(row.state) && row.epoch === profile.epoch && row.generation === profile.generation
      && row.policy === key && row.session === hash(owner) && row.tab === tab && policy.mode === 'automatic'
      && quiet && row.started > now() - 360000 && !presence(scope, owner, tab);
  }
  prune();
  return {
    generation(input) { const {scope}=scopeFor(input);return ensure(scope).generation; },
    conversation(input, policy) {
      const { scope } = scopeFor(input);
      prune();
      // Proactive cooldown/notBefore only govern unsolicited initiatives. A
      // player may discuss a future trip or a recently discussed memory now.
      return { scope, generation: ensure(scope).generation, policy,
        context: projectConversationMemory(facts(scope, policy), now()) };
    },
    conversationCurrent(input, snapshot) {
      const { scope } = scopeFor(input);
      if (scope !== snapshot.scope || ensure(scope).generation !== snapshot.generation) return false;
      const current = projectConversationMemory(facts(scope, snapshot.policy), now());
      return snapshot.context.facts.every(fact => current.facts.some(row => row.id === fact.id && hash(row) === hash(fact)));
    },
    isPresent(input, owner, tab) { return !presence(scopeFor(input).scope, owner, tab); },
    activity(input) {
      const { scope } = scopeFor(input);
      return transaction(() => { ensure(scope); invalidate(scope); db.prepare('UPDATE player_probe_profiles SET activity=?, sampled=NULL,reason=? WHERE scope=?').run(now(), 'inactive', scope); });
    },
    observe(input, { owner, tab, flags, activity = false, policy, revision }) {
      if (!id(tab) || typeof owner !== 'string' || !owner) fail('invalid_probe_session');
      if (!flags || ['present', 'quiet', 'typing', 'enabled', 'sound'].some(key => typeof flags[key] !== 'boolean')
        || Object.keys(flags).length !== 5) fail('invalid_probe_presence');
      const { scope } = scopeFor(input);
      return transaction(() => {
        prune(); ensure(scope); syncPolicy(scope, policy, revision);
        db.prepare('INSERT INTO player_probe_sessions VALUES(?,?,?,?,?) ON CONFLICT(scope,session,tab) DO UPDATE SET seen=excluded.seen,flags=excluded.flags')
          .run(scope, hash(owner), tab, now(), JSON.stringify(flags));
        if (activity) { invalidate(scope); db.prepare('UPDATE player_probe_profiles SET activity=?,sampled=NULL,reason=? WHERE scope=?').run(now(), 'inactive', scope); }
        else if (presence(scope, owner, tab)) invalidate(scope);
        return { reason: rowFor(scope).reason };
      });
    },
    reserve(input, { requestId, owner, tab, policy, revision, quiet }) {
      if (!id(requestId)) fail('invalid_probe_request');
      const { scope, revision: memoryRevision } = scopeFor(input);
      return transaction(() => {
        prune(); const key = syncPolicy(scope, policy, revision), profile = rowFor(scope);
        const refuse = reason => { db.prepare('UPDATE player_probe_profiles SET reason=? WHERE scope=?').run(reason, scope); return { reason }; };
        if (policy.mode !== 'automatic') return refuse(policy.mode);
        if (attempt(scope, requestId)) return refuse('sampled');
        const blocked = presence(scope, owner, tab);
        if (blocked || !quiet) return refuse(blocked ?? 'quiet');
        if (now() - profile.activity < policy.inactivityMs) return refuse('inactive');
        if (db.prepare("SELECT 1 FROM player_probe_attempts WHERE scope=? AND state IN ('reserved','generated','playing')").get(scope)) return refuse('busy');
        if (profile.sampled === profile.epoch) return refuse('sampled');
        const last = db.prepare('SELECT started FROM player_probe_attempts WHERE scope=? ORDER BY started DESC LIMIT 1').get(scope);
        if (last && now() - last.started < policy.cooldownMs) return refuse('cooldown');
        if (db.prepare('SELECT COUNT(*) AS n FROM player_probe_attempts WHERE scope=? AND started>?').get(scope, now() - 3600000).n >= policy.maxPerHour) return refuse('hourly');
        db.prepare('UPDATE player_probe_profiles SET sampled=epoch WHERE scope=?').run(scope);
        if (random() >= policy.probability) return refuse('chance');
        db.prepare('INSERT INTO player_probe_attempts(scope,id,epoch,generation,session,tab,policy,started,state,memory_revision) VALUES(?,?,?,?,?,?,?,?,?,?)')
          .run(scope, requestId, profile.epoch, profile.generation, hash(owner), tab, key, now(), 'reserved', memoryRevision);
        const recent = db.prepare("SELECT topic,memories,text FROM player_probe_attempts WHERE scope=? AND state='played' AND played>?")
          .all(scope, now() - policy.anecdoteCooldownDays * DAY);
        const used = new Set(recent.flatMap(row => JSON.parse(row.memories)));
        const topics = [...new Set(recent.map(row => row.topic))];
        const nameAllowed = !db.prepare("SELECT 1 FROM player_probe_attempts WHERE scope=? AND session=? AND topic='name-check' AND state='played'").get(scope, hash(owner));
        return { ticket: requestId, reason: 'reserved', memories: facts(scope, policy).filter(row => row.notBefore <= now() && !used.has(row.id) && !topics.includes(row.topicId)).slice(0, 5),
          recentTopics: topics.slice(-20), nameAllowed, memoryRevision };
      });
    },
    current(input, options) {
      const { scope } = scopeFor(input);
      return transaction(() => { prune(); return Boolean(current(scope, options.ticket, options.policy, options.revision, options.owner, options.tab, options.quiet)); });
    },
    generated(input, ticket, choice) {
      const { scope } = scopeFor(input);
      return transaction(() => {
        const row = attempt(scope, ticket); if (!row || row.state !== 'reserved') fail('stale_probe');
        const seen = db.prepare("SELECT text FROM player_probe_attempts WHERE scope=? AND state='played' AND played>?").all(scope, now() - 30 * DAY);
        const repeated = choice.speak && seen.some(item => normalize(item.text) === normalize(choice.text));
        const state = repeated ? 'repeated' : choice.speak ? 'generated' : 'silence';
        db.prepare('UPDATE player_probe_attempts SET state=?,text=?,topic=?,memories=? WHERE scope=? AND id=?')
          .run(state, choice.text, choice.topicId, JSON.stringify(choice.memoryIds), scope, ticket);
        db.prepare('UPDATE player_probe_profiles SET reason=? WHERE scope=?').run(state, scope);
        return state;
      });
    },
    finish(input, ticket, state) {
      if (!['cancelled', 'failed', 'playing', 'played'].includes(state)) fail('invalid_probe_receipt');
      const { scope } = scopeFor(input);
      const row = attempt(scope, ticket);
      if (!row || !activeStates.includes(row.state)) return false;
      if ((state === 'played' && row.state !== 'playing') || (state === 'playing' && !['generated','playing'].includes(row.state))) fail('invalid_probe_receipt');
      const commitReceipt = () => {
        // Recheck inside the write transaction, including cancellation by another process.
        const currentRow=attempt(scope,ticket),profile=rowFor(scope);
        if(!currentRow || currentRow.state!==row.state || currentRow.epoch!==profile.epoch || currentRow.generation!==profile.generation)fail('stale_probe');
        db.prepare('UPDATE player_probe_attempts SET state=?,played=? WHERE scope=? AND id=?').run(state, state === 'played' ? now() : null, scope, ticket);
        db.prepare('UPDATE player_probe_profiles SET reason=? WHERE scope=?').run(state, scope);
      };
      if (state === 'played') memory.playedInitiative({ ...input, text: row.text, expectedRevision: row.memory_revision }, commitReceipt);
      else transaction(commitReceipt);
      return true;
    },
    inspect(input, policy) {
      const { scope } = scopeFor(input); prune(); const profile = ensure(scope);
      const latest = db.prepare('SELECT id,state,started,played,topic FROM player_probe_attempts WHERE scope=? ORDER BY started DESC LIMIT 1').get(scope);
      return { facts: facts(scope, policy), reason: profile.reason, latest: latest ?? null };
    },
    forget(input, factId) {
      const { scope } = scopeFor(input);
      transaction(() => {
        ensure(scope); invalidate(scope);
        db.prepare('UPDATE player_probe_profiles SET generation=?,messages=0 WHERE scope=?').run(randomUUID(), scope);
        // Delete source material too, so a queued extractor cannot recreate a forgotten fact.
        db.prepare('DELETE FROM player_probe_sources WHERE scope=?').run(scope);
        if (factId) db.prepare('DELETE FROM player_probe_facts WHERE scope=? AND id=?').run(scope, factId);
        else {
          db.prepare('DELETE FROM player_probe_facts WHERE scope=?').run(scope);
          db.prepare('DELETE FROM player_probe_rounds WHERE scope=?').run(scope);
          db.prepare("UPDATE player_probe_attempts SET text='',memories='[]' WHERE scope=?").run(scope);
        }
      });
    },
    message(input, requestId, text, expectedGeneration) {
      const { scope } = scopeFor(input);
      if (!id(requestId) || typeof text !== 'string' || !text.trim() || text.length > 1000) fail('invalid_memory_source');
      return transaction(() => {
        const profile=ensure(scope);
        if(expectedGeneration!==undefined && profile.generation!==expectedGeneration)return false;
        const inserted = db.prepare('INSERT OR IGNORE INTO player_probe_sources VALUES(?,?,?,?)').run(scope, requestId, text, now()).changes;
        if (inserted) db.prepare('UPDATE player_probe_profiles SET messages=messages+1 WHERE scope=?').run(scope);
        // A correction conservatively retires personal facts and older sources.
        // Ordinary chat preserves them and never refreshes their fixed expiry.
        if (/\b(actually|correction|instead|cancelled|canceled|not|never|don't|didn't|inte|aldrig|istället|rättelse|avbokad|ändrat)\b/i.test(text)) {
          db.prepare("DELETE FROM player_probe_facts WHERE scope=? AND type='player'").run(scope);
          // Old assertions may not be resurrected by a later extraction after a correction.
          db.prepare('DELETE FROM player_probe_sources WHERE scope=? AND id<>?').run(scope, requestId);
          db.prepare('UPDATE player_probe_profiles SET generation=? WHERE scope=?').run(randomUUID(), scope);
        }
        db.prepare('DELETE FROM player_probe_sources WHERE scope=? AND id NOT IN (SELECT id FROM player_probe_sources WHERE scope=? ORDER BY created DESC,id LIMIT 30)').run(scope, scope);
      });
    },
    extraction(input, policy) {
      if (!policy.memoryEnabled) return null;
      const { scope } = scopeFor(input);
      return transaction(() => {
        prune(); const profile = ensure(scope);
        if (profile.messages < 8 || profile.extraction_at > now() - 60000) return null;
        db.prepare('UPDATE player_probe_profiles SET messages=0,extraction_at=? WHERE scope=?').run(now(), scope);
        return { generation: profile.generation, epoch: profile.epoch,
          sources: db.prepare('SELECT id,text,created AS createdAt FROM player_probe_sources WHERE scope=? ORDER BY created DESC,id LIMIT 30').all(scope).reverse() };
      });
    },
    saveExtraction(input, job, proposals, policy) {
      const { scope } = scopeFor(input);
      return transaction(() => {
        prune(); const profile = ensure(scope);
        if (profile.generation !== job.generation || profile.epoch !== job.epoch) return false;
        if (!Array.isArray(proposals) || proposals.length > 5) fail('invalid_memory_extraction');
        for (const fact of proposals) {
          const source = job.sources.find(row => row.id === fact.sourceId);
          if (!source || !id(fact.topicId) || typeof fact.quote !== 'string' || !fact.quote.trim() || fact.quote.length>550 || !source.text.includes(fact.quote)
            || typeof fact.content !== 'string' || !fact.content.trim() || fact.content.length > 300) fail('invalid_memory_extraction');
          // Store the quoted assertion verbatim; generated summaries are not a new fact.
          if (/[?"“”]/u.test(fact.quote) || /\b(wish|if|maybe|not|never|don't|didn't|inte|aldrig|önskar|kanske)\b/i.test(fact.quote)
            || !/\b(I|my|I'm|I've|we|our|jag|min|mitt|mina|vi|vår)\b/i.test(fact.quote)) continue;
          const expires = Math.min(source.createdAt + policy.memoryDays * DAY, Number.isSafeInteger(fact.expiresAt) ? fact.expiresAt : Infinity);
          const duration = fact.quote.match(/\b(?:for|borta|i)\s+(\d{1,3})\s*(days?|dagar|weeks?|veckor)\b/i);
          const durationMs = duration ? Number(duration[1]) * (/week|veck/i.test(duration[2]) ? 7 : 1) * DAY : 0;
          const notBefore = Math.max(Number.isSafeInteger(fact.notBefore) ? fact.notBefore : 0, durationMs ? source.createdAt+durationMs : 0);
          if (expires <= now() || notBefore >= expires) continue;
          remember(scope, { id: `memory-${hash([fact.topicId, source.id, fact.quote]).slice(0,24)}`, topicId: fact.topicId, type: 'player',
            content: `Player said: ${fact.quote}`, source: { kind: 'player-message', messageId: source.id, quote: fact.quote, at: source.createdAt },
            createdAt: source.createdAt, expiresAt: expires, notBefore }, policy.maxFacts);
        }
        return true;
      });
    },
    completedRound(input, { roundId, sequence, hands }, policy, expectedGeneration) {
      if (!policy.memoryEnabled || !id(roundId) || !Number.isSafeInteger(sequence) || !Array.isArray(hands)) return;
      const { scope } = scopeFor(input);
      // Only caller-supplied *server snapshots after collection* enter this method.
      // A split or multiple boxes break the single-hand consecutive-win sequence.
      if (hands.some(hand => !['win','blackjack','push','lose'].includes(hand.outcome) || !Array.isArray(hand.cards)
        || hand.cards.some(card => card.faceDown || !['A','2','3','4','5','6','7','8','9','10','J','Q','K'].includes(card.r) || !['♠','♥','♦','♣'].includes(card.s)))) return;
      transaction(() => {
        prune();const profile=ensure(scope);
        if(expectedGeneration!==undefined && profile.generation!==expectedGeneration)return false;
        const changed = db.prepare('INSERT OR IGNORE INTO player_probe_rounds VALUES(?,?,?,?,?)').run(scope, roundId, sequence, JSON.stringify(hands), now()).changes;
        if (!changed) return;
        const rounds = db.prepare('SELECT * FROM player_probe_rounds WHERE scope=? ORDER BY sequence DESC LIMIT 2').all(scope);
        const win = row => { const rows = JSON.parse(row.hands); return rows.length === 1 && !rows[0].split && rows[0].cards.length === 2 && ['win','blackjack'].includes(rows[0].outcome) ? rows[0] : null; };
        const [a,b] = rounds.map(win);
        const signature = hand => hand.cards.map(card => `${card.r}${card.s}`).sort().join(' ');
        if (!a || !b || rounds[0].sequence !== rounds[1].sequence+1 || signature(a) !== signature(b) || !a.cards.some(card => card.r === 'A') || !a.cards.some(card => ['10','J','Q','K'].includes(card.r))) return;
        remember(scope, { id: `hand-${hash(rounds.map(row=>row.id)).slice(0,24)}`, type: 'hand', topicId: `double-win-${hash(signature(a)).slice(0,16)}`,
          content: `Two consecutive collected rounds each had exactly one hand, winning with ${signature(a)}.`,
          source: { kind: 'completed-server-hands', rounds: rounds.reverse().map(row => ({ roundId: row.id, sequence: row.sequence, hands: JSON.parse(row.hands), completedAt: row.completed })) },
          createdAt: now(), expiresAt: now() + policy.memoryDays * DAY }, policy.maxFacts);
      });
    },
  };
}
