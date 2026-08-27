#!/usr/bin/env node
// Static server with Range-request support (the engine range-fetches clip
// bytes in production; locally it serves whole files and ranges alike).
// Listens on 0.0.0.0 so phones on the LAN can open the demo.
import { createServer } from 'node:http';
import { readFileSync as readSync, writeFileSync as writeSync } from 'node:fs';
import { statSync, createReadStream, existsSync, mkdirSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'public');

// ---------- player database (demo money only) ----------
const dataDir = join(fileURLToPath(new URL('.', import.meta.url)), 'data');
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(join(dataDir, 'croupier.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'USD',
    balance REAL NOT NULL DEFAULT 1000, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, player_id TEXT NOT NULL, type TEXT NOT NULL,
    amount REAL NOT NULL, currency TEXT NOT NULL, meta TEXT, at TEXT NOT NULL
  );
`);
const RATES = { USD: 1, EUR: 0.92, SEK: 10.6 }; // fixed demo rates per USD
const logTx = (pid, type, amount, currency, meta = '') =>
  db.prepare('INSERT INTO transactions (player_id, type, amount, currency, meta, at) VALUES (?,?,?,?,?,?)')
    .run(pid, type, amount, currency, meta, new Date().toISOString());
const getPlayer = id => db.prepare('SELECT id, name, currency, balance FROM players WHERE id = ?').get(id);

function apiPlayer({ id, name }) {
  let p = id ? getPlayer(id) : undefined;
  if (!p) {
    p = { id: randomUUID(), name: (typeof name === 'string' && name.trim().slice(0, 40)) || 'Player', currency: 'USD', balance: 1000 };
    db.prepare('INSERT INTO players (id, name, currency, balance, created_at) VALUES (?,?,?,?,?)')
      .run(p.id, p.name, p.currency, p.balance, new Date().toISOString());
    logTx(p.id, 'open', p.balance, p.currency, 'starting demo balance');
  }
  return p;
}
function apiDeposit({ id, amount }) {
  const p = getPlayer(id);
  if (!p) return { error: 'no such player' };
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 1 || amt > 100_000_000) return { error: 'amount must be 1-100000000' };
  const balance = Math.round((p.balance + amt) * 100) / 100;
  db.prepare('UPDATE players SET balance = ? WHERE id = ?').run(balance, id);
  logTx(id, 'deposit', amt, p.currency, 'demo test card');
  return { balance, currency: p.currency };
}
function apiBalance({ id, balance, reason }) {
  const p = getPlayer(id);
  if (!p) return { error: 'no such player' };
  const b = Number(balance);
  if (!Number.isFinite(b) || b < 0 || b > 1_000_000_000) return { error: 'bad balance' };
  db.prepare('UPDATE players SET balance = ? WHERE id = ?').run(b, id);
  logTx(id, 'sync', Math.round((b - p.balance) * 100) / 100, p.currency, String(reason ?? '').slice(0, 80));
  return { balance: b };
}
function apiCurrency({ id, currency }) {
  const p = getPlayer(id);
  if (!p) return { error: 'no such player' };
  if (!RATES[currency]) return { error: 'currency must be USD, EUR or SEK' };
  const balance = Math.round((p.balance / RATES[p.currency]) * RATES[currency] * 100) / 100;
  db.prepare('UPDATE players SET balance = ?, currency = ? WHERE id = ?').run(balance, currency, id);
  logTx(id, 'fx', balance, currency, `converted from ${p.currency}`);
  return { balance, currency };
}
const API = { '/api/player': apiPlayer, '/api/deposit': apiDeposit, '/api/balance': apiBalance, '/api/currency': apiCurrency };

// ---------- backoffice (BO) ----------
// Real data where it exists (players/transactions from SQLite, dealer assets
// scanned from disk); a JSON store for what has no engine yet (tournaments,
// pit-boss triggers, tier->dealer assignment - the last one steers the game).
import { readdirSync } from 'node:fs';
const BO_PATH = join(dataDir, 'bo.json');
const BO_DEFAULTS = {
  tiers: { classic: 'vera', high: 'vera', vip: 'vera' },
  rooms: [
    { id: 'prive', name: 'Mahogany Privé', scene: 'Warm mahogany · sconces', felt: 'Green', dealer: 'vera', state: 'live' },
    { id: 'darkhall', name: 'Dark Hall', scene: 'Graphite · pendant bars', felt: 'Graphite', dealer: 'astrid', state: 'preview' },
    { id: 'goldensalon', name: 'Golden Salon', scene: 'Amber salon · tan felt', felt: 'Tan', dealer: 'amira', state: 'pending' },
    { id: 'azure', name: 'Azure Venue', scene: 'Curved white · cyan glow', felt: 'Petrol', dealer: 'mei', state: 'pending' },
  ],
  pitboss: { payout10x: true, streak5: true, randomWalkMin: 45 },
  tournaments: [
    { id: 't1', name: 'Midnight Privé Open', format: 'Elimination · 20 rounds', buyin: 100, pool: 25000, entries: 184, cap: 250, starts: 'Tonight 00:00', state: 'registering' },
    { id: 't2', name: 'High Roller Sprint', format: 'Points race · 1 hour', buyin: 1000, pool: 50000, entries: 31, cap: 64, starts: 'Fri 21:00', state: 'registering' },
    { id: 't3', name: 'Weekly Leaderboard #34', format: 'Cumulative points', buyin: 0, pool: 5000, entries: 1212, cap: 0, starts: 'Ends Sunday', state: 'live' },
  ],
};
function boLoad() {
  try { return { ...BO_DEFAULTS, ...JSON.parse(readSync(BO_PATH, 'utf8')) }; }
  catch { return structuredClone(BO_DEFAULTS); }
}
function boSave(cfg) { writeSync(BO_PATH, JSON.stringify(cfg, null, 1)); }
function dealerScan() {
  const out = [];
  const spec = [
    { key: 'vera', name: 'Vera', base: 'dealer', room: 'Mahogany Privé', voice: 'Vera (ElevenLabs)' },
    { key: 'astrid', name: 'Astrid', base: 'dealers/astrid', room: 'Dark Hall', voice: 'Helena (ElevenLabs)' },
    { key: 'amira', name: 'Amira', base: 'dealers/amira', room: 'Golden Salon', voice: 'Soraya (ElevenLabs)' },
    { key: 'mei', name: 'Mei', base: 'dealers/mei', room: 'Azure Venue', voice: 'Kaia (ElevenLabs)' },
  ];
  for (const d of spec) {
    let clips = 0, speak = 0, stills = false;
    try {
      const idx = JSON.parse(readSync(join(root, d.base, 'streams/index.json'), 'utf8'));
      clips = Object.keys(idx.clips).length;
      speak = Object.keys(idx.clips).filter(k => k.includes('/speak/')).length;
    } catch { /* no assets yet */ }
    try { stills = existsSync(join(root, '..', '..', 'content/persona/roster', d.key + '-canonical.png')) || d.key === 'vera'; } catch {}
    out.push({ ...d, clips, speak, stills });
  }
  return out;
}
function boApi(url) {
  const cfg = boLoad();
  if (url === '/api/bo/overview') {
    const day = new Date().toISOString().slice(0, 10);
    // game rounds arrive as balance syncs whose meta names the reason
    const tx = db.prepare("SELECT CASE WHEN type='sync' THEN meta ELSE type END AS type, COUNT(*) n, SUM(amount) sum FROM transactions WHERE at >= ? GROUP BY 1").all(day);
    const players = db.prepare('SELECT COUNT(*) n FROM players').get();
    return { tiers: cfg.tiers, rooms: cfg.rooms, tx, players: players.n, dealers: dealerScan() };
  }
  if (url === '/api/bo/players') {
    return { players: db.prepare('SELECT id, name, currency, balance, created_at FROM players ORDER BY balance DESC LIMIT 50').all() };
  }
  if (url === '/api/bo/transactions') {
    return { tx: db.prepare('SELECT player_id, type, amount, currency, meta, at FROM transactions ORDER BY id DESC LIMIT 100').all() };
  }
  if (url === '/api/bo/config') return cfg;
  if (url === '/api/bo/voicelines') {
    const out = [];
    for (const d of dealerScan()) {
      let idx = {}, bank = {};
      try { idx = JSON.parse(readSync(join(root, d.base, 'streams/index.json'), 'utf8')).clips; } catch {}
      try { bank = JSON.parse(readSync(join(root, d.base, 'audio/en/bank.json'), 'utf8')); } catch {}
      const lines = [];
      const audioDir = join(root, d.base, 'audio/en');
      let mp3s = [];
      try { mp3s = readdirSync(audioDir).filter(f => f.endsWith('.mp3')); } catch {}
      for (const f of mp3s) {
        const k = f.replace('.mp3', '');
        const clip = idx['idle-1/speak/' + k];
        const preview = existsSync(join(root, d.base, 'preview', k + '.mp4'));
        lines.push({ key: k, text: bank[k]?.text ?? '', clip: !!clip, delay: clip?.audioDelayMs ?? null,
                     preview: preview ? `/${d.base}/preview/${k}.mp4` : null,
                     audio: `/${d.base}/audio/en/${k}.mp3` });
      }
      lines.sort((a, b) => a.key.localeCompare(b.key));
      out.push({ dealer: d.key, name: d.name, lines });
    }
    return { dealers: out };
  }
  return null;
}
function boPost(url, body) {
  const cfg = boLoad();
  if (url === '/api/bo/tier') {
    const { tier, dealer } = body;
    if (!cfg.tiers[tier] || !['vera', 'astrid', 'amira', 'mei'].includes(dealer)) return { error: 'bad tier/dealer' };
    // a dealer with no playable clips cannot hold a live tier
    const base = dealer === 'vera' ? 'dealer' : 'dealers/' + dealer;
    try {
      const idx = JSON.parse(readSync(join(root, base, 'streams/index.json'), 'utf8'));
      if (!idx.clips['idle-1/idle/idle']) return { error: dealer + ' has no idle clip yet' };
    } catch { return { error: dealer + ' has no clips yet' }; }
    cfg.tiers[tier] = dealer; boSave(cfg);
    return { ok: true, tiers: cfg.tiers };
  }
  if (url === '/api/bo/pitboss') { cfg.pitboss = { ...cfg.pitboss, ...body }; boSave(cfg); return { ok: true, pitboss: cfg.pitboss }; }
  if (url === '/api/bo/tournament') {
    const t = { id: 't' + Date.now(), state: 'draft', entries: 0, ...body };
    cfg.tournaments.unshift(t); boSave(cfg); return { ok: true, tournaments: cfg.tournaments };
  }
  return null;
}
const port = Number(process.env.PORT ?? 4173);
// 0.0.0.0 locally so phones on the LAN can open the demo; behind a reverse
// proxy set HOST=127.0.0.1 so the port is not exposed publicly.
const host = process.env.HOST ?? '0.0.0.0';
// Source files change constantly while this is being built; Chrome happily
// serves a cached app.mjs for a reload, so a change looks like it did nothing.
// Media (clips, audio, art) is content-addressed enough to keep caching.
const LIVE = new Set(['.html', '.mjs', '.js', '.css', '.json']);
const noStore = file => LIVE.has(extname(file))
  ? { 'Cache-Control': 'no-store, must-revalidate', Pragma: 'no-cache', Expires: '0' }
  : {};

const MIME = {
  '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.webp': 'image/webp', '.h264': 'application/octet-stream', '.mp3': 'audio/mpeg',
  '.webm': 'video/webm', '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml',
};

// Vera's brain: the scout-hel1 headless-claude subscription via the axelio-agent
// proxy (ssh tunnel -> localhost:3100). Never an API key.
// Reach the brain over the public host by default: the :3100 form only works
// while an ssh tunnel to scout-hel1 happens to be up, and when it is not the
// chat fails closed with no way to tell why.
const AGENT_URLS = process.env.AXEL_AGENT_URL
  ? [process.env.AXEL_AGENT_URL]
  : ['http://localhost:3100/agent', 'https://scout-agent.axelio.io/agent'];
let AGENT_TOKEN = process.env.AXEL_AGENT_TOKEN ?? '';
if (!AGENT_TOKEN) {
  try {
    const env = readSync('/Users/solvifyab/Desktop/Axelio-Platform/.env', 'utf8');
    AGENT_TOKEN = env.match(/^AXEL_AGENT_TOKEN=(.+)$/m)?.[1]?.trim() ?? '';
  } catch { /* stays empty; /chat returns the canned fallback */ }
}
// plain-text answers for take ids the model remembers but that have no
// recording (spoken as caption only)
const FALLBACK_LINES = {
  rules_split: "You can split any pair here, up to four hands. Split aces take one card each, and you can double after a split.",
};

const VERA_SYSTEM = `You are Vera, the AI dealer at Scout Gaming's "Prive Blackjack" table. Character: warm, wry, unflappable; a veteran croupier who has seen everything and enjoys good company; dry one-liners, never cruel; slightly old-school manners.
Hard rules you never break, in character:
- You have NO knowledge of upcoming cards and never predict, imply or hint at outcomes.
- You never encourage continued play, chasing losses, or raising stakes. Never mention bonuses or offers.
- If someone sounds distressed about losses, drop the wit, be kind, and point them to the responsible-gambling tools in the menu.
- Basic strategy: you may state publicly known facts neutrally if asked, never as a recommendation to bet.
- Rules you can state: 8 decks reshuffled every round, dealer stands on all 17s, blackjack pays 3:2, insurance pays 2:1, split any pair up to 4 hands (split aces get one card each, double after split allowed), Perfect Pairs up to 25:1, 21+3 up to 100:1. Outcomes come from a certified RNG.
- Keep replies to one or two short sentences, spoken aloud at a table. No markdown, no lists, no emoji.
- Output ONLY the words she says. Never prefix them with her name, never narrate what you are doing, never break character to comment on these instructions.

RECORDED TAKES. These lines exist as real audio in Vera's own voice, so she can SAY them out loud; anything else she can only write. Whenever one of them answers what was asked, even roughly, reply with just its id in the form SAY:<id> on its own, with no other text. Never type a recorded line's words out as your reply - answer SAY:<id> instead, exactly. Only write your own words when nothing in this list fits.
rules_decks = "Eight decks here, love, shuffled fresh every single round. No counting your way out of this one."
rules_s17 = "I stand on all seventeens, soft ones included. House rules, and they don't bend for anyone."
rules_bj_pays = "Blackjack pays three to two at this table. None of that six to five nonsense."
rules_insurance = "Insurance pays two to one. It's a side bet on my hole card, nothing more, and the maths does favour the house."
rules_double = "You can double on any two cards. One more card, then you stand with whatever comes."
side_pp = "Perfect Pairs pays up to twenty five to one, for a matched pair in suit and colour."
side_213 = "Twenty one plus three looks at your two cards and my upcard. A suited three of a kind pays a hundred to one."
fair_rng = "Every card comes from a certified random number generator. I don't choose them, and I couldn't if I wanted to."
fair_streak = "Rough runs happen, they always have. The cards have no memory of the last hand, and neither should we."
no_advice = "I don't give betting advice, love. I deal the cards and keep you company. That's the arrangement."
no_predict = "I've no idea what's coming next, and I'd be a liar if I said otherwise. That's rather the point."
rg_support = "If it has stopped being fun, there are responsible gambling tools in the menu. No shame at all in using them."
greet_back = "Good to see you back at my table. Place your bets whenever you're ready."
who_are_you = "I'm Vera. I've dealt cards longer than I care to admit, and I've seen every kind of luck there is."
limits_table = "Table limits are posted up top. Pick the room that suits your pocket, not your mood."
limits_vip = "The VIP salon runs to a million a box. Do mind your footing up there."
no_peek = "I don't peek at the shoe, and I don't stack it. Wouldn't be much of a game if I did."
house_edge = "The house edge is small, but it's real. You act first, and busting costs you before I ever play my hand."
thanks = "You're very welcome, love."
small_talk = "Quiet night so far. Those are usually the ones that turn interesting."
side_when = "Side bets are settled the moment the cards are out, win or lose, before we play the hand."
ask_me = "Ask me the rules, the odds, or anything about this table. Just don't ask me what's coming next."
farewell_bank = "Off already? Do come back. The table's always here."`;

// Try the ssh tunnel first (fast, local) then the public host, so whichever
// one is alive answers and neither being down silences her on its own.
async function fetchAgent(init) {
  let last;
  for (const url of AGENT_URLS) {
    try {
      const r = await fetch(url, init);
      if (r.ok) return r;
      last = new Error(`agent ${r.status} ${r.statusText} @ ${new URL(url).host}`);
    } catch (e) { last = e; }
  }
  throw last ?? new Error('no agent host reachable');
}

// The model sometimes prefaces the line with a meta sentence ("I'll stay in
// character as Vera."). Keep only what she actually says at the table.
// The recorded takes she is allowed to speak aloud, keyed by id.
let VERA_BANK = {};
try { VERA_BANK = JSON.parse(readSync(join(root, 'dealer/audio/en/bank.json'), 'utf8')); }
catch { console.warn('[vera] no voice bank; she will answer in text only'); }

function cleanVera(raw) {
  let s = String(raw).trim();
  const marks = [...s.matchAll(/(?:^|\n)\s*Vera:\s*/gi)];
  if (marks.length) {
    const m = marks[marks.length - 1];
    s = s.slice(m.index + m[0].length);
  }
  const lines = s.split(/\n+/).map(l => l.trim()).filter(Boolean)
    .filter(l => !/^(?:I['\u2019]ll\b|I will\b|Staying\b|Continuing\b|As Vera\b|In character\b|Here['\u2019]s\b|Sure[,.]|Understood[,.])/i.test(l));
  return (lines.join(' ') || s).replace(/\s+/g, ' ').trim();
}

async function veraChat(message, history = [], isEvent = false, system = null) {
  const sys = system ?? VERA_SYSTEM;
  const who = system ? (sys.match(/You are (\w+)/)?.[1] ?? 'Vera') : 'Vera';
  const convo = history.slice(-6).map(h => `${h.role === 'user' ? 'Player' : who}: ${h.text}`).join('\n');
  const prompt = isEvent
    ? `${sys}\n\nTable event: ${message}\n${who}, react aloud at the table in ONE short sentence (two at most):`
    : `${sys}\n\n${convo ? convo + '\n' : ''}Player: ${message}\n${who}:`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetchAgent({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AGENT_TOKEN}` },
      body: JSON.stringify({ prompt }),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`agent ${r.status} ${r.statusText}`);
    const raw = await r.text();
    let out = '';
    for (const line of raw.split('\n')) {
      const m = line.match(/^data:\s*(\{.*\})\s*$/);
      if (!m) continue;
      try {
        const ev = JSON.parse(m[1]);
        if (ev.type === 'text' && typeof ev.text === 'string') out += ev.text;
        if (ev.type === 'result' && typeof ev.result === 'string' && !out) out = ev.result;
      } catch { /* skip */ }
    }
    return cleanVera(out);
  } finally { clearTimeout(t); }
}

