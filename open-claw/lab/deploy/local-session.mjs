import { mkdir, realpath } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';

const SESSION_DB = 'CROUPIER_LOCAL_SESSION_DB';
const SESSION_TOKEN = 'CROUPIER_LOCAL_SESSION_TOKEN';

function database(file, action) {
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA busy_timeout=2000; CREATE TABLE IF NOT EXISTS local_session(id INTEGER PRIMARY KEY CHECK(id=1),token TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL)');
    return action(db);
  } finally { db.close(); }
}

function read(db) {
  const row = db.prepare('SELECT token,revision,payload FROM local_session WHERE id=1').get();
  if (!row) return null;
  const value = JSON.parse(row.payload);
  if (!Number.isInteger(value.ownerPid) || !Array.isArray(value.childPids)
    || ![value.productPort, value.labPort].filter(port => port !== null).every(port => Number.isInteger(port) && port > 0 && port <= 65535)
    || !Number.isInteger(value.labPort)
    || !value.childPids.every(pid => Number.isInteger(pid) && pid > 0)) throw new Error('Croupiers sessionspost är ogiltig; ingen ny session startades.');
  if (value.processIdentities !== undefined && (!value.processIdentities || typeof value.processIdentities !== 'object' || Array.isArray(value.processIdentities)
    || Object.entries(value.processIdentities).some(([pid, identity]) => !/^[1-9]\d*$/.test(pid) || !identity || typeof identity.name !== 'string'
      || typeof identity.startTime !== 'string' || !identity.startTime))) throw new Error('Croupiers processidentitet är ogiltig; ingen ny session startades.');
  return { ...value, token: row.token, revision: row.revision };
}

function alive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== 'ESRCH'; }
}

// An absent inspection is inconclusive, so fail closed. Old sessions only kept
// PIDs: retain known launch/build runtimes, but a verified conhost/browser/etc.
// cannot be one of those processes merely because Windows reused its PID.
export function matchesLocalSessionProcess(identity, current) {
  if (!current) return true;
  if (identity) return current.startTime ? identity.startTime === current.startTime : true;
  if (!current.name) return true;
  return /^(node|nodejs|npm|npx|cmd|powershell|pwsh|sh|bash|dash|bun|deno)(\.exe)?$/i.test(current.name)
    || /^(next-server|next-router|croupier)(?:\b|[-(])/i.test(current.name);
}

function processSnapshots(pids) {
  const live = [...new Set(pids)].filter(alive);
  if (!live.length) return new Map();
  const snapshots = new Map(live.map(pid => [pid, null]));
  try {
    if (process.platform === 'win32') {
      // One inspection for live PIDs only, outside every SQLite transaction.
      // Ticks are strings: a JSON number would lose process-start precision.
      const script = `$rows = @(Get-Process -Id ${live.join(',')} -ErrorAction SilentlyContinue | ForEach-Object { $entry = $_; $started = $null; try { $started = $entry.StartTime.ToUniversalTime().Ticks.ToString() } catch {}; @{ pid = $entry.Id; name = $entry.ProcessName; startTime = $started } }); ConvertTo-Json -InputObject $rows -Compress`;
      const output = execFileSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
        windowsHide: true, encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'],
      });
      const rows = JSON.parse(output.replace(/^\uFEFF/, ''));
      for (const row of Array.isArray(rows) ? rows : [rows]) if (snapshots.has(row?.pid)) snapshots.set(row.pid, { name: row.name, startTime: row.startTime });
    } else if (process.platform === 'linux') {
      const boot = readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim();
      for (const pid of live) {
        try {
          const stat = readFileSync(`/proc/${pid}/stat`, 'utf8'), end = stat.lastIndexOf(')');
          snapshots.set(pid, { name: stat.slice(stat.indexOf('(') + 1, end), startTime: `${boot}:${stat.slice(end + 2).split(/\s+/)[19]}` });
        } catch { /* A process may exit between liveness and inspection. */ }
      }
    } else {
      const output = execFileSync('ps', ['-p', live.join(','), '-o', 'pid=,lstart=,comm='], { encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] });
      for (const line of output.trim().split('\n')) {
        const match = line.trim().match(/^(\d+)\s+((?:\S+\s+){4}\S+)\s+(.+)$/);
        if (match) snapshots.set(Number(match[1]), { name: match[3].split('/').at(-1), startTime: match[2] });
      }
    }
  } catch { /* Permission/inspection failures keep the live PID protected. */ }
  return snapshots;
}

function processIdentity(pid) {
  const identity = processSnapshots([pid]).get(pid);
  return identity?.startTime && typeof identity.name === 'string' ? identity : null;
}

