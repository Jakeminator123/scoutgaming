#!/usr/bin/env node
// Static server with Range-request support (the engine range-fetches clip
// bytes in production; locally it serves whole files and ranges alike).
// Listens on 0.0.0.0 so phones on the LAN can open the demo.
import { craigIdentity } from './craig-identity.mjs';
import { playerAuth } from './player-auth.mjs';
import { backofficeGameAuth } from './bo-game-auth.mjs';
import { createServer } from 'node:http';
import { command as shoeCommand, newGame } from './shoe-game.mjs';
import { openClawChat } from './openclaw-chat.mjs';
import { readPlayerResults } from './player-results.mjs';
import { getGeneratedSpeechService } from './generated-speech.mjs';
import { completeChatWithSpeech } from './generated-speech-chat.mjs';
import { CHAT_STAGES } from './public/chat-response.mjs';
import { createPlayerChatMemory } from './player-chat-memory.mjs';
import { createLissabonProfiles } from './lissabon-profiles.mjs';
import { installPartnerApi } from './partner-api.mjs';
import { createNativeTableCommand } from './native-table.mjs';
import { installGenerationsApi } from './generations-api.mjs';
import { openGenerationMedia, serveGenerationMedia } from './generation-media.mjs';
import { clipMapping } from './clip-mapping.mjs';
import { loginLimiter } from './login-limiter.mjs';
const boLogins = loginLimiter();
import { readFileSync as readSync, writeFileSync as writeSync } from 'node:fs';
import { statSync, createReadStream, existsSync, mkdirSync } from 'node:fs';
import { join, normalize, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, scryptSync, randomBytes, timingSafeEqual, createHmac, createHash } from 'node:crypto';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const generationDirectory = process.env.CROUPIER_GENERATIONS_DIR ? resolve(process.env.CROUPIER_GENERATIONS_DIR) : join(root, 'bo/gen');

// ---------- player database (demo money only) ----------
// An explicit directory lets local QA exercise the real player/server without
// opening the operator's databases. Production keeps its existing default.
const dataDir = process.env.CROUPIER_DATA_DIR ? resolve(process.env.CROUPIER_DATA_DIR) : join(fileURLToPath(new URL('.', import.meta.url)), 'data');
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(join(dataDir, 'croupier.db'));
const playerChatMemory = createPlayerChatMemory(db);
let presentationApi;
const activePlayerChats = new Map();
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
API['/api/table'] = createNativeTableCommand({ db, getPlayer, logTx,
  publish: observation => { if (observation.session?.partnerKeyId) partner().publishNativeRound(observation); },
  onPublishError: () => console.warn('[partner-events] Native command committed; observation could not be published.'),
});

