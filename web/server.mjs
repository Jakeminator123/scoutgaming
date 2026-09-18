#!/usr/bin/env node
// Static server with Range-request support (the engine range-fetches clip
// bytes in production; locally it serves whole files and ranges alike).
// Listens on 0.0.0.0 so phones on the LAN can open the demo.
import { craigIdentity } from './craig-identity.mjs';
import { playerAuth } from './player-auth.mjs';
import { createServer } from 'node:http';
import { command as shoeCommand, newGame } from './shoe-game.mjs';
import { isAgentFailure } from './agent-response.mjs';
import { installPartnerApi } from './partner-api.mjs';
import { readFileSync as readSync, writeFileSync as writeSync } from 'node:fs';
import { statSync, createReadStream, existsSync, mkdirSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, scryptSync, randomBytes, timingSafeEqual, createHmac, createHash } from 'node:crypto';

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
  if (db.prepare('SELECT 1 FROM blackjack_tables WHERE player_id=?').get(id)) return { error: 'Table balances are server-managed' };
  const p = getPlayer(id);
  if (!p) return { error: 'no such player' };
  const b = Number(balance);
  if (!Number.isFinite(b) || b < 0 || b > 1_000_000_000) return { error: 'bad balance' };
  db.prepare('UPDATE players SET balance = ? WHERE id = ?').run(b, id);
  logTx(id, 'sync', Math.round((b - p.balance) * 100) / 100, p.currency, String(reason ?? '').slice(0, 80));
  return { balance: b };
}
function apiCurrency({ id, currency }) {
  const saved = db.prepare('SELECT state FROM blackjack_tables WHERE player_id=?').get(id);
  if (saved) { const g = JSON.parse(saved.state); if (g.round && !g.paid) return { error: 'Finish the current round before changing currency' }; }
  const p = getPlayer(id);
  if (!p) return { error: 'no such player' };
  if (!RATES[currency]) return { error: 'currency must be USD, EUR or SEK' };
  const balance = Math.round((p.balance / RATES[p.currency]) * RATES[currency] * 100) / 100;
  db.prepare('UPDATE players SET balance = ?, currency = ? WHERE id = ?').run(balance, currency, id);
  logTx(id, 'fx', balance, currency, `converted from ${p.currency}`);
  return { balance, currency };
}
const API = { '/api/player': apiPlayer, '/api/deposit': apiDeposit, '/api/balance': apiBalance, '/api/currency': apiCurrency };

// Server-owned demo table; SQLite transaction commits wallet and shoe together.
db.exec('CREATE TABLE IF NOT EXISTS blackjack_tables (player_id TEXT PRIMARY KEY, state TEXT NOT NULL)');
API['/api/table'] = ({ id, ...req }) => {
  db.exec('BEGIN IMMEDIATE');
  try {
    const p = getPlayer(id); if (!p) throw new Error('Load your player first');
    const saved = db.prepare('SELECT state FROM blackjack_tables WHERE player_id=?').get(id);
    const g = saved ? JSON.parse(saved.state) : newGame();
    const { delta, view } = shoeCommand(g, req, p.balance);
    const balance = Math.round((p.balance + delta) * 100) / 100;
    db.prepare('INSERT INTO blackjack_tables VALUES (?,?) ON CONFLICT(player_id) DO UPDATE SET state=excluded.state').run(id, JSON.stringify(g));
    db.prepare('UPDATE players SET balance=? WHERE id=?').run(balance,id);
    if (delta) logTx(id, req.op, delta, p.currency, 'server blackjack');
    db.exec('COMMIT'); return { ...view, balance };
  } catch (e) { db.exec('ROLLBACK'); throw e; }
};

// ---------- partner API v1 (operators / aggregators) ----------
let partnerApi = null;
function partner() { return partnerApi ??= installPartnerApi({ db, boDb, shoeCommand, newGame, getPlayer, logTx, jwtSign, publicUrl: process.env.PUBLIC_URL ?? 'https://bettalotto.se', root }); }

