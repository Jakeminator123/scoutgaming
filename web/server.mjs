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
  if (!Number.isFinite(amt) || amt < 1 || amt > 100000) return { error: 'amount must be 1-100000' };
  const balance = Math.round((p.balance + amt) * 100) / 100;
  db.prepare('UPDATE players SET balance = ? WHERE id = ?').run(balance, id);
  logTx(id, 'deposit', amt, p.currency, 'demo test card');
  return { balance, currency: p.currency };
}
function apiBalance({ id, balance, reason }) {
  const p = getPlayer(id);
  if (!p) return { error: 'no such player' };
  const b = Number(balance);
  if (!Number.isFinite(b) || b < 0 || b > 10000000) return { error: 'bad balance' };
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
const MIME = {
  '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.webp': 'image/webp', '.h264': 'application/octet-stream', '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml',
};

// Vera's brain: the scout-hel1 headless-claude subscription via the axelio-agent
// proxy (ssh tunnel -> localhost:3100). Never an API key.
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
- Keep replies to one or two short sentences, spoken aloud at a table. No markdown, no lists, no emoji.`;

async function veraChat(message, history = [], isEvent = false) {
  const convo = history.slice(-6).map(h => `${h.role === 'user' ? 'Player' : 'Vera'}: ${h.text}`).join('\n');
  const prompt = isEvent
    ? `${VERA_SYSTEM}\n\nTable event: ${message}\nVera, react aloud at the table in ONE short sentence (two at most):`
    : `${VERA_SYSTEM}\n\n${convo ? convo + '\n' : ''}Player: ${message}\nVera:`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch('http://localhost:3100/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AGENT_TOKEN}` },
      body: JSON.stringify({ prompt }),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`agent ${r.status}`);
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
    return out.trim().replace(/^Vera:\s*/i, '');
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
        const reply = await veraChat(message.slice(0, 500), Array.isArray(history) ? history : [], !!event);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply: reply || null }));
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
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size });
    createReadStream(file).pipe(res);
  }
}).listen(port, '0.0.0.0', () => console.log(`croupier demo on http://0.0.0.0:${port}`));
