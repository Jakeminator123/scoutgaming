import { mkdirSync, openSync, closeSync, writeFileSync, readFileSync, renameSync, unlinkSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = resolve(process.env.AGENT_TALK_TEST_DIR || resolve(root, 'agent-talk'));
const statePath = resolve(directory, 'state.json');
const lockPath = resolve(directory, 'write.lock');
const archiveRoot = resolve(process.env.AGENT_TALK_TEST_DIR ? directory : root, 'arkiv');
const capacity = 40;
const [command = 'status', id, ...args] = process.argv.slice(2);
const now = () => new Date().toISOString();
const empty = () => ({ version: 1, agents: {}, pings: [], history: [] });
const read = () => {
  try {
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    if (state.version !== 1 || !state.agents || !Array.isArray(state.pings) || !Array.isArray(state.history)) throw new Error('Ogiltig statusfil; bevara filen och undersök felet.');
    return state;
  } catch (error) { if (error.code === 'ENOENT') return empty(); throw error; }
};
function short(value, label, max = 300) {
  if (!value || value.length > max || /[\r\n\x00-\x1f]/.test(value)) throw new Error(`${label}: kräver en rad, högst ${max} tecken.`);
  return value;
}
function agentId(value) {
  if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(value || '') || ['__proto__', 'constructor', 'prototype'].includes(value)) throw new Error('Id: använd 1–40 små bokstäver, siffror, bindestreck/understreck.');
  return value;
}
function paths(value) {
  return [...new Set(short(value, 'Sökvägar', 1500).split(',').map(path => {
    const clean = path.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();
    if (!clean || clean.startsWith('/') || clean.split('/').some(p => !p || p === '.' || p === '..') || /[:*?]/.test(clean)) throw new Error('Ange relativa filer/mappar, kommaseparerat utan jokertecken.');
    return clean;
  }))];
}
const overlaps = (a, b) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
const pingId = value => /^[a-f0-9]{8}-[a-f0-9]{3}$/.test(value || '');
function entries(path) {
  try { return readdirSync(path, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
function readOptional(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
function archivedPings() {
  const records = [];
  for (const day of entries(archiveRoot)) {
    if (!day.isDirectory() || !/^\d{4}-\d{2}-\d{2}$/.test(day.name)) continue;
    const folder = resolve(archiveRoot, day.name, 'agent-talk', 'pings');
    for (const file of entries(folder)) {
      if (!file.isFile() || !pingId(file.name.replace(/\.json$/, ''))) continue;
      const path = resolve(folder, file.name), saved = readOptional(path);
      if (saved?.version !== 1 || !pingId(saved.ping?.id) || file.name !== `${saved.ping.id}.json`
        || typeof saved.archivedAt !== 'string') throw Error('Ogiltigt pingarkiv; bevara filen och undersök felet.');
      const ackPath = resolve(folder, `${saved.ping.id}.ack.json`), ack = readOptional(ackPath);
      if (ack && (ack.version !== 1 || ack.pingId !== saved.ping.id || ack.to !== saved.ping.to)) throw Error('Ogiltig arkivkvittens; bevara filen och undersök felet.');
      records.push({ ...saved, path, ackPath, ack });
    }
  }
  return records.sort((a, b) => a.archivedAt.localeCompare(b.archivedAt) || a.ping.id.localeCompare(b.ping.id));
}
function pendingArchive(state, recipient, saved = archivedPings()) {
  const live = new Set(state.pings.map(ping => ping.id));
  return saved.filter(entry => !entry.ack && !live.has(entry.ping.id) && (!recipient || entry.ping.to === recipient));
}
function repliesTo(state, recipient, saved) {
  if (!recipient) return [];
  // Archive receipts survive an interruption before the history/state commit.
  const replies = [...state.history.filter(entry => entry.kind === 'ack' && entry.to === recipient),
    ...saved.filter(entry => entry.ack && entry.ping.from === recipient).map(({ ping, ack }) => ({
      at: ack.at, kind: 'ack', agent: ping.to, text: `${ping.from} (${ping.id}): ${ack.text}`, to: ping.from }))];
  return [...new Map(replies.map(entry => [JSON.stringify(entry), entry])).values()]
    .sort((a, b) => a.at.localeCompare(b.at)).slice(-8);
}
function writeAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', flush: true });
    renameSync(temp, path);
  } finally {
    try { unlinkSync(temp); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
function archivePing(ping) {
  // The exclusive board lock covers archive and state writes. Commit the archive
  // first: a crash can leave a duplicate, but never removes the only message copy.
  const existing = archivedPings().find(entry => entry.ping.id === ping.id);
  if (existing) {
    if (JSON.stringify(existing.ping) !== JSON.stringify(ping)) throw Error('Ping-id finns redan med annat innehåll i arkivet.');
    return existing.path;
  }
  const archivedAt = now(), path = resolve(archiveRoot, archivedAt.slice(0, 10), 'agent-talk', 'pings', `${ping.id}.json`);
  if (!pingId(ping.id)) throw Error('Ogiltigt ping-id; bevara statusfilen och undersök felet.');
  writeAtomic(path, { version: 1, archivedAt, ping });
  return path;
}
function record(state, kind, agent, text, to, at = now()) {
  state.history.push({ at, kind, agent, text, ...(to ? { to } : {}) });
  state.history = state.history.slice(-40);
}
async function update(change) {
  mkdirSync(directory, { recursive: true });
  let lock;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { lock = openSync(lockPath, 'wx'); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  if (lock === undefined) throw new Error('Skrivlåset är upptaget. Försök igen; vid kvarlämnat lås, kontrollera PID i agent-talk/write.lock innan manuell borttagning.');
  try {
    writeFileSync(lock, JSON.stringify({ pid: process.pid, at: now() }));
    const state = read();
    const result = change(state);
    writeAtomic(statePath, state);
    return result;
  } finally {
    closeSync(lock);
    unlinkSync(lockPath);
  }
}
try {
  if (command === 'status') {
    const all = id === '--all';
    if (id && !all) agentId(id);
    const recipient = all ? undefined : id;
    const state = read(), saved = archivedPings();
    console.log(JSON.stringify({
      queue: { pending: state.pings.length, capacity, available: Math.max(0, capacity - state.pings.length),
        archivedPending: pendingArchive(state, recipient, saved).length, archiveCommand: `node tools/agent-talk.mjs archived ${recipient || '<mottagar-id>'}` },
      agents: state.agents,
      pings: state.pings.filter(ping => all || recipient && (ping.to === recipient || ping.from === recipient)),
      replies: repliesTo(state, recipient, saved),
      // Claims are shared coordination; directed receipts belong in replies only.
      history: state.history.filter(entry => all || !entry.to && entry.kind !== 'ack' && entry.kind !== 'archive').slice(-8),
    }, null, 2));
  } else if (command === 'archived') {
    agentId(id);
    const page = args[0] === undefined ? 1 : Number(args[0]);
    if (!Number.isSafeInteger(page) || page < 1) throw Error('Sida: ange ett positivt heltal.');
    const saved = pendingArchive(read(), id), start = (page - 1) * capacity;
    console.log(JSON.stringify({ total: saved.length, page, nextPage: start + capacity < saved.length ? page + 1 : null,
      pings: saved.slice(start, start + capacity).map(entry => ({ ...entry.ping, archivedAt: entry.archivedAt,
        archive: relative(process.env.AGENT_TALK_TEST_DIR ? directory : root, entry.path).replaceAll('\\', '/') })) }, null, 2));
  } else {
    agentId(id);
    const result = await update(state => {
      if (command === 'claim') {
        const scope = paths(args[0]);
        const summary = short(args[1], 'Uppgift');
        for (const [owner, entry] of Object.entries(state.agents)) {
          if (owner !== id && scope.some(a => entry.paths.some(b => overlaps(a, b)))) throw new Error(`Överlapp med ${owner}: ${entry.paths.join(', ')}. Använd ping och invänta överlämning.`);
        }
        if (!Object.hasOwn(state.agents, id) && Object.keys(state.agents).length >= 20) throw new Error('20 aktiva agenter: be avslutade ägare köra done.');
        const previous = state.agents[id];
        state.agents[id] = { paths: scope, summary, at: now() };
        if (!previous || previous.summary !== summary || JSON.stringify(previous.paths) !== JSON.stringify(scope)) record(state, 'start', id, summary);
      } else if (command === 'ping') {
        const to = agentId(args[0]);
        const text = short(args[1], 'Ping');
        const ping = { id: randomUUID().slice(0, 12), at: now(), from: id, to, text };
        while (state.pings.length >= capacity) {
          const oldest = state.pings[0], path = archivePing(oldest);
          record(state, 'archive', id, `Ping ${oldest.id} sparad: ${relative(root, path).replaceAll('\\', '/')}`, oldest.to);
          state.pings.shift();
        }
        state.pings.push(ping);
        return ping.id;
      } else if (command === 'ack') {
        const index = state.pings.findIndex(ping => ping.id === args[0] && ping.to === id);
        const answer = short(args[1], 'Svar', 180);
        const saved = archivedPings().find(entry => entry.ping.id === args[0] && entry.ping.to === id);
        if (index < 0 && (!saved || saved.ack)) throw new Error('Ingen obesvarad ping till detta id.');
        const ping = index >= 0 ? state.pings[index] : saved.ping;
        if (saved && JSON.stringify(saved.ping) !== JSON.stringify(ping)) throw Error('Ping-id har olika innehåll; bevara filerna och undersök felet.');
        if (!saved?.ack) {
          const at = now();
          if (saved) writeAtomic(saved.ackPath, { version: 1, pingId: ping.id, to: id, at, text: answer });
          record(state, 'ack', id, `${ping.from} (${ping.id}): ${answer}`, ping.from, at);
        }
        if (index >= 0) state.pings.splice(index, 1);
      } else if (command === 'done') {
        if (!Object.hasOwn(state.agents, id)) throw new Error('Ingen aktiv claim för detta id.');
        record(state, 'done', id, short(args[0], 'Resultat'));
        delete state.agents[id];
      } else throw new Error('Kommandon: status, archived, claim, ping, ack, done. Se agent-talk/README.md.');
    });
    console.log(command === 'ping' ? result : 'OK');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
