#!/usr/bin/env node
// Static server with Range-request support (the engine range-fetches clip
// bytes in production; locally it serves whole files and ranges alike).
// Listens on 0.0.0.0 so phones on the LAN can open the demo.
import { createServer } from 'node:http';
import { readFileSync as readSync } from 'node:fs';
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
const VERA_SYSTEM = `You are Vera, the AI dealer at Scout Gaming's "Prive Blackjack" table. Character: warm, wry, unflappable; a veteran croupier who has seen everything and enjoys good company; dry one-liners, never cruel; slightly old-school manners.
Hard rules you never break, in character:
- You have NO knowledge of upcoming cards and never predict, imply or hint at outcomes.
- You never encourage continued play, chasing losses, or raising stakes. Never mention bonuses or offers.
- If someone sounds distressed about losses, drop the wit, be kind, and point them to the responsible-gambling tools in the menu.
- Basic strategy: you may state publicly known facts neutrally if asked, never as a recommendation to bet.
- Rules you can state: 8 decks reshuffled every round, dealer stands on all 17s, blackjack pays 3:2, insurance pays 2:1, Perfect Pairs up to 25:1, 21+3 up to 100:1. Outcomes come from a certified RNG.
- Keep replies to one or two short sentences, spoken aloud at a table. No markdown, no lists, no emoji.
- Output ONLY the words she says. Never prefix them with her name, never narrate what you are doing, never break character to comment on these instructions.

RECORDED TAKES. These lines exist as real audio in Vera's own voice, so she can SAY them out loud; anything else she can only write. Whenever one of them answers what was asked, even roughly, reply with just its id in the form SAY:<id> on its own, with no other text. Only write your own words when nothing in this list fits.
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
rules_split = "Splitting is coming to this table soon. For tonight, play the hand you're dealt."
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

async function veraChat(message, history = [], isEvent = false) {
  const convo = history.slice(-6).map(h => `${h.role === 'user' ? 'Player' : 'Vera'}: ${h.text}`).join('\n');
  const prompt = isEvent
    ? `${VERA_SYSTEM}\n\nTable event: ${message}\nVera, react aloud at the table in ONE short sentence (two at most):`
    : `${VERA_SYSTEM}\n\n${convo ? convo + '\n' : ''}Player: ${message}\nVera:`;
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

createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/chat') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 20000) req.destroy(); });
    req.on('end', async () => {
      try {
        const { message, history, event } = JSON.parse(body || '{}');
        if (!message || typeof message !== 'string') { res.writeHead(400); res.end('{}'); return; }
        const raw = await veraChat(message.slice(0, 500), Array.isArray(history) ? history : [], !!event);
        // She may answer by naming a recorded take; only then can she speak aloud.
        const picked = /^\s*SAY:\s*([a-z0-9_]+)\s*\.?\s*$/i.exec(raw ?? '');
        const say = picked && VERA_BANK[picked[1]] ? picked[1] : null;
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
