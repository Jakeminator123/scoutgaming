// The roulette dealer's chat (Emil 1 Nov): one Gemini call per player message, like the blackjack chat, but built so the
// dealer feels like a real person at the wheel instead of a story machine.
//   - Always sent (stable, so Gemini caches it): the shared rules, the roulette facts, the dealer's core and style examples
//     (roulette-personas/<dealer>/).
//   - Sent per message: the table right now, the player (name, visits, at most three remembered notes that fit the message,
//     the stories they already heard), the recent table chat, and 0-2 entries from the dealer's life (lore.json) ONLY when the
//     chat touches that topic. Most replies get no story at all.
//   - Memory builds on the blackjack's dealer-memory.mjs (same table, same dealer id, so the dealer remembers a player across
//     both games). The only addition is which stories each player has heard (table roulette_lore_heard in the same file).
//   - Every reply passes the blackjack's guard (dealer-chat.mjs) plus a roulette guard before anyone sees it.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { createDealerMemory } from './dealer-memory.mjs';
import { guardReply } from './dealer-chat.mjs';

const LANGS = { sv: 'Swedish', en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Brazilian Portuguese', ko: 'Korean', fi: 'Finnish', it: 'Italian' };
// Roulette talk that must never pass: predictions and "due" numbers (the blackjack guard covers advice, pressure and money).
// Also the soft invitations to keep playing that a model likes to end on ("let's see if…", "good luck on the next spin").
const ROULETTE_BLOCK = /\b(is due|are due|due to (come|hit)|on its way|bound to (come|hit)|will (come|hit|land) (up |in )?(next|soon)|next (number|spin) (is|will)|(bet|put (it|your chips)?) on \d|feeling lucky|lucky number for you|my tip|let'?s see (if|where|what|how)|good luck|fingers crossed|good (energy|vibes)|bring (you|me) (the |some )?luck|(the|this|your) next spin|next round|on a (\w+ ){0,2}roll|(winning|lucky|hot) streak|streak)\b/i;
const OFFER = /\b(if you want it|what'?s your next (number|bet|pick)|your next (number|bet|pick)|great (hit|win)|big win|huge win)\b/i;
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu;
// The two cases that never go to the model. Narrower than the blackjack's localResponse, which in a chatty roulette room
// caught "fika breaks", "break my heart" and "lost this round" (simulation 1 Nov): only real distress and real personal data.
const DISTRESS = /\b(lost everything|lost all my|last (of my )?money|rent money|can'?t stop|cannot stop|unable to stop|addict(ed|ion)?|in debt|my debts?|borrow(ed|ing)? (money|to play)|take a loan|loan to (play|gamble)|win (it|my money) (all )?back|chasing (my )?loss|suicid|kill myself|end it all|(i'?m|i am|im) 1[0-7]\b|underage|förlorat allt|kan inte sluta|spelberoende|skulder|låna pengar|vinna tillbaka)/i;
const PERSONAL = /[\w.+-]+@[\w-]+\.[\w.]+|https?:\/\/|\+?\d[\d\s-]{7,}\d|\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b|\b(?:\d[ -]?){13,19}\b/i;
const localCase = (s) => (DISTRESS.test(s) ? 'support' : PERSONAL.test(s) ? 'privacy' : null);
// Reviewed lines for the two cases that never go to the model.
const FIXED = {
  support: 'I hear you. Let\'s slow down for a moment: "Take a break" is in the menu, and the help links are in the game information.',
  privacy: 'Better keep personal details out of the chat. Everyone at the table can read it.',
  fallback: 'Ha, you\'ve got me there. Give me a second while I keep this wheel in line.',
};
const OUT_SCHEMA = { type: 'OBJECT', properties: {
  say: { type: 'STRING', description: 'What you say to the player, in character.' },
  memory: { type: 'STRING', description: 'One short thing worth remembering about this player next time (nickname, what they like, a running joke), or "none". Never money, wins, losses or personal data.' },
  lore_used: { type: 'STRING', description: 'The id of the YOUR LIFE entry you used, or "none".' },
}, required: ['say', 'memory', 'lore_used'] };

const DEFAULT_NAME = /^(guest|visitor|player|friend|newcomer|regular)\s*\d+$/i;
const words = (s) => new Set(String(s).toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []);
const keyRe = (k) => new RegExp(`(?:^|[^\\p{L}\\p{N}])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu');
// a question about the dealer herself (then one general 'about' entry may be offered even without a topic word)
const ABOUT_ME = /\b(about you|about yourself|who are you|where are you from|where do you live|your (life|story|past|background|family|home|childhood))\b/i;

export function loadPersona(dir, dealer) {
  const rd = (...p) => readFileSync(path.join(dir, ...p), 'utf8').trim();
  const lore = JSON.parse(rd(dealer, 'lore.json')).entries.map((e) => ({ ...e, re: e.keys.map(keyRe) }));
  const name = /You are (\p{L}+)/u.exec(rd(dealer, 'core.md'))?.[1] ?? 'Dealer';
  return { name, lore, system: [rd(dealer, 'core.md'), rd('_shared', 'rules.md'), rd('_shared', 'roulette.md'), rd(dealer, 'examples.md'),
    'Answer with JSON: {"say": ..., "memory": ..., "lore_used": ...}.'].join('\n\n') };
}

export function createRouletteChat({ personasDir, memoryFile, apiKey, model = 'gemini-3.6-flash', fallbackModel = 'gemini-3.5-flash-lite', thinking = 'minimal', temperature = 0.9,
  fetchImpl = fetch, timeoutMs = 12000, random = Math.random, loreCooldown = 40 }) {
  const memory = createDealerMemory(memoryFile);
  const db = new DatabaseSync(memoryFile);
  db.exec(`CREATE TABLE IF NOT EXISTS roulette_lore_heard (visitor TEXT NOT NULL, dealer TEXT NOT NULL, lore TEXT NOT NULL, at INTEGER NOT NULL,
    PRIMARY KEY (visitor, dealer, lore))`);
  const personas = new Map(), tables = new Map();
  const persona = (d) => personas.get(d) ?? personas.set(d, loadPersona(personasDir, d)).get(d);
  const table = (id) => tables.get(id) ?? tables.set(id, { history: [], turn: 0, loreAt: new Map() }).get(id);
  let thinkingOk = true;

  // What the dealer knows about this player: Kevin's row, read as it is, plus the stories they heard.
  function player(visitor, dealer) {
    const row = visitor ? db.prepare('SELECT name, visits, last_seen, notes, lines FROM dealer_memory WHERE visitor=? AND dealer=?').get(visitor, dealer) : null;
    const heard = visitor ? db.prepare('SELECT lore FROM roulette_lore_heard WHERE visitor=? AND dealer=?').all(visitor, dealer).map((r) => r.lore) : [];
    return { row, notes: row ? JSON.parse(row.notes) : [], lines: row ? JSON.parse(row.lines) : [], heard };
  }
  // At most three notes: the ones that share words with the message, now and then one other (a running joke resurfacing).
  function pickNotes(notes, text) {
    const w = words(text), scored = notes.map((n, i) => ({ n, s: [...words(n)].filter((x) => w.has(x)).length, i })).filter((x) => x.s > 0);
    const out = scored.sort((a, b) => b.s - a.s || b.i - a.i).slice(0, 3).map((x) => x.n);
    const rest = notes.filter((n) => !out.includes(n));
    if (out.length < 3 && rest.length && random() < 0.15) out.push(rest[Math.floor(random() * rest.length)]);
    return out;
  }
  // 0-2 life entries: only on topic, never one this player heard, not again at this table within loreCooldown messages.
  function pickLore(p, t, text, heard) {
    const scan = [text, ...t.history.slice(-2).map((h) => h.text)].join(' \n ');
    const free = (e) => !heard.includes(e.id) && !(t.loreAt.has(e.id) && t.turn - t.loreAt.get(e.id) < loreCooldown);
    const hits = p.lore.map((e) => ({ e, s: e.re.filter((r) => r.test(text)).length * 2 + e.re.filter((r) => r.test(scan)).length })).filter((x) => x.s > 0 && free(x.e));
    hits.sort((a, b) => b.s - a.s);
    const out = hits.slice(0, 2).map((x) => x.e);
    if (!out.length && ABOUT_ME.test(text)) { const a = p.lore.find((e) => e.about && free(e)); if (a) out.push(a); }
    return out;
  }

  // the main model, and once the fallback model if the main one fails (quota, outage, a key without access)
  async function ask(p, prompt, retry, m = model) {
    const body = { systemInstruction: { parts: [{ text: p.system }] },
      contents: [{ role: 'user', parts: [{ text: prompt + (retry ? '\n\nSay it differently this time: no betting talk at all, just a light, warm joke.' : '') }] }],
      generationConfig: { temperature, maxOutputTokens: 300, responseMimeType: 'application/json', responseSchema: OUT_SCHEMA,
        ...(thinking && thinkingOk ? { thinkingConfig: { thinkingLevel: thinking } } : {}) } };
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(body), signal: ctl.signal });
      const j = await r.json();
      if (r.status === 400 && thinkingOk && /thinking/i.test(j.error?.message ?? '')) { thinkingOk = false; return ask(p, prompt, retry, m); }
      if (!r.ok) return fallbackModel && m !== fallbackModel ? ask(p, prompt, retry, fallbackModel) : { error: `${r.status} ${j.error?.message ?? ''}`.slice(0, 200) };
      const raw = (j.candidates?.[0]?.content?.parts ?? []).filter((x) => !x.thought).map((x) => x.text).join('');
      return { out: JSON.parse(raw), usage: j.usageMetadata ?? null };
    } catch (e) { return fallbackModel && m !== fallbackModel && e.name !== 'SyntaxError' ? ask(p, prompt, retry, fallbackModel) : { error: String(e.message ?? e).slice(0, 200) }; } finally { clearTimeout(timer); }
  }

  /** One player message -> the dealer's reply. state: { phase, last: [numbers], result: 'won'|'lost'|'none' } from the game. */
  async function reply({ dealer = 'astrid2', guest = null, name = '', text, tableId = 'default', lang = 'en', state = {} }) {
    const t0 = Date.now(), p = persona(dealer), t = table(`${dealer}:${tableId}`), said = String(text ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').trim().slice(0, 280);
    const visitor = guest ? memory.key(guest) : null, me = player(visitor, dealer), asked = String(name ?? '').trim().slice(0, 24);
    // a default name ("Guest 123", as the blackjack hands out) never overwrites the name the dealer remembers: she uses that one
    const who = (!asked || DEFAULT_NAME.test(asked)) && me.row?.name && !DEFAULT_NAME.test(me.row.name) ? me.row.name : asked || 'Guest';
    const done = (say, extra = {}) => {
      t.history.push({ who, text: said }, { who: p.name, text: say }); t.history = t.history.slice(-12); t.turn++;
      if (visitor) memory.remember(visitor, dealer, { name: who, said, reply: say, note: extra.note });
      if (visitor && extra.lore) db.prepare('INSERT OR IGNORE INTO roulette_lore_heard (visitor, dealer, lore, at) VALUES (?,?,?,?)').run(visitor, dealer, extra.lore, Date.now());
      if (extra.lore) t.loreAt.set(extra.lore, t.turn);
      return { text: say, lore: extra.lore ?? null, note: extra.note ?? null, ms: Date.now() - t0, usage: extra.usage ?? null, fixed: extra.fixed ?? null, error: extra.error ?? null };
    };
    if (!said) return null;
    const local = localCase(said);
    if (local) return done(FIXED[local], { fixed: local });

    const notes = pickNotes(me.notes, said), lore = pickLore(p, t, said, me.heard);
    const phase = { satsa: 'bets are open', klar: 'bets are open', las: 'no more bets, the ball is spinning', landat: 'the ball just landed', vinst: 'the round was just settled' }[state.phase] ?? 'between rounds';
    const last = (state.last ?? []).slice(0, 8).join(', ');
    const days = me.row ? Math.round((Date.now() - me.row.last_seen) / 86400000) : null;
    const prompt = [
      `Language: ${LANGS[lang] ?? 'English'}.`,
      `TABLE NOW: ${phase}.${last ? ` Last numbers (newest first): ${last}.` : ''}${state.result && state.result !== 'none' ? ` This player ${state.result} the last round (never mention amounts).` : ''}`,
      `PLAYER: ${who}. ${me.row ? `You have met before: ${me.row.visits} visit(s), last ${days ? `${days} day(s) ago` : 'today'}.` : 'First time you meet.'}` +
        (notes.length ? ` You remember: ${notes.join('; ')}. Use only if it fits naturally.` : '') +
        (me.heard.length ? ` Stories this player already heard from you (never retell them): ${me.heard.join(', ')}.` : '') +
        // their last exchanges with you (Kevin's memory keeps them), so a question asked again gets a fresh answer, or a tease
        (me.lines.length ? `\nYour last exchanges with ${who} (never repeat these answers; if they ask the same again, say so with a smile):\n${me.lines.slice(-6).map((l) => `${l.who === 'player' ? who : p.name}: ${l.text}`).join('\n')}` : ''),
      lore.length ? `YOUR LIFE, only if it fits this reply (ignore otherwise, most replies need no story):\n${lore.map((e) => `[${e.id}] ${e.text}`).join('\n')}` : 'YOUR LIFE: nothing relevant now. Do not bring up your past.',
      `RECENT CHAT AT THIS TABLE:\n${t.history.length ? t.history.map((h) => `${h.who}: ${h.text}`).join('\n') : '(quiet so far)'}`,
      `MESSAGE FROM ${who}: ${said}`,
    ].join('\n\n');

    let res = await ask(p, prompt, false), usage = res.usage, say = null;
    for (const retry of [false, true]) {
      if (retry) { res = await ask(p, prompt, true); usage = res.usage ?? usage; }
      const s = res.out?.say ? guardReply(String(res.out.say).replace(EMOJI, '').replace(/\s{2,}/g, ' ').trim()) : null;
      if (s && !ROULETTE_BLOCK.test(s) && !OFFER.test(s)) { say = s; break; }
    }
    if (!say) return done(FIXED.fallback, { fixed: 'fallback', usage, error: res.error ?? 'guard' });
    const used = lore.find((e) => e.id === String(res.out.lore_used ?? '').trim())?.id ?? null;
    const note = /^none$/i.test(String(res.out.memory ?? '').trim()) ? null : res.out.memory;
    return done(say, { lore: used, note, usage });
  }

  return { reply, player: (guest, dealer = 'astrid2') => player(guest ? memory.key(guest) : null, dealer),
    forget(guest, dealer = 'astrid2') { if (!guest) return; const v = memory.key(guest);
      db.prepare('DELETE FROM dealer_memory WHERE visitor=? AND dealer=?').run(v, dealer); db.prepare('DELETE FROM roulette_lore_heard WHERE visitor=? AND dealer=?').run(v, dealer); },
    close() { memory.close(); db.close(); } };
}