// ---------- partner API v1 (operators / aggregators) ----------
let partnerApi = null;
const generationsApi = installGenerationsApi({ catalogPath: join(root, 'bo/generations.json'), genDir: generationDirectory,
  verdicts: () => boLoad().genVerdicts ?? {}, tokenDigests: () => (process.env.GENERATIONS_READ_TOKENS ?? secretFromFiles('GENERATIONS_READ_TOKENS')).split(',').filter(Boolean),
  publicUrl: process.env.PUBLIC_URL ?? 'https://bettalotto.se',
  mapping: () => clipMapping({ root, bo: boLoad(), publicUrl: process.env.PUBLIC_URL ?? 'https://bettalotto.se', revision: (() => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8', timeout: 2000 }).trim(); } catch { return null; } })() }) });
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
  clipLandings: {},
  genLandings: {},
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
  if (url === '/api/bo/gen-verdicts') return { genVerdicts: cfg.genVerdicts ?? {}, genLandings: cfg.genLandings ?? {}, parts: CLIP_PARTS };
  if (url === '/api/bo/clips') return { parts: CLIP_PARTS, dealers: dealerScan().map(d => ({ key: d.key, name: d.name })), clips: clipScan(), assignments: cfg.clipAssignments ?? {}, neverAgain: cfg.neverAgain ?? {}, landings: cfg.clipLandings ?? {} };
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
  if (url === '/api/bo/clip-landing') {
    // Human-verified observation: which table part the card in this clip actually went to. Separate from assignment.
    const { clip, part, note } = body ?? {};
    if (typeof clip !== 'string' || !clip) return { error: 'bad clip' };
    cfg.clipLandings ??= {};
    if (!part) delete cfg.clipLandings[clip];
    else { if (!CLIP_PARTS.includes(part)) return { error: 'bad part' }; cfg.clipLandings[clip] = { part, note: String(note ?? '').slice(0, 200), by: who?.sub ?? who ?? null, at: new Date().toISOString() }; }
    boSave(cfg); return { ok: true, landings: cfg.clipLandings };
  }
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
  if (url === '/api/bo/gen-landing') {
    // Generations page: which table part the card in this video actually went to, marked by a human.
    const { id, part, note } = body ?? {};
    if (typeof id !== 'string' || !id) return { error: 'bad id' };
    cfg.genLandings ??= {};
    if (!part) delete cfg.genLandings[id];
    else { if (!CLIP_PARTS.includes(part)) return { error: 'bad part' }; cfg.genLandings[id] = { part, note: String(note ?? '').slice(0, 200), by: who?.sub ?? who ?? null, at: new Date().toISOString() }; }
    boSave(cfg); return { ok: true, genLandings: cfg.genLandings };
  }
  if (url === '/api/bo/gen-verdict') {
    // Generations page: want / don't want per Higgsfield video, so nobody re-reviews the same output.
    const { id, verdict, reason } = body ?? {};
    if (typeof id !== 'string' || !id) return { error: 'bad id' };
    cfg.genVerdicts ??= {};
    if (!verdict) delete cfg.genVerdicts[id];
    else if (verdict === 'want' || verdict === 'no') cfg.genVerdicts[id] = { verdict, reason: String(reason ?? '').slice(0, 300), by: who?.sub ?? who ?? null, at: new Date().toISOString() };
    else return { error: 'bad verdict' };
    boSave(cfg); return { ok: true, genVerdicts: cfg.genVerdicts };
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

// Dealer chat now runs exclusively through the deployed OpenClaw gateway.
// Product chat has one active decision owner: OpenClaw. It receives only this
// freshly projected public state and a closed speech/media allowlist.
const CHAT_DEALERS = Object.freeze({ vera: 'dealer', astrid: 'dealers/astrid', amira: 'dealers/amira', mei: 'dealers/mei' });
const CHAT_REVISION = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;

function chatSpeechPolicy(dealerId) {
  // The local Astrid renderer cannot verify legacy bank lines against its
  // replacement films. Direct chat must use exact generated speech there.
  if (process.env.CROUPIER_STREAM_LANE === 'lissabon-stream-lane' && dealerId === 'astrid') {
    return { recordedLines: [], generatedText: true, silence: true, mediaFamilies: [] };
  }
  let bank = {};
  try { bank = JSON.parse(readSync(join(root, CHAT_DEALERS[dealerId], 'audio/en/bank.json'), 'utf8')); }
  catch { /* Generated text or silence remains available. */ }
  const recordedLines = Object.entries(bank)
    .filter(([lineId, line]) => /^[a-z0-9_]{1,64}$/.test(lineId) && typeof line?.text === 'string' && line.text.trim()
      && !(dealerId === 'vera' && ['rules_decks', 'fair_rng'].includes(lineId)))
    .map(([lineId, line]) => ({ lineId, exactText: line.text.trim(), familyId: `${dealerId}.speak.${lineId}`, variantIds: [] }));
  return {
    recordedLines, generatedText: true, silence: true,
    mediaFamilies: recordedLines.map(({ familyId, variantIds }) => ({ familyId, variantIds })),
  };
}

function authoritativeChatStatus(playerId, session, request) {
  const saved = db.prepare('SELECT state FROM blackjack_tables WHERE player_id=?').get(playerId);
  const game = saved ? JSON.parse(saved.state) : newGame();
  const view = shoeCommand(game, { op: 'state' }, 0).view;
  if (request.roundRevision !== String(view.version)) {
    const error = new Error('stale_round_revision'); error.statusCode = 409; throw error;
  }
  const receipt = db.prepare('SELECT version,payload FROM native_presentations WHERE player_id=?').get(playerId);
  let publishedEvents = [];
  if (receipt?.version === view.version) {
    try { publishedEvents = JSON.parse(receipt.payload); } catch { /* Invalid stored observations are never forwarded. */ }
  }
  const occupiedBoxes = [...new Set((view.round?.hands ?? []).map(hand => hand.box))].filter(Number.isInteger);
  const player = getPlayer(playerId);
  return {
    dealerId: request.dealerId, sessionRevision: request.sessionRevision, roundRevision: String(view.version),
    displayName: session?.displayName ?? player?.name ?? 'spelaren',
    ...(process.env.CROUPIER_STREAM_LANE === 'lissabon-stream-lane'
      ? { playResults: readPlayerResults(db, playerId, game, player.currency) } : {}),
    round: view.round, occupiedBoxes, publishedEvents, policy: chatSpeechPolicy(request.dealerId),
  };
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

const scoutIdentity=craigIdentity(boDb);
const auth=playerAuth(db,apiPlayer,scoutIdentity);
const validLaunch=token=>{const claims=jwtVerify(token);return !!(claims?.sub&&claims.partner&&getPlayer(claims.sub));};
const boGameAuth=backofficeGameAuth({db,auth,identity:scoutIdentity,boSession:boSessionOk,validLaunch,publicUrl:process.env.PUBLIC_URL??'https://bettalotto.se',boUrl:BO_URL});
const guestPreview = process.env.DEMO_GUEST_ACCESS === '1';
const lissabonProfiles = createLissabonProfiles({ db, createPlayer: apiPlayer,
  enabled: guestPreview && process.env.HOST === '127.0.0.1' && process.env.CROUPIER_STREAM_LANE === 'lissabon-stream-lane'
    && process.env.CROUPIER_LISSABON_PROFILES === '1' && process.env.NODE_ENV !== 'production',
  onSwitch: playerId => { for (const dealerId of Object.keys(CHAT_DEALERS)) activePlayerChats.get(JSON.stringify([playerId, dealerId]))?.abort('demo_profile_changed'); },
});
const playerSession = req => lissabonProfiles.session(req) ?? auth.session(req);
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
function chatSessionOwner(req, playerId) {
  const localProfile = lissabonProfiles.session(req);
  if (localProfile?.playerId === playerId) return localProfile.owner;
  const playerToken = (req.headers.cookie ?? '').match(/(?:^|;\s*)player_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (playerToken && auth.session(req)?.playerId === playerId) return `player-${createHash('sha256').update(playerToken).digest('hex')}`;
  const previewToken = (req.headers.cookie ?? '').match(/(?:^|;\s*)preview_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (guestPreview && previewToken) {
    const digest = createHash('sha256').update(previewToken).digest('hex');
    const session = db.prepare('SELECT player_id FROM preview_sessions WHERE digest=? AND expires>?').get(digest, Date.now());
    if (session?.player_id === playerId) return `preview-${digest}`;
  }
  throw Object.assign(new Error('stale_chat_session'), { statusCode: 401 });
}
createServer(async (req, res) => {
  const pathname=new URL(req.url,'http://local').pathname;
  if(boGameAuth(req,res))return;
  { const u=new URL(req.url,'http://local'); const launch=u.searchParams.get('launch');
    if(['/', '/v2', '/v2/'].includes(pathname) && launch){ const claims=jwtVerify(launch);
      if(!claims?.sub||!claims.partner||!getPlayer(claims.sub)){res.writeHead(403,{'Content-Type':'text/plain'});res.end('Launch token invalid or expired');return;}
      u.searchParams.delete('launch');
      const sessionCookie=auth.fromPartner(req,claims);
      res.writeHead(303,{Location:u.pathname+u.search,'Set-Cookie':sessionCookie});res.end();return; } }
  try { if(await auth.handle(req,res))return; } catch { res.writeHead(400);res.end('Invalid request');return; }
  if(pathname==='/login.html'){res.writeHead(303,{Location:'/'});res.end();return;}
  if(pathname.startsWith('/api/v1/generations')&&await generationsApi(req,res,pathname))return;
  if(pathname==='/api/v1/events'&&req.method==='GET'){ partner().handleEvents(req,res,new URL(req.url,'http://local')); return; }
  if(pathname.startsWith('/api/v1/')){ if(req.method!=='POST'){res.writeHead(405,{'Content-Type':'application/json'});res.end('{"error":"POST only"}');return;} await partner().handle(req,res,pathname); return; }
  const backoffice=pathname==='/bo'||pathname.startsWith('/bo/')||pathname.startsWith('/api/bo/');
  let authenticated=playerSession(req)?.playerId ?? null;
  const guest=guestPreview && !authenticated && !backoffice && (pathname.startsWith('/api/') || pathname==='/chat');
  if(guest)authenticated=previewPlayer(req,res);
  if (await lissabonProfiles.handle(req, res, pathname, authenticated)) return;
  if(pathname==='/api/auth/session' && req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({authenticated:!!authenticated && !guest,guest,...(lissabonProfiles.enabled ? {localDemoProfiles:true} : {})}));return;}
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
  if (pathname.startsWith('/api/presentation/') || pathname.startsWith('/presentation-runtime/') || pathname === '/lab/policies/idle-policy.seed.json') {
    try {
      presentationApi ??= (await import('./presentation-api.mjs')).createPresentationApi({ db });
      if (await presentationApi(req, res, pathname, authenticated)) return;
    } catch { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Local presentation unavailable' })); return; }
  }
  if (pathname === '/api/chat/memory' || pathname === '/api/chat/memory/forget') {
    const respond = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }); res.end(JSON.stringify(value)); };
    const handle = incoming => {
      try {
        chatSessionOwner(req, authenticated);
        const dealerId = incoming.dealer;
        if (!Object.hasOwn(CHAT_DEALERS, dealerId)) throw Object.assign(new Error('invalid_chat_dealer'), { statusCode: 400 });
        const scope = { playerId: authenticated, dealerId };
        if (pathname.endsWith('/forget')) {
          const key = JSON.stringify([authenticated, dealerId]);
          activePlayerChats.get(key)?.abort('chat_memory_changed');
          respond(200, playerChatMemory.forget(scope));
        } else respond(200, playerChatMemory.profile(scope));
      } catch (error) { respond(error.statusCode || 400, { error: error.code || error.message }); }
    };
    if (pathname === '/api/chat/memory' && req.method === 'GET') handle({ dealer: new URL(req.url, 'http://local').searchParams.get('dealer') });
    else if (pathname.endsWith('/forget') && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; if (body.length > 2000) req.destroy(); });
      req.on('end', () => { try { handle(JSON.parse(body || '{}')); } catch { respond(400, { error: 'invalid_request' }); } });
    } else respond(405, { error: 'method_not_allowed' });
    return;
  }
  if (pathname.startsWith('/api/generated-speech/')) {
    try {
      const match = /^\/api\/generated-speech\/([a-f0-9-]{32,64})\/(audio|video)$/.exec(pathname);
      const service = getGeneratedSpeechService();
      if (!match || !service || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); res.end(); return; }
      const media = await service.media({ id: match[1], kind: match[2], owner: chatSessionOwner(req, authenticated) });
      res.writeHead(200, { 'Content-Type': media.contentType, 'Content-Length': media.bytes.length, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : media.bytes);
    } catch (error) { res.writeHead(error.statusCode || 404); res.end(); }
    return;
  }
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
    if(req.headers.origin && (!URL.canParse(req.headers.origin)||new URL(req.headers.origin).host!==req.headers.host)){res.writeHead(403);res.end('Invalid origin');return;}
    let body = '';
    req.on('data', c => { body += c; if (body.length > 10000) req.destroy(); });
    req.on('end', () => {
      let who = null, uname = '';
      try { uname = JSON.parse(body || '{}').user; } catch {}
      if (boLogins.blocked(req, uname)) { res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '900' }); res.end('{"error":"too many login attempts, try again in 15 minutes"}'); return; }
      try { const { user, pass } = JSON.parse(body || '{}'); who = boCheckLogin(user, pass); } catch {}
      if (!who) { boLogins.fail(req, uname); console.warn('[bo] failed login', uname, boLogins.ipOf(req)); res.writeHead(401, { 'Content-Type': 'application/json' }); res.end('{"error":"wrong login"}'); return; }
      boLogins.ok(req, uname);
      const tok = jwtSign({ sub: uname, role: who.role, aud:'backoffice', source_stamp:scoutIdentity.find(uname)?.stamp, exp: Math.floor(Date.now() / 1000) + 7 * 86400 });
      const secure=(req.socket.encrypted||process.env.NODE_ENV==='production')?'; Secure':'';
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control':'no-store', 'Set-Cookie': `bo_jwt=${tok}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}` });
      res.end('{"ok":true}');
    });
    return;
  }
  // the game itself reads tier config; login, password flows and /me stay
  // reachable without a session; everything else in the BO needs one
  const boOpen = (req.method === 'GET' && (req.url === '/api/bo/config' || req.url === '/api/bo/me'))
    || (req.method === 'POST' && ['/api/bo/reset-request', '/api/bo/set-password'].includes(req.url))
    || pathname === '/bo/login.html' || req.url.startsWith('/bo/set-password.html');
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
    const controller = new AbortController();
    const stream = req.headers.accept === 'application/x-ndjson';
    const startedAt = performance.now();
    const frame = value => {
      if (res.destroyed || res.writableEnded) return;
      if (!res.headersSent) res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
      res.write(JSON.stringify(value) + '\n');
    };
    const disconnected = () => { if (!res.writableEnded) controller.abort(); };
    res.once('close', disconnected);
    let body = '';
    req.on('data', c => { body += c; if (body.length > 20000) req.destroy(); });
    req.on('end', async () => {
      let memoryTurn, memoryKey;
      try {
        const incoming = JSON.parse(body || '{}');
        const dealerId = Object.hasOwn(CHAT_DEALERS, incoming.dealer) ? incoming.dealer : null;
        if (!dealerId || !CHAT_REVISION.test(incoming.sessionRevision) || !CHAT_REVISION.test(incoming.roundRevision)) {
          res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"error":"invalid_chat_context"}'); return;
        }
        const session = playerSession(req);
        const status = authoritativeChatStatus(authenticated, session, { dealerId, sessionRevision: incoming.sessionRevision, roundRevision: incoming.roundRevision });
        const owner = chatSessionOwner(req, authenticated);
        const scope = { playerId: authenticated, dealerId };
        memoryTurn = playerChatMemory.begin({ ...scope, requestId: incoming.requestId, message: incoming.message });
        memoryKey = JSON.stringify([authenticated, dealerId]);
        activePlayerChats.set(memoryKey, controller);
        // Neither a browser-supplied player ID nor fabricated assistant history
        // may enter the model. Stable identity and bounded recall are server-owned.
        const request = { requestId: incoming.requestId, message: incoming.message, history: memoryTurn.history };
        const readStatus = () => {
          if (playerChatMemory.profile(scope).revision !== memoryTurn.revision) throw Object.assign(new Error('stale_chat_memory'), { statusCode: 409 });
          return authoritativeChatStatus(authenticated, playerSession(req), { dealerId, sessionRevision: incoming.sessionRevision, roundRevision: incoming.roundRevision });
        };
        const decision = await completeChatWithSpeech({ request, status, owner,
          onProgress: (stage, metrics) => { if (stream && Object.hasOwn(CHAT_STAGES, stage)) frame({ type: 'progress', stage, elapsedMs: Math.round(performance.now() - startedAt), ...(metrics ? { metrics } : {}) }); },
          onDecision: exactText => { if (stream) frame({ type: 'preview', exactText }); },
          readOwner: () => chatSessionOwner(req, authenticated),
          readStatus,
          signal: controller.signal,
          decide: (value, state) => openClawChat(value, state, { fetchImpl: (url, options = {}) => fetch(url, {
            ...options, signal: options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal,
          }) }),
          service: getGeneratedSpeechService(),
        });
        // completeChatWithSpeech rechecks ownership/round after all async work.
        // Persist a generated response, never claim the browser has played it.
        memoryTurn.commit({ kind: decision.kind, exactText: decision.exactText });
        if (stream) { frame({ type: 'result', decision }); res.end(); return; }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(decision));
      } catch (e) {
        if (controller.signal.aborted) memoryTurn?.cancel(); else memoryTurn?.fail();
        if (res.destroyed) return;
        if (stream && res.headersSent) {
          frame({ type: 'error', error: controller.signal.aborted ? 'chat_cancelled' : e?.code || String(e.message || e) });
          res.end(); return;
        }
        if (controller.signal.aborted) {
          res.writeHead(409, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ error: controller.signal.reason === 'chat_memory_changed' ? 'chat_memory_changed' : 'chat_cancelled' }));
          return;
        }
        const status = Number.isInteger(e?.statusCode) ? e.statusCode : 502;
        res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ error: e?.code || String(e.message || e) }));
      } finally {
        if (activePlayerChats.get(memoryKey) === controller) activePlayerChats.delete(memoryKey);
        res.removeListener('close', disconnected);
      }
    });
    return;
  }
  if (req.method === 'POST' && API[req.url]) {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 10000) req.destroy(); });
    req.on('end', () => {
      let out;
      try {
        const activeSession=playerSession(req);
        out = API[req.url]({ ...JSON.parse(body || '{}'), id: authenticated }, req.url === '/api/table' ? activeSession : null);
        if(req.url==='/api/player'&&activeSession?.displayName&&!out?.error)out={...out,name:activeSession.displayName};
      }
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
  if (decoded === '/bo') { res.writeHead(303, { Location: '/bo/' + url.search }); res.end(); return; }
  let path = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const generationPath = '/' + path.replace(/\\/g, '/').replace(/^\/+/, '');
  const generationPrefix = /^\/bo[ .]*\/gen[ .]*\//i.exec(generationPath);
  if (generationPrefix) {
    // Repeat auth after decoding/normalization so encoded slashes cannot bypass
    // the ordinary BO gate above. Windows also ignores directory casing and
    // trailing dots/spaces. None of these aliases may fall through to static files.
    if (!boSessionOk(req)) { res.writeHead(302, { Location: '/bo/login.html' }); res.end(); return; }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
    let catalog; try { catalog = JSON.parse(readSync(join(root, 'bo/generations.json'), 'utf8')); } catch { catalog = []; }
    const media = openGenerationMedia({ directory: generationDirectory, catalog, fileName: generationPath.slice(generationPrefix[0].length) });
    if (!media) { res.writeHead(404, { 'Cache-Control': 'no-store' }); res.end('not found'); return; }
    serveGenerationMedia(req, res, media); return;
  }
  if (['/v2', '/v2/', '/v2/index.html'].includes(decoded)) path = '/index.html';
  if (path === '/' || path === '\\') path = '/index.html';
  if (/[/\\]$/.test(path)) path += 'index.html';   // directory index on Windows and POSIX
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