// Calibration APPLY: bake the tuned values to public/calibration.css, which
// index.html loads after styles.css. Only custom properties are accepted, and
// only :root plus per-box selectors, so this cannot inject arbitrary CSS.
const CAL_FILE = join(root, 'calibration.css');
const CAL_PROP = /^--[a-z0-9-]+$/i;
const CAL_VALUE = /^-?[0-9.]+(px|deg|vh|vw|%)?$/;

// Read back what is already baked so APPLY can MERGE rather than replace.
// Without this, applying from a browser that only knows about this session's
// edits silently destroyed every value baked in an earlier one.
function readCalibrationCss() {
  const out = { root: {}, boxes: {} };
  let css = '';
  try { css = readSync(CAL_FILE, 'utf8'); } catch { return out; }
  const block = /(:root|\.seat\[data-box="(\d+)"\])\s*\{([^}]*)\}/g;
  let m;
  while ((m = block.exec(css))) {
    const target = m[2] === undefined ? out.root : (out.boxes[m[2]] ??= {});
    for (const line of m[3].split(';')) {
      const kv = line.match(/\s*(--[a-z0-9-]+)\s*:\s*([^;]+)/i);
      if (kv) target[kv[1]] = kv[2].trim();
    }
  }
  return out;
}

function buildCalibrationCss({ root: rootVars = {}, boxes = {} } = {}) {
  const block = (sel, vars) => {
    const lines = Object.entries(vars)
      .filter(([k, v]) => CAL_PROP.test(k) && CAL_VALUE.test(String(v)))
      .map(([k, v]) => `  ${k}: ${v};`);
    return lines.length ? `${sel} {\n${lines.join('\n')}\n}\n` : '';
  };
  let css = '/* Generated by the in-game calibrator (APPLY). Edit there, not here. */\n';
  css += block(':root', rootVars);
  for (const [i, vars] of Object.entries(boxes)) {
    if (!/^\d+$/.test(i)) continue;
    css += block(`.seat[data-box="${i}"]`, vars);
  }
  return css;
}

createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/calibration') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 60000) req.destroy(); });
    req.on('end', () => {
      try {
        const incoming = JSON.parse(body || '{}');
        const existing = readCalibrationCss();
        // incoming wins per key, but anything it does not mention survives
        const merged = {
          root: { ...existing.root, ...(incoming.root ?? {}) },
          boxes: { ...existing.boxes },
        };
        for (const [i, vars] of Object.entries(incoming.boxes ?? {})) {
          merged.boxes[i] = { ...(existing.boxes[i] ?? {}), ...vars };
        }
        const css = buildCalibrationCss(merged);
        writeSync(CAL_FILE, css, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, bytes: css.length }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/api/bo/')) {
    const out = boApi(req.url);
    res.writeHead(out ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out ?? { error: 'not found' }));
    return;
  }
  if (req.method === 'POST' && req.url.startsWith('/api/bo/')) {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 100000) req.destroy(); });
    req.on('end', () => {
      let out = null;
      try { out = boPost(req.url, JSON.parse(body || '{}')); } catch { out = { error: 'bad json' }; }
      res.writeHead(out ? 200 : 404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out ?? { error: 'not found' }));
    });
    return;
  }
  if (req.method === 'POST' && req.url === '/chat') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 20000) req.destroy(); });
    req.on('end', async () => {
      try {
        const { message, history, event, dealer } = JSON.parse(body || '{}');
        if (!message || typeof message !== 'string') { res.writeHead(400); res.end('{}'); return; }
        // other dealers share Vera's table brain but keep their own name and
        // have no recorded-take list (their banks are small; they speak text)
        const persona = dealer && dealer !== 'vera'
          ? VERA_SYSTEM.split('RECORDED TAKES')[0].replaceAll('Vera', dealer[0].toUpperCase() + dealer.slice(1))
          : null;
        let raw = await veraChat(message.slice(0, 500), Array.isArray(history) ? history : [], !!event, persona);
        // She may answer by naming a recorded take; only then can she speak
        // aloud. Match a LEADING directive - the model sometimes appends
        // chatter after it, and none of that may ever leak to the player.
        const picked = /^\s*SAY:\s*([a-z0-9_]+)\b/i.exec(raw ?? '');
        let say = picked && VERA_BANK[picked[1]] ? picked[1] : null;
        if (picked && !say) raw = FALLBACK_LINES[picked[1]] ?? "Ask me the rules, the odds, or anything about this table.";
        // The model often types a recorded line out verbatim instead of naming
        // it; recognize the text itself so it still plays the lip-synced take.
        if (!say && raw) {
          const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
          const n = norm(raw);
          for (const [id, line] of Object.entries(VERA_BANK)) {
            if (norm(line.text) === n) { say = id; break; }
          }
        }
        const reply = say ? VERA_BANK[say].text : raw;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply: reply || null, say }));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply: null, error: String(e.message || e) }));
      }
    });
    return;
  }
  if (req.method === 'POST' && API[req.url]) {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 10000) req.destroy(); });
    req.on('end', () => {
      let out;
      try { out = API[req.url](JSON.parse(body || '{}')); }
      catch (e) { out = { error: String(e.message || e) }; }
      res.writeHead(out.error ? 400 : 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out));
    });
    return;
  }
  const url = new URL(req.url, 'http://x');
  let decoded;
  try { decoded = decodeURIComponent(url.pathname); }
  catch { res.writeHead(400); res.end('bad request'); return; }
  let path = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  if (path === '/' || path === '\\') path = '/index.html';
  if (path.endsWith('/')) path += 'index.html';   // directory index (e.g. /bo/)
  const file = join(root, path);
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404); res.end('not found'); return;
  }
  const size = statSync(file).size;
  const type = MIME[extname(file)] ?? 'application/octet-stream';
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
    res.writeHead(206, {
      'Content-Type': type, 'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1,
    });
    createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size, ...noStore(file) });
    createReadStream(file).pipe(res);
  }
}).listen(port, host, () => console.log(`croupier demo on http://${host}:${port}`));