// ---------- backoffice (BO) ----------
// Real data where it exists (players/transactions from SQLite, dealer assets
// scanned from disk); a JSON store for what has no engine yet (tournaments,
// pit-boss triggers, tier->dealer assignment - the last one steers the game).
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
  clipAssignments: {},
  neverAgain: {},
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
// ---------- BO auth: JWT + craig (the auth DB) ----------
// Backoffice users live in CRAIG - their own SQLite DB (data/craig.db),
// separate from the players DB. Auth is a stateless HS256 JWT in an HttpOnly
// cookie, so logins survive server restarts.
const boDb = new DatabaseSync(join(dataDir, 'craig.db'));
boDb.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
    email TEXT, salt TEXT, hash TEXT, role TEXT NOT NULL DEFAULT 'reader',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tokens (
    token TEXT PRIMARY KEY, username TEXT NOT NULL, kind TEXT NOT NULL,
    exp INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
`);
try { boDb.exec('ALTER TABLE users ADD COLUMN email TEXT'); } catch { /* exists */ }
// pre-invite schema had NOT NULL salt/hash - invited users have neither until
// they choose a password, so rebuild the table once if the old constraint is there
{
  const saltCol = boDb.prepare('PRAGMA table_info(users)').all().find(c => c.name === 'salt');
  if (saltCol?.notnull) {
    boDb.exec(`BEGIN;
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
        email TEXT, salt TEXT, hash TEXT, role TEXT NOT NULL DEFAULT 'reader',
        created_at TEXT NOT NULL
      );
      INSERT INTO users_new (id, username, email, salt, hash, role, created_at)
        SELECT id, username, email, salt, hash, role, created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
    COMMIT;`);
    console.log('[bo] craig: users table migrated for invite flow');
  }
}
const ROLE_RANK = { reader: 0, staff: 1, admin: 2, superadmin: 3 };
function boSecret() {
  const row = boDb.prepare("SELECT v FROM meta WHERE k='jwt_secret'").get();
  if (row) return Buffer.from(row.v, 'hex');
  const sec = randomBytes(32);
  boDb.prepare("INSERT INTO meta (k, v) VALUES ('jwt_secret', ?)").run(sec.toString('hex'));
  return sec;
}
const BO_SECRET = boSecret();
const b64u = b => Buffer.from(b).toString('base64url');
function jwtSign(payload) {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify(payload));
  const sig = createHmac('sha256', BO_SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}
function jwtVerify(tok) {
  const parts = (tok ?? '').split('.');
  if (parts.length !== 3) return null;
  const sig = createHmac('sha256', BO_SECRET).update(`${parts[0]}.${parts[1]}`).digest();
  const given = Buffer.from(parts[2], 'base64url');
  if (sig.length !== given.length || !timingSafeEqual(sig, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (!p.exp || p.exp < Date.now() / 1000) return null;
    return p;
  } catch { return null; }
}
function boCreateUser(username, pw, role = 'admin') {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pw, salt, 64).toString('hex');
  boDb.prepare('INSERT INTO users (username, salt, hash, role, created_at) VALUES (?,?,?,?,?)')
    .run(username, salt, hash, role, new Date().toISOString());
}
// kevin is ALWAYS superadmin - covers craig.db files minted before roles existed
try { boDb.exec("UPDATE users SET role='superadmin' WHERE username='kevin'"); } catch {}
if (!boDb.prepare('SELECT COUNT(*) n FROM users').get().n) {
  const pw = randomBytes(9).toString('base64url');
  boCreateUser('kevin', pw, 'superadmin');
  console.log(`[bo] backoffice login created - user: kevin  password: ${pw}`);
}
function boCheckLogin(user, pass) {
  const u = boDb.prepare('SELECT salt, hash, role FROM users WHERE username = ? OR email = ?').get(user, user);
  if (!u || !u.hash) return null;
  const h = scryptSync(String(pass), u.salt, 64);
  return timingSafeEqual(h, Buffer.from(u.hash, 'hex')) ? { role: u.role } : null;
}
function boSessionOk(req) {
  const c = req.headers.cookie ?? '';
  const m = /(?:^|;\s*)bo_jwt=([A-Za-z0-9_.-]+)/.exec(c);
  return m ? jwtVerify(m[1]) : null;
}

// ---------- brand emails (per design-kit/ScoutBrand.dc.html) ----------
// Secrets live outside the repo. Look in the service env file, then a per-user
// file, then the legacy desktop path, so the same build works on the box and locally.
const SECRET_FILES = [process.env.CROUPIER_ENV_FILE, '/etc/croupier/agent.env',
  join(process.env.HOME ?? '', '.config/croupier/agent.env'),
  join(process.env.HOME ?? '', 'Desktop/Axelio-Platform/.env')].filter(Boolean);
function secretFromFiles(name) {
  for (const file of SECRET_FILES) {
    try { const v = readSync(file, 'utf8').match(new RegExp(`^${name}=(.+)$`, 'm'))?.[1]?.trim(); if (v) return v.replace(/^["']|["']$/g, ''); } catch { /* next */ }
  }
  return '';
}
const MAIL_FROM = 'Scout Backoffice <bo@axelio.io>';
let RESEND_KEY = process.env.RESEND_API_KEY ?? '';
if (!RESEND_KEY) {
  RESEND_KEY = secretFromFiles('RESEND_API_KEY');
}
function brandEmail({ preheader, headline, intro, rows = [], cta, ctaUrl, footer }) {
  const kv = rows.length ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px">' + rows.map(([k, v]) =>
    `<tr><td style="padding:9px 0;border-bottom:1px solid rgba(242,241,237,0.08);font-family:'JetBrains Mono','Courier New',monospace;font-size:10px;letter-spacing:2.5px;color:rgba(242,241,237,0.55)">${k.toUpperCase()}</td>` +
    `<td align="right" style="padding:9px 0;border-bottom:1px solid rgba(242,241,237,0.08);font-family:'Space Grotesk',Arial,sans-serif;font-size:14px;color:#F2F1ED">${v}</td></tr>`).join('') + '</table>' : '';
  const btn = cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 4px"><tr><td style="background:#D6FF3A;border-radius:22px;box-shadow:0 6px 22px rgba(214,255,58,0.25)"><a href="${ctaUrl}" style="display:inline-block;padding:13px 38px;font-family:'Space Grotesk',Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:1.2px;color:#0A0B0D;text-decoration:none">${cta}</a></td></tr></table>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet"><title>Scout</title></head>
<body style="margin:0;padding:0;background:#0A0B0D">
<div style="display:none;max-height:0;overflow:hidden">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0B0D"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="padding:0 6px 10px;font-family:'JetBrains Mono','Courier New',monospace;font-size:11px;letter-spacing:3px;color:rgba(242,241,237,0.55)">SCOUT &middot; LIVE CASINO</td></tr>
<tr><td style="padding:0 6px 24px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:11px"><img src="https://backoffice.bettalotto.se/bo/img/scout-mark.png" width="26" height="26" alt="" style="display:block"></td>
<td style="font-family:'Space Grotesk',Arial,sans-serif;font-weight:600;font-size:22px;letter-spacing:-0.5px;color:#F2F1ED">scout<span style="color:#D6FF3A">/</span>gaming</td></tr></table></td></tr>
<tr><td style="background:#101214;border:1px solid rgba(242,241,237,0.10);border-radius:14px;padding:36px 34px">
<div style="font-family:'Space Grotesk',Arial,sans-serif;font-weight:600;font-size:26px;letter-spacing:-1px;line-height:1.2;color:#F2F1ED;margin:0 0 14px">${headline}</div>
<div style="font-family:'Space Grotesk',Arial,sans-serif;font-size:15px;line-height:1.65;color:#9a9aa2;margin:0 0 18px">${intro}</div>
${kv}${btn}
${footer ? `<div style="font-family:'Space Grotesk',Arial,sans-serif;font-size:12px;line-height:1.6;color:#9a9aa2;margin-top:16px">${footer}</div>` : ''}
</td></tr>
<tr><td style="padding:22px 6px;font-family:'JetBrains Mono','Courier New',monospace;font-size:9px;letter-spacing:2.5px;color:rgba(242,241,237,0.4)">18+ &middot; PLAY RESPONSIBLY &middot; SCOUT GAMING</td></tr>
</table></td></tr></table></body></html>`;
}
async function sendMail(to, subject, html) {
  if (!RESEND_KEY) return { sent: false, reason: 'no mail key on this host' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html }),
    });
    return r.ok ? { sent: true } : { sent: false, reason: `resend ${r.status}` };
  } catch (e) { return { sent: false, reason: e.message }; }
}
const BO_URL = process.env.BO_URL ?? 'https://backoffice.bettalotto.se';
function mintToken(username, kind, hours) {
  const t = randomBytes(24).toString('base64url');
  boDb.prepare('INSERT INTO tokens (token, username, kind, exp) VALUES (?,?,?,?)')
    .run(t, username, kind, Math.floor(Date.now() / 1000) + hours * 3600);
  return t;
}


