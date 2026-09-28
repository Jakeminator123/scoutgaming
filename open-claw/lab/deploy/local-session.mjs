import { mkdir, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

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
  return { ...value, token: row.token, revision: row.revision };
}

function alive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== 'ESRCH'; }
}

async function portBusy(port, host) {
  const server = createServer();
  return await new Promise(resolveBusy => {
    server.once('error', error => resolveBusy(!['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(error.code)));
    server.listen(port, host, () => server.close(() => resolveBusy(false)));
  });
}

async function occupied(state, { owner = true } = {}) {
  if (owner && alive(state.ownerPid) || state.childPids.some(alive)) return true;
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
  mutate(file, token, state => ({ ...state, childPids: [...new Set([...state.childPids, pid])] }));
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
  const initial = { ownerPid: process.pid, childPids: [], productPort, labPort };
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