async function portBusy(port, host) {
  const server = createServer();
  return await new Promise(resolveBusy => {
    server.once('error', error => resolveBusy(!['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(error.code)));
    server.listen(port, host, () => server.close(() => resolveBusy(false)));
  });
}

async function occupied(state, { owner = true } = {}) {
  const snapshots = processSnapshots([...(owner ? [state.ownerPid] : []), ...state.childPids]);
  if ([...snapshots].some(([pid, current]) => matchesLocalSessionProcess(state.processIdentities?.[pid], current))) return true;
  for (const port of [state.productPort, state.labPort].filter(port => port !== null)) {
    if (await portBusy(port, '127.0.0.1') || await portBusy(port, '::1')) return true;
  }
  return false;
}

function conflict(state) {
  return Object.assign(new Error(`En lokal Croupier-session finns redan: ${state.productPort === null ? 'fristående labb' : `produkt ${state.productPort}, labb`} ${state.labPort}. Stoppa dess startprocess och kvarvarande barn innan en ny session startas.`), {
    code: 'CROUPIER_SESSION_ACTIVE', ports: { product: state.productPort, lab: state.labPort },
  });
}

function mutate(file, token, change) {
  return database(file, db => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const state = read(db);
      if (!state || state.token !== token) throw new Error('Croupiers session har ersatts; barnprocessen får inte starta.');
      const next = change(state);
      const result = db.prepare('UPDATE local_session SET payload=?,revision=revision+1 WHERE id=1 AND token=? AND revision=?')
        .run(JSON.stringify(next), token, state.revision);
      if (result.changes) return next;
    }
    throw new Error('Croupiers session ändrades samtidigt; försök igen.');
  });
}

export function registerLocalSessionChild(file, token, pid = process.pid) {
  if (!Number.isInteger(pid) || pid <= 0) throw new Error('Invalid Croupier child PID.');
  const identity = processIdentity(pid);
  mutate(file, token, state => ({ ...state, childPids: [...new Set([...state.childPids, pid])],
    processIdentities: { ...state.processIdentities, ...(identity ? { [pid]: identity } : {}) } }));
}

// Runs through NODE_OPTIONS before a server/build (including inherited workers).
// A child of a crashed launcher either registers before stale takeover or fails
// here before it can bind a port or change the shared Next build.
export function registerLocalSessionProcess() {
  const file = process.env[SESSION_DB], token = process.env[SESSION_TOKEN];
  if (!file || !token) throw new Error('Croupier child needs its active local session.');
  registerLocalSessionChild(file, token);
}

export async function acquireLocalSession({ repoRoot, productPort = null, labPort }) {
  if (!Number.isInteger(labPort) || ![productPort, labPort].filter(port => port !== null).every(port => Number.isInteger(port) && port > 0 && port <= 65535) || productPort === labPort) {
    throw new Error('Croupier requires two distinct valid local ports.');
  }
  const root = await realpath(resolve(repoRoot));
  const directory = join(root, 'lissabon', 'data');
  await mkdir(directory, { recursive: true });
  const file = join(directory, '.local-session.sqlite');
  const token = randomUUID();
  const identity = processIdentity(process.pid);
  const initial = { ownerPid: process.pid, childPids: [], productPort, labPort, processIdentities: identity ? { [process.pid]: identity } : {} };
  for (;;) {
    const { inserted, current } = database(file, db => {
      const inserted = db.prepare('INSERT OR IGNORE INTO local_session(id,token,revision,payload) VALUES(1,?,1,?)').run(token, JSON.stringify(initial));
      return { inserted: Boolean(inserted.changes), current: inserted.changes ? null : read(db) };
    });
    if (inserted) break;
    if (!current) continue;
    if (await occupied(current)) throw conflict(current);
    // A competing starter or newly registered orphan child changes the revision.
    const reclaimed = database(file, db => db.prepare('UPDATE local_session SET token=?,revision=revision+1,payload=? WHERE id=1 AND token=? AND revision=?')
      .run(token, JSON.stringify(initial), current.token, current.revision).changes);
    if (reclaimed) break;
  }
  let released = false;
  const preload = `import {registerLocalSessionProcess} from ${JSON.stringify(import.meta.url)};registerLocalSessionProcess();`;
  return {
    environment(env) {
      if (released) throw new Error('Croupier session has stopped.');
      return { ...env, [SESSION_DB]: file, [SESSION_TOKEN]: token,
        NODE_OPTIONS: `--import=data:text/javascript;base64,${Buffer.from(preload).toString('base64')} ${env.NODE_OPTIONS || ''}`.trim() };
    },
    trackChild(child) {
      if (released) throw new Error('Croupier session has stopped.');
      if (child?.pid) registerLocalSessionChild(file, token, child.pid);
    },
    async release() {
      if (released) return;
      // Relinquish the launcher even if a child survived. Its PID/ports continue
      // protecting the session; a later start may recover only after they exit.
      mutate(file, token, state => ({ ...state, ownerPid: 0 }));
      released = true;
      const state = database(file, read);
      if (!state || state.token !== token) return;
      if (await occupied(state, { owner: false })) return;
      database(file, db => db.prepare('DELETE FROM local_session WHERE id=1 AND token=? AND revision=?').run(token, state.revision));
    },
  };
}