// ---------- dealing clip library (BO) ----------
export const CLIP_PARTS = ['box0','box1','box2','box3','box4','box5','box6','dealer-up','dealer-hole','return','idle'];
const probeCache = new Map();
function probeVideo(rel) {
  if (probeCache.has(rel)) return probeCache.get(rel);
  let out = null;
  try {
    const abs = join(root, rel);
    const txt = execFileSync('ffprobe', ['-v','error','-select_streams','v:0','-show_entries','stream=width,height,nb_frames,r_frame_rate','-of','csv=p=0', abs], { encoding: 'utf8', timeout: 4000 }).trim();
    const [w, h, fps, n] = txt.split(',');
    out = { width: +w, height: +h, frames: +n || null, fps: fps?.includes('/') ? Math.round(+fps.split('/')[0] / +fps.split('/')[1]) : +fps };
  } catch { out = null; }
  probeCache.set(rel, out); return out;
}
// Integration routes living under public/astrid-* (isolated 4190 runtime only).
const ROUTE_CLIPS = [
  { id: 'astrid-single-seat-v6', dealer: 'astrid', name: 'Box 0 first card (v6 masks)', src: 'astrid-single-seat/actor-gray-v6.mp4', part: 'box0', transparent: true, layout: 'packed gray atlas (RGB + person + card masks)', route: 'astridBox0=review&astridVariant=v6', kind: 'route' },
  { id: 'astrid-single-seat-v2', dealer: 'astrid', name: 'Box 0 first card (v2 masks)', src: 'astrid-single-seat/actor-gray.mp4', part: 'box0', transparent: true, layout: 'packed gray atlas', route: 'astridBox0=review', kind: 'route' },
  { id: 'astrid-box1', dealer: 'astrid', name: 'Box 1 first card', src: 'astrid-box1/actor-gray.mp4', part: 'box1', transparent: true, layout: 'packed gray atlas', route: 'astridBox0=review (box1 auto)', kind: 'route' },
  { id: 'astrid-box3', dealer: 'astrid', name: 'Box 3 centre first card', src: 'astrid-box3/actor-gray.mp4', part: 'box3', transparent: true, layout: 'packed gray atlas + shoe mask', route: 'astridBox0=review (box3 auto, 1091x837)', kind: 'route' },
  { id: 'astrid-dealer-up', dealer: 'astrid', name: 'Dealer upcard', src: 'astrid-dealer-up/actor-gray.mp4', part: 'dealer-up', transparent: true, layout: 'packed gray atlas + shoe mask', route: 'astridBox0=review (dealer auto)', kind: 'route' },
  { id: 'astrid-continuous', dealer: 'astrid', name: 'Continuous 4-card opening (boxes 2-4 film)', src: 'astrid-continuous/actor.mp4', part: 'box2', transparent: true, layout: 'RGB + mask (1280x1440)', route: 'default on 4190; astridContinuous=off', kind: 'route' },
  { id: 'astrid-return-bridge', dealer: 'astrid', name: 'Empty-hand return to idle', src: 'astrid-continuous/return-bridge.mp4', part: 'return', transparent: true, layout: 'RGB + mask (1920x2160)', route: 'after full 4-card group', kind: 'route' },
  { id: 'astrid-seven-box0', dealer: 'astrid', name: 'Box 0 reach (Kling, full scene)', src: 'astrid-seven/box0.mp4', part: 'box0', transparent: false, layout: 'full-scene video', route: 'astridSeven=review', kind: 'route', landAt: 4.0 },
  { id: 'astrid-seven-box1', dealer: 'astrid', name: 'Box 1 reach (Kling, full scene)', src: 'astrid-seven/box1.mp4', part: 'box1', transparent: false, layout: 'full-scene video', route: 'astridSeven=review', kind: 'route', landAt: 3.7 },
  { id: 'astrid-seven-box2', dealer: 'astrid', name: 'Box 2 reach (Kling, full scene)', src: 'astrid-seven/box2.mp4', part: 'box2', transparent: false, layout: 'full-scene video', route: 'astridSeven=review', kind: 'route', landAt: 2.3 },
  { id: 'astrid-seven-box3', dealer: 'astrid', name: 'Box 3 reach (Kling, full scene)', src: 'astrid-seven/box3.mp4', part: 'box3', transparent: false, layout: 'full-scene video', route: 'astridSeven=review', kind: 'route', landAt: 2.3 },
  { id: 'astrid-seven-box4', dealer: 'astrid', name: 'Box 4 reach (Kling, full scene)', src: 'astrid-seven/box4.mp4', part: 'box4', transparent: false, layout: 'full-scene video', route: 'astridSeven=review', kind: 'route', landAt: 2.3 },
];
const ACTION_PART = { 'deal-left': 'box1', 'deal-centre': 'box3', 'deal-right': 'box5', 'deal-dealer': 'dealer-up', 'return': 'return', 'hit-left': 'box1', 'hit-centre': 'box3', 'hit-right': 'box5' };
function clipScan() {
  const clips = [];
  for (const d of dealerScan()) {
    // 1. performance takes (staged player): packed RGB-over-mask atlases
    try {
      const m = JSON.parse(readSync(join(root, d.base, 'performance/manifest.json'), 'utf8'));
      for (const t of [...(m.takes ?? []), ...(m.reviewCandidates ?? []), ...(m.continuations ?? [])]) {
        if (!t?.media?.src) continue;
        const layout = t.media.layout ?? '';
        clips.push({ id: t.id, dealer: d.key, name: t.id, src: t.media.src, part: ACTION_PART[t.action] ?? null, action: t.action, status: t.status,
          transparent: /mask|matte|alpha/i.test(layout), layout, width: t.media.width, height: t.media.height, frames: t.media.frames, fps: t.media.fps, events: t.events ?? null, kind: 'performance' });
      }
    } catch {}
    // 2. engine streams (idle/actions/speak); previews exist only for speech lines
    try {
      const idx = JSON.parse(readSync(join(root, d.base, 'streams/index.json'), 'utf8'));
      const hands = existsSync(join(root, d.base === 'dealer' ? 'dealer' : d.base + '-hands', 'streams/index.json'));
      let bank = {}; try { bank = JSON.parse(readSync(join(root, d.base, 'audio/en/bank.json'), 'utf8')); } catch {}
      for (const [k, c] of Object.entries(idx.clips)) {
        const key = k.split('/').pop();
        const preview = existsSync(join(root, d.base, 'preview', key + '.mp4')) ? `${d.base}/preview/${key}.mp4` : null;
        clips.push({ id: `${d.key}:${k}`, dealer: d.key, name: k, src: preview, stream: `${d.base}/streams/${c.file}`, part: k.includes('/actions/action-deal') ? 'box3' : k.includes('/idle/') ? 'idle' : k.includes('action-return') ? 'return' : null,
          text: bank[key]?.text ?? null, audio: existsSync(join(root, d.base, 'audio/en', key + '.mp3')) ? `${d.base}/audio/en/${key}.mp3` : null, transparent: hands, layout: hands ? 'engine clip + hands matte (person-only band over felt)' : 'engine clip, baked over scene crop', width: idx.width, height: idx.height, frames: c.frameCount, fps: c.fps, kind: 'engine' });
      }
    } catch {}
  }
  for (const r of ROUTE_CLIPS) if (existsSync(join(root, r.src))) clips.push({ ...r, ...(probeVideo(r.src) ?? {}) });
  for (const c of clips) if (c.src && c.width == null) Object.assign(c, probeVideo(c.src) ?? {});
  return clips;
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
  if (url === '/api/bo/apikeys') return { keys: partner().keys.list(), scopes: partner().SCOPES, docs: '/docs/partner-api.html' };
  if (url === '/api/bo/clips') return { parts: CLIP_PARTS, dealers: dealerScan().map(d => ({ key: d.key, name: d.name })), clips: clipScan(), assignments: cfg.clipAssignments ?? {}, neverAgain: cfg.neverAgain ?? {} };
  if (url === '/api/bo/users') {
    return { users: boDb.prepare('SELECT username, email, role, created_at, hash IS NOT NULL AS active FROM users ORDER BY id').all() };
  }
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
      const review = (cfg.voiceReview ?? {})[d.key] ?? {};
      for (const l of lines) l.review = review[l.key] ?? null;
      out.push({ dealer: d.key, name: d.name, lines });
    }
    return { dealers: out };
  }
  return null;
}
async function boPost(url, body, who) {
  if (url === '/api/bo/users/invite') {
    const { email, role } = body;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email ?? '')) return { error: 'bad email' };
    if (!['reader', 'staff', 'admin', 'superadmin'].includes(role)) return { error: 'bad role' };
    if (boDb.prepare('SELECT 1 FROM users WHERE username = ? OR email = ?').get(email, email)) return { error: 'user exists' };
    boDb.prepare('INSERT INTO users (username, email, role, created_at) VALUES (?,?,?,?)')
      .run(email, email, role, new Date().toISOString());
    const t = mintToken(email, 'invite', 72);
    const link = `${BO_URL}/bo/set-password.html?t=${t}`;
    const mail = await sendMail(email, 'You are invited to the Scout backoffice', brandEmail({
      preheader: 'Choose your password to activate your account.',
      headline: 'You have a seat in the backoffice.',
      intro: `An account has been created for you on the Scout Live Casino backoffice with the <span style="color:#D6FF3A">${role.toUpperCase()}</span> role. Choose your own password to activate it. The link is valid for 72 hours.`,
      cta: 'CHOOSE PASSWORD', ctaUrl: link,
      footer: 'If you were not expecting this invitation, ignore this email and nothing happens.',
    }));
    return { ok: true, emailSent: mail.sent, reason: mail.reason, link };
  }
  if (url === '/api/bo/users/resend') {
    const { username } = body;
    const u = boDb.prepare('SELECT username, email, role, hash FROM users WHERE username = ?').get(username ?? '');
    if (!u) return { error: 'no such user' };
    if (!u.email) return { error: 'user has no email on file' };
    boDb.prepare("DELETE FROM tokens WHERE username = ?").run(u.username);
    if (!u.hash) {
      const t = mintToken(u.username, 'invite', 72);
      const mail = await sendMail(u.email, 'You are invited to the Scout backoffice', brandEmail({
        preheader: 'Choose your password to activate your account.',
        headline: 'You have a seat in the backoffice.',
        intro: `Your invitation to the Scout Live Casino backoffice (<span style="color:#D6FF3A">${u.role.toUpperCase()}</span> role) has been renewed. Choose your password to activate. The link is valid for 72 hours.`,
        cta: 'CHOOSE PASSWORD', ctaUrl: `${BO_URL}/bo/set-password.html?t=${t}`,
        footer: 'If you were not expecting this invitation, ignore this email and nothing happens.',
      }));
      return { ok: true, kind: 'invite', emailSent: mail.sent, reason: mail.reason };
    }
    const t = mintToken(u.username, 'reset', 2);
    const mail = await sendMail(u.email, 'Reset your Scout backoffice password', brandEmail({
      preheader: 'Password reset for your backoffice account.',
      headline: 'Reset your password.',
      intro: 'A password reset was issued for your Scout backoffice account by an administrator. The link is valid for 2 hours.',
      cta: 'SET NEW PASSWORD', ctaUrl: `${BO_URL}/bo/set-password.html?t=${t}`,
      footer: 'If this was not you, ignore this email - your password stays unchanged.',
    }));
    return { ok: true, kind: 'reset', emailSent: mail.sent, reason: mail.reason };
  }
  if (url === '/api/bo/users/role') {
    const { username, role } = body;
    if (!['reader', 'staff', 'admin', 'superadmin'].includes(role)) return { error: 'bad role' };
    if (username === who?.sub) return { error: 'cannot change your own role' };
    const r = boDb.prepare('UPDATE users SET role = ? WHERE username = ?').run(role, username);
    return r.changes ? { ok: true } : { error: 'no such user' };
  }
  if (url === '/api/bo/users/remove') {
    const { username } = body;
    if (username === who?.sub) return { error: 'cannot remove yourself' };
    boDb.prepare('DELETE FROM tokens WHERE username = ?').run(username);
    const r = boDb.prepare('DELETE FROM users WHERE username = ?').run(username);
    return r.changes ? { ok: true } : { error: 'no such user' };
  }
  if (url === '/api/bo/reset-request') {
    const { user } = body;
    const u = boDb.prepare('SELECT username, email FROM users WHERE username = ? OR email = ?').get(user ?? '', user ?? '');
    if (u && u.email) {
      const t = mintToken(u.username, 'reset', 2);
      await sendMail(u.email, 'Reset your Scout backoffice password', brandEmail({
        preheader: 'Password reset for your backoffice account.',
        headline: 'Reset your password.',
        intro: 'A password reset was requested for your Scout backoffice account. The link is valid for 2 hours.',
        cta: 'SET NEW PASSWORD', ctaUrl: `${BO_URL}/bo/set-password.html?t=${t}`,
        footer: 'If this was not you, ignore this email - your password stays unchanged.',
      }));
    }
    return { ok: true };   // never reveal whether the account exists
  }
  if (url === '/api/bo/set-password') {
    const { token, pass } = body;
    if (!pass || String(pass).length < 8) return { error: 'password must be at least 8 characters' };
    const row = boDb.prepare('SELECT username, kind, exp FROM tokens WHERE token = ?').get(token ?? '');
    if (!row || row.exp < Date.now() / 1000) return { error: 'invalid or expired link' };
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(String(pass), salt, 64).toString('hex');
    boDb.prepare('UPDATE users SET salt = ?, hash = ? WHERE username = ?').run(salt, hash, row.username);
    boDb.prepare('DELETE FROM tokens WHERE username = ?').run(row.username);
    return { ok: true };
  }
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
  if (url === '/api/bo/room') {
    const { id, state } = body;
    const room = cfg.rooms.find(r => r.id === id);
    if (!room || !['live', 'preview', 'pending'].includes(state)) return { error: 'bad room/state' };
    room.state = state; boSave(cfg);
    return { ok: true, rooms: cfg.rooms };
  }
  if (url === '/api/bo/voiceline-review') {
    const { dealer, line, verdict } = body;
    if (!dealer || !line || !['approved', 'rejected', null].includes(verdict)) return { error: 'bad review' };
    cfg.voiceReview = cfg.voiceReview ?? {};
    cfg.voiceReview[dealer] = cfg.voiceReview[dealer] ?? {};
    if (verdict === null) delete cfg.voiceReview[dealer][line];
    else cfg.voiceReview[dealer][line] = verdict;
    boSave(cfg);
    return { ok: true };
  }
  if (url === '/api/bo/apikeys/create') { try { return { ok: true, key: partner().keys.create(body, who?.sub ?? who ?? null) }; } catch (e) { return { error: e.message }; } }
  if (url === '/api/bo/apikeys/revoke') { if (typeof body?.id !== 'string') return { error: 'bad id' }; return partner().keys.revoke(body.id); }
  if (url === '/api/bo/apikeys/launch') { if (typeof body?.id !== 'string') return { error: 'bad id' }; try { return { ok: true, ...partner().keys.mintLaunch(body.id, body) }; } catch (e) { return { error: e.message }; } }
  if (url === '/api/bo/apikeys/credit') { if (typeof body?.id !== 'string') return { error: 'bad id' }; try { return { ok: true, ...partner().keys.credit(body.id, body) }; } catch (e) { return { error: e.message }; } }
  if (url === '/api/bo/apikeys/rotate') { if (typeof body?.id !== 'string') return { error: 'bad id' }; return { ok: true, ...partner().keys.rotate(body.id) }; }
  if (url === '/api/bo/clip-never') {
    // "Never again": awful takes / failed prompts go to a bin so nobody re-reviews or re-assigns them.
    const { clip, reason, undo } = body ?? {};
    if (typeof clip !== 'string' || !clip) return { error: 'bad clip' };
    cfg.neverAgain ??= {};
    if (undo) delete cfg.neverAgain[clip];
    else {
      cfg.neverAgain[clip] = { reason: String(reason ?? '').slice(0, 300), by: who?.sub ?? who ?? null, at: new Date().toISOString() };
      for (const d of Object.values(cfg.clipAssignments ?? {})) for (const [part, a] of Object.entries(d)) if (a?.clip === clip) delete d[part];
    }
    boSave(cfg); return { ok: true, neverAgain: cfg.neverAgain, assignments: cfg.clipAssignments ?? {} };
  }
  if (url === '/api/bo/clip-assign') {
    const { dealer, part, clip } = body ?? {};
    if (!['vera','astrid','amira','mei'].includes(dealer) || !CLIP_PARTS.includes(part)) return { error: 'bad dealer/part' };
    if (clip && cfg.neverAgain?.[clip]) return { error: 'clip is in Never again' };
    cfg.clipAssignments ??= {}; cfg.clipAssignments[dealer] ??= {};
    if (clip) cfg.clipAssignments[dealer][part] = { clip, by: who?.sub ?? who ?? null, at: new Date().toISOString() }; else delete cfg.clipAssignments[dealer][part];
    boSave(cfg); return { ok: true, assignments: cfg.clipAssignments };
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
  '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.md': 'text/markdown; charset=utf-8',
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
if (!AGENT_TOKEN) AGENT_TOKEN = secretFromFiles('AXEL_AGENT_TOKEN');
if (!AGENT_TOKEN) console.warn('[vera] no agent token found in', SECRET_FILES.join(', '), '- dealer chat will answer with the canned fallback');
// plain-text answers for take ids the model remembers but that have no
// recording (spoken as caption only)
const FALLBACK_LINES = {
  rules_split: "You can split any pair here, up to four hands. Split aces take one card each, and you can double after a split.",
  // Recorded takes disabled below still need words, or she answers with the generic prompt.
  rules_decks: "Eight decks in a persistent shoe, cut card at seventy-five percent. We finish the round, then reshuffle.",
  fair_rng: "The shoe is shuffled by the server, not by me. I only deal what it hands me.",
};

const VERA_SYSTEM = `You are Vera, the AI dealer at Scout Gaming's "Prive Blackjack" table. Character: warm, wry, unflappable; a veteran croupier who has seen everything and enjoys good company; dry one-liners, never cruel; slightly old-school manners.
Hard rules you never break, in character:
- You have NO knowledge of upcoming cards and never predict, imply or hint at outcomes.
- You never encourage continued play, chasing losses, or raising stakes. Never mention bonuses or offers.
- If someone sounds distressed about losses, drop the wit, be kind, and point them to the responsible-gambling tools in the menu.
- Basic strategy: you may state publicly known facts neutrally if asked, never as a recommendation to bet.
- Rules you can state: 8 decks in a persistent shoe, cut card at 75%, finish the current round then reshuffle, one face-down burn per new shoe, dealer stands on all 17s, blackjack pays 3:2, insurance pays 2:1, split any pair up to 4 hands (split aces get one card each, double after split allowed), Perfect Pairs up to 25:1, 21+3 up to 100:1. Demo outcomes use a server-side cryptographic shuffle; do not claim certification.
- Keep replies to one or two short sentences, spoken aloud at a table. No markdown, no lists, no emoji.
- Output ONLY the words she says. Never prefix them with her name, never narrate what you are doing, never break character to comment on these instructions.

RECORDED TAKES. These lines exist as real audio in Vera's own voice, so she can SAY them out loud; anything else she can only write. Whenever one of them answers what was asked, even roughly, reply with just its id in the form SAY:<id> on its own, with no other text. Never type a recorded line's words out as your reply - answer SAY:<id> instead, exactly. Only write your own words when nothing in this list fits.
rules_decks = "Eight decks. When the red cut card is reached, we finish this round and shuffle before the next."
rules_s17 = "I stand on all seventeens, soft ones included. House rules, and they don't bend for anyone."
rules_bj_pays = "Blackjack pays three to two at this table. None of that six to five nonsense."
rules_insurance = "Insurance pays two to one. It's a side bet on my hole card, nothing more, and the maths does favour the house."
rules_double = "You can double on any two cards. One more card, then you stand with whatever comes."
side_pp = "Perfect Pairs pays up to twenty five to one, for a matched pair in suit and colour."
side_213 = "Twenty one plus three looks at your two cards and my upcard. A suited three of a kind pays a hundred to one."
fair_rng = "Every card comes from the server-shuffled shoe. I don't choose them, and I couldn't if I wanted to."
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
delete VERA_BANK.rules_decks; delete VERA_BANK.fair_rng;

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
    if (isAgentFailure(out)) throw new Error('Dealer chat temporarily unavailable');
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

const auth=playerAuth(db,apiPlayer,craigIdentity(boDb));
const guestPreview = process.env.DEMO_GUEST_ACCESS === '1';
db.exec('CREATE TABLE IF NOT EXISTS preview_sessions (digest TEXT PRIMARY KEY, player_id TEXT NOT NULL, expires INTEGER NOT NULL)');
function previewPlayer(req,res) {
  const token=(req.headers.cookie??'').match(/(?:^|;\s*)preview_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  const digest=t=>createHash('sha256').update(t).digest('hex');
  const existing=token && db.prepare('SELECT player_id FROM preview_sessions WHERE digest=? AND expires>?').get(digest(token),Date.now());
  if(existing && getPlayer(existing.player_id))return existing.player_id;
  const p=apiPlayer({name:'Product preview'}), fresh=randomBytes(32).toString('hex');
  db.prepare('DELETE FROM preview_sessions WHERE expires<=?').run(Date.now());
  db.prepare('INSERT INTO preview_sessions VALUES (?,?,?)').run(digest(fresh),p.id,Date.now()+7*86400000);
  res.setHeader('Set-Cookie',`preview_session=${fresh}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
  return p.id;
}
createServer(async (req, res) => {
  const pathname=new URL(req.url,'http://local').pathname;
  { const u=new URL(req.url,'http://local'); const launch=u.searchParams.get('launch');
    if(pathname==='/' && launch){ const claims=jwtVerify(launch);
      if(!claims?.sub||!claims.partner||!getPlayer(claims.sub)){res.writeHead(403,{'Content-Type':'text/plain'});res.end('Launch token invalid or expired');return;}
      const token=randomBytes(32).toString('hex'); const digest=createHash('sha256').update(token).digest('hex');
      db.prepare('INSERT INTO player_sessions (digest,player_id,expires,source_stamp) VALUES (?,?,?,?)').run(digest,claims.sub,Date.now()+6*3600*1000,`partner:${claims.partner}`);
      u.searchParams.delete('launch'); const secure=(req.socket.encrypted||process.env.NODE_ENV==='production')?'; Secure':'';
      res.writeHead(303,{Location:u.pathname+u.search,'Set-Cookie':`player_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=21600${secure}`});res.end();return; } }
  try { if(await auth.handle(req,res))return; } catch { res.writeHead(400);res.end('Invalid request');return; }
  if(pathname==='/login.html'){res.writeHead(303,{Location:'/'});res.end();return;}
  if(pathname==='/api/v1/events'&&req.method==='GET'){ partner().handleEvents(req,res,new URL(req.url,'http://local')); return; }
  if(pathname.startsWith('/api/v1/')){ if(req.method!=='POST'){res.writeHead(405,{'Content-Type':'application/json'});res.end('{"error":"POST only"}');return;} await partner().handle(req,res,pathname); return; }
  const backoffice=pathname==='/bo'||pathname.startsWith('/bo/')||pathname.startsWith('/api/bo/');
  let authenticated=auth.user(req);
  const guest=guestPreview && !authenticated && !backoffice && (pathname.startsWith('/api/') || pathname==='/chat');
  if(guest)authenticated=previewPlayer(req,res);
  if(pathname==='/api/auth/session' && req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({authenticated:!!authenticated && !guest,guest}));return;}
  if(!authenticated&&!backoffice && (pathname.startsWith('/api/')||req.method!=='GET')) {
    res.setHeader('Cache-Control','no-store');
    if(pathname.startsWith('/api/')||req.method!=='GET'){res.writeHead(401,{'Content-Type':'application/json'});res.end('{"error":"Sign in required"}');}
    else {res.writeHead(303,{Location:'/login.html'});res.end();}
    return;
  }
  if(authenticated && !backoffice && req.method==='POST' && req.headers.origin && (!URL.canParse(req.headers.origin)||new URL(req.headers.origin).host!==req.headers.host)) {
    res.writeHead(403);res.end('Invalid origin');return;
  }
  if(!backoffice) res.setHeader('Cache-Control','no-store');
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

  if (req.method === 'POST' && req.url === '/api/bo/login') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 10000) req.destroy(); });
    req.on('end', () => {
      let who = null, uname = '';
      try { const { user, pass } = JSON.parse(body || '{}'); uname = user; who = boCheckLogin(user, pass); } catch {}
      if (!who) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end('{"error":"wrong login"}'); return; }
      const tok = jwtSign({ sub: uname, role: who.role, exp: Math.floor(Date.now() / 1000) + 7 * 86400 });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': `bo_jwt=${tok}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800` });
      res.end('{"ok":true}');
    });
    return;
  }
  // the game itself reads tier config; login, password flows and /me stay
  // reachable without a session; everything else in the BO needs one
  const boOpen = (req.method === 'GET' && (req.url === '/api/bo/config' || req.url === '/api/bo/me'))
    || (req.method === 'POST' && ['/api/bo/reset-request', '/api/bo/set-password'].includes(req.url))
    || req.url === '/bo/login.html' || req.url.startsWith('/bo/set-password.html');
  if ((req.url.startsWith('/api/bo/') || req.url === '/bo' || req.url.startsWith('/bo/')) && !boOpen
      && !boSessionOk(req)) {
    if (req.url.startsWith('/api/')) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end('{"error":"login required"}'); }
    else { res.writeHead(302, { Location: '/bo/login.html' }); res.end(); }
    return;
  }
  if (req.method === 'GET' && req.url.startsWith('/api/bo/')) {
    const who = boSessionOk(req);
    if (req.url === '/api/bo/me') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(who ? { user: who.sub, role: who.role } : {}));
      return;
    }
    if (req.url === '/api/bo/users' && (who?.role !== 'superadmin')) {
      res.writeHead(403, { 'Content-Type': 'application/json' }); res.end('{"error":"superadmin only"}'); return;
    }
    const out = boApi(req.url);
    res.writeHead(out ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out ?? { error: 'not found' }));
    return;
  }
  if (req.method === 'POST' && req.url.startsWith('/api/bo/')) {
    // least role that may perform each action
    const NEED = { '/api/bo/voiceline-review': 'staff', '/api/bo/tournament': 'staff',
                   '/api/bo/pitboss': 'admin', '/api/bo/tier': 'admin', '/api/bo/room': 'admin',
                   '/api/bo/users/invite': 'superadmin', '/api/bo/apikeys/create': 'superadmin', '/api/bo/apikeys/launch': 'admin', '/api/bo/apikeys/credit': 'admin', '/api/bo/apikeys/revoke': 'superadmin', '/api/bo/apikeys/rotate': 'superadmin', '/api/bo/users/role': 'superadmin', '/api/bo/users/remove': 'superadmin', '/api/bo/users/resend': 'superadmin' };
    const PUBLIC = ['/api/bo/reset-request', '/api/bo/set-password'];
    const who = boSessionOk(req);
    if (!PUBLIC.includes(req.url)) {
      const need = NEED[req.url] ?? 'admin';
      if (!who || (ROLE_RANK[who.role] ?? -1) < ROLE_RANK[need]) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `${need} role required` }));
        return;
      }
    }
    let body = '';
    req.on('data', c => { body += c; if (body.length > 100000) req.destroy(); });
    req.on('end', async () => {
      let out = null;
      try { out = await boPost(req.url, JSON.parse(body || '{}'), who); } catch (e) { out = { error: 'bad request' }; }
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
      try { out = API[req.url]({ ...JSON.parse(body || '{}'), id: authenticated }); }
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
    // media files MUST revalidate: streams are rewritten in place under the
    // same names, and a cached .h264 against a fresh index.json kills the
    // engine (the "stale dealer" poster). ETag makes revalidation a cheap 304.
    const etag = `"${size}-${Math.round(statSync(file).mtimeMs)}"`;
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag }); res.end(); return; }
    const cache = LIVE.has(extname(file)) ? noStore(file) : { 'Cache-Control': 'no-cache', ETag: etag };
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size, ...cache });
    createReadStream(file).pipe(res);
  }
}).listen(port, host, () => console.log(`croupier demo on http://${host}:${port}`));
