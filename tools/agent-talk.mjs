import { mkdirSync, openSync, closeSync, writeFileSync, readFileSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = resolve(process.env.AGENT_TALK_TEST_DIR || resolve(root, 'agent-talk'));
const statePath = resolve(directory, 'state.json');
const lockPath = resolve(directory, 'write.lock');
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
function record(state, kind, agent, text, to) {
  state.history.push({ at: now(), kind, agent, text, ...(to ? { to } : {}) });
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
  const temp = `${statePath}.${randomUUID()}`;
  try {
    writeFileSync(lock, JSON.stringify({ pid: process.pid, at: now() }));
    const state = read();
    change(state);
    writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, { flag: 'wx' });
    renameSync(temp, statePath);
  } finally {
    closeSync(lock);
    unlinkSync(lockPath);
    try { unlinkSync(temp); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
try {
  if (command === 'status') {
    if (id) agentId(id);
    const state = read();
    console.log(JSON.stringify({
      agents: state.agents,
      pings: state.pings.filter(ping => !id || ping.to === id || ping.from === id),
      replies: id ? state.history.filter(entry => entry.kind === 'ack' && entry.to === id).slice(-8) : [],
      history: state.history.slice(-8),
    }, null, 2));
  } else {
    agentId(id);
    await update(state => {
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
        if (state.pings.length >= 40) throw new Error('40 obesvarade pingar: kvittera befintliga först.');
        const ping = { id: randomUUID().slice(0, 12), at: now(), from: id, to, text };
        state.pings.push(ping);
        console.log(ping.id);
      } else if (command === 'ack') {
        const index = state.pings.findIndex(ping => ping.id === args[0] && ping.to === id);
        if (index < 0) throw new Error('Ingen sådan ping till detta id.');
        const answer = short(args[1], 'Svar', 180);
        const ping = state.pings[index];
        record(state, 'ack', id, `${ping.from} (${ping.id}): ${answer}`, ping.from);
        state.pings.splice(index, 1);
      } else if (command === 'done') {
        if (!Object.hasOwn(state.agents, id)) throw new Error('Ingen aktiv claim för detta id.');
        record(state, 'done', id, short(args[0], 'Resultat'));
        delete state.agents[id];
      } else throw new Error('Kommandon: status, claim, ping, ack, done. Se agent-talk/README.md.');
    });
    if (command !== 'ping') console.log('OK');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
