#!/usr/bin/env node
// Small, dependency-free GitLab inbox. Checks never post or acknowledge messages.
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const THREAD_URL = 'https://gitlab.com/scout-gg/croupier/-/work_items/1';
const API = 'https://gitlab.com/api/v4/projects/scout-gg%2Fcroupier/issues/1/notes';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OWNERS = { jakob: 'Jakob', kevin: 'Kevin', emil: 'Emil' };
const HANDLES = { jakob: 'Jakeminator123', kevin: 'Kevinnegash1' };
const digest = value => createHash('sha256').update(value).digest('hex');
const singleLine = value => String(value).replace(/[\r\n]/g, ' ').trim();

export function identity(owner, title, session) {
  owner = String(owner).toLowerCase();
  if (!OWNERS[owner] || !title?.trim() || !session?.trim()) {
    throw new Error('Use --owner Jakob|Kevin|Emil, --title and a stable --session (or CODEX_THREAD_ID).');
  }
  const key = digest(session).slice(0, 16);
  const slug = singleLine(title).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'croupier';
  return { key, id: `${owner}/${key}`, owner, name: `Agent-${slug}, ${OWNERS[owner]}` };
}

export function normalizeNote(note) {
  const id = String(note.id).replace(/^gid:\/\/gitlab\/Note\//, '');
  if (!/^\d+$/.test(id) || typeof note.body !== 'string' || !Number.isFinite(Date.parse(note.updated_at))) {
    throw new Error('Invalid note: id, body and updated_at are required.');
  }
  const body = note.body.replace(/\r\n/g, '\n');
  return { id, body, updated_at: new Date(note.updated_at).toISOString(),
    author: note.author?.username || note.author || 'unknown', system: Boolean(note.system),
    version: digest(`${id}\n${note.updated_at}\n${body}`).slice(0, 20), url: `${THREAD_URL}#note_${id}` };
}

// Metadata belongs at the start, before the blank line; quoted templates do not route a message.
export function envelope(body) {
  const block = body.split(/\n\s*\n/, 1)[0];
  if (block.split('\n')[0].trimEnd() !== 'Croupier-Inbox: 1') return null;
  const fields = {};
  for (const line of block.split('\n').slice(1)) {
    const match = /^([A-Za-z-]+): (.*)$/.exec(line);
    if (match) fields[match[1].toLowerCase()] = match[2].trimEnd();
  }
  return fields;
}

export function route(note, agent, sent = {}) {
  if (note.system) return 'ignore';
  const meta = envelope(note.body);
  if (!meta) return 'review'; // Human/unstructured notes need a relevance decision, never guess by author.
  if (meta['agent-id'] === agent.id) {
    return sent[meta['message-id']]?.id === note.id ? 'ignore' : 'review';
  }
  const targets = (meta.to || '').toLowerCase().split(',').map(s => s.trim());
  if (targets.includes(agent.id)) return 'direct';
  if (targets.includes(agent.owner) || targets.includes('all')) return 'review';
  return targets.some(s => /^(jakob|kevin|emil)(\/|$)/.test(s)) ? 'ignore' : 'review';
}

export function mergeNotes(state, notes) {
  for (const raw of notes) {
    const note = normalizeNote(raw);
    // Store latest versions even for irrelevant notes so an edit can be reconsidered.
    if (state.seen[note.id] === note.version) continue;
    if (route(note, state.agent, state.sent) === 'ignore') {
      state.seen[note.id] = note.version;
      delete state.pending[note.id];
    } else {
      state.pending[note.id] = note;
    }
  }
}

export function pendingResult(state, status = 'ok') {
  const notes = Object.values(state.pending).sort((a, b) => a.updated_at.localeCompare(b.updated_at));
  return { status, agent: state.agent, lastCheckedAt: state.lastCheckedAt || null,
    pendingCount: notes.length, notes: notes.slice(0, 10).map(n => ({
      ...n, routing: route(n, state.agent, state.sent), body: n.body.slice(0, 1800), truncated: n.body.length > 1800,
    })) };
}

export function acknowledge(state, id, version, disposition) {
  const note = state.pending[id];
  if (!note || note.version !== version) throw new Error('Note changed or is not pending. Read it again before ack.');
  if (!['delivered', 'irrelevant'].includes(disposition)) throw new Error('Use --disposition delivered|irrelevant.');
  state.seen[id] = version;
  delete state.pending[id];
}

export function formatMessage(agent, { to, kind = 'info', replyTo, body, messageId = randomUUID() }) {
  if (!['register', 'question', 'reply', 'info', 'handoff'].includes(kind)) throw new Error('Invalid --kind.');
  const targets = String(to || '').split(',').map(t => t.trim().toLowerCase());
  if (!targets.length || targets.some(t => !/^(all|jakob|kevin|emil|(?:jakob|kevin|emil)\/[a-f0-9]{16})$/.test(t))) {
    throw new Error('Use --to all, Jakob, Kevin, Emil, or an exact agent ID (comma-separated).');
  }
  if (kind === 'reply' && !/^\d+$/.test(replyTo || '')) throw new Error('Replies require --reply-to NOTE_ID.');
  if (!body?.trim() || body.length > 6000 || /^[ \t]*\//m.test(body)) {
    throw new Error('Use a short body (1–6000 chars), with no GitLab quick-action lines starting with /.');
  }
  // Human mentions only on direct questions/handoffs; no notification blast on every reply/check.
  const mentions = ['question', 'handoff'].includes(kind)
    ? [...new Set(targets.map(t => HANDLES[t.split('/')[0]]).filter(Boolean))].map(h => `@${h}`).join(' ') : '';
  const header = ['Croupier-Inbox: 1', `From: ${agent.name}`, `Agent-ID: ${agent.id}`,
    `To: ${targets.join(', ')}`, `Kind: ${kind}`, `Message-ID: ${messageId}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : [])];
  // Markdown hard breaks keep routing readable in both GitLab's UI and API.
  return `${header.map(line => `${line}  `).join('\n')}\n\n${mentions ? `${mentions}\n\n` : ''}${body.trim()}`;
}

export function apiClient(token, fetchImpl = fetch, signal = AbortSignal.timeout(8000)) {
  if (/[\r\n]/.test(token)) throw new Error('Invalid credential format.');
  return async (query = {}, options = {}) => {
    const url = new URL(API);
    url.search = new URLSearchParams(query).toString();
    const response = await fetchImpl(url, { ...options, signal, redirect: 'error',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers } });
    if (response.status === 304) return { unchanged: true };
    if (!response.ok) {
      const error = new Error(`GitLab HTTP ${response.status}; request failed.`);
      error.status = response.status;
      throw error;
    }
    return { data: await response.json(), etag: response.headers.get('etag'),
      nextPage: response.headers.get('x-next-page') || '' };
  };
}

// One tiny GET on unchanged turns. Changed turns fetch every page back to the prior watermark.
// Apply only a complete read: timeout/pagination failures leave the old cursor and pending notes intact.
export async function checkRemote(state, request) {
  const query = { order_by: 'updated_at', sort: 'desc', activity_filter: 'only_comments' };
  const head = await request({ ...query, per_page: '1' },
    { headers: state.etag ? { 'If-None-Match': state.etag } : {} });
  if (head.unchanged) { state.lastCheckedAt = new Date().toISOString(); return; }
  if (!Array.isArray(head.data)) throw new Error('Unexpected GitLab notes response.');
  const headSignature = head.data.length ? normalizeNote(head.data[0]).version : 'empty';
  if (headSignature === state.headSignature) {
    state.etag = head.etag; state.lastCheckedAt = new Date().toISOString(); return;
  }
  const collected = [];
  let page = '1';
  let complete = false;
  for (let count = 0; count < 30; count++) {
    const result = await request({ ...query, per_page: '100', page });
    if (!Array.isArray(result.data)) throw new Error('Unexpected GitLab notes page.');
    const normalized = result.data.map(normalizeNote);
    collected.push(...result.data);
    // Strict inequality preserves all notes sharing a timestamp at page boundaries.
    if (!result.nextPage || normalized.some(n => state.watermark && n.updated_at < state.watermark)) {
      complete = true; break;
    }
    page = result.nextPage;
  }
  if (!complete) throw new Error('Inbox history exceeds 30 pages; cursor preserved, manual review needed.');
  mergeNotes(state, collected);
  state.watermark = head.data.length ? normalizeNote(head.data[0]).updated_at : null;
  state.headSignature = headSignature;
  state.etag = head.etag;
  state.lastCheckedAt = new Date().toISOString();
}

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

async function saveJson(file, value) {
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temp, file);
}

export function recordSent(state, rawNote) {
  const note = normalizeNote(rawNote);
  const meta = envelope(note.body);
  const expected = state.drafts?.[meta?.['message-id']];
  if (meta?.['agent-id'] !== state.agent.id || !expected || expected !== digest(note.body)) {
    throw new Error('Observed note does not match this agent’s saved draft.');
  }
  state.sent[meta['message-id']] = { id: note.id, url: note.url };
  state.registrationNote ||= note.id;
  if (state.sending?.messageId === meta['message-id']) delete state.sending;
  return state.sent[meta['message-id']];
}

export async function acquireLock(file) {
  try {
    const handle = await open(file, 'wx');
    await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    return handle;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const previous = await readJson(file, null);
    if (Number.isInteger(previous?.pid) && previous.pid > 0) {
      try { process.kill(previous.pid, 0); }
      catch (check) {
        if (check.code === 'ESRCH') {
          // Only remove this conversation's lock after proving its process is gone.
          await unlink(file);
          return acquireLock(file);
        }
      }
    }
    throw new Error('Inbox busy or lock ownership unknown. Check .croupier-inbox/agents/*.lock before manual recovery.');
  }
}

const help = `Croupier inbox (Node 22+, no dependencies)
  init --owner Jakob --title "Granska ändringar senaste fem timmar"
  check                         One read; silent UI when there is nothing relevant.
  pending                       Read cached pending messages, no network.
  show --note ID                Full cached note.
  ack --note ID --version HASH --disposition delivered|irrelevant
  import --file notes.json       Import API/browser notes; not a remote freshness claim.
  draft --to Kevin --kind question --body-file question.txt
  send --file signed-draft.txt   Explicit external write; never called by check.
  record-sent --file note.json   Reconcile a verified API/browser comment with its saved draft.
  cancel-send --version MESSAGE_ID --disposition verified-absent
                                Only after checking GitLab for the uncertain Message-ID.
All commands use CODEX_THREAD_ID or --session STABLE_CHAT_ID (keep across turns).
Token: GITLAB_TOKEN or GITLAB_TOKEN_FILE. Never paste a token into a chat/command.
Use a GitLab connector or logged-in browser if status is transport_unavailable.
State: .croupier-inbox/ (ignored). No shared read cursor, no background polling.\n`;

export async function main(argv = process.argv.slice(2)) {
  const { values: args, positionals } = parseArgs({ args: argv, allowPositionals: true, options:
    Object.fromEntries(['owner', 'title', 'session', 'note', 'version', 'disposition', 'file', 'to', 'kind', 'reply-to', 'body-file']
      .map(key => [key, { type: 'string' }])) });
  const command = positionals[0];
  if (!command || command === 'help') { process.stdout.write(help); return; }
  const session = args.session || process.env.CODEX_THREAD_ID || process.env.CROUPIER_AGENT_SESSION;
  if (!session) throw new Error('Missing session. Pass --session once per command in IDEs without CODEX_THREAD_ID.');
  const key = digest(session).slice(0, 16);
  const directory = path.join(ROOT, '.croupier-inbox', 'agents');
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, `${key}.json`);
  // Commands for one conversation serialize; different conversations have independent files.
  const lock = await acquireLock(`${file}.lock`);
  try {
    let state = await readJson(file, null);
    if (command === 'init') {
      const agent = identity(args.owner, args.title, session);
      if (state && state.agent.owner !== agent.owner) throw new Error('Session already belongs to another owner.');
      state ||= { schema: 1, agent, seen: {}, pending: {}, sent: {}, registrationNote: null };
      state.agent = agent;
      await saveJson(file, state);
      console.log(JSON.stringify({ agent, registrationNote: state.registrationNote })); return;
    }
    if (!state) throw new Error('Run init --owner ... --title ... once for this conversation.');
    if (command === 'pending') { console.log(JSON.stringify(pendingResult(state, 'cached'))); return; }
    if (command === 'show') {
      if (!state.pending[args.note]) throw new Error('Note not pending.');
      console.log(JSON.stringify(state.pending[args.note])); return;
    }
    if (command === 'ack') {
      acknowledge(state, args.note, args.version, args.disposition);
      await saveJson(file, state); console.log(JSON.stringify({ acknowledged: args.note })); return;
    }
    if (command === 'import') {
      const notes = JSON.parse(await readFile(args.file, 'utf8'));
      if (!Array.isArray(notes)) throw new Error('Import expects an array of notes.');
      mergeNotes(state, notes); state.lastBrowserImportAt = new Date().toISOString(); await saveJson(file, state);
      console.log(JSON.stringify(pendingResult(state, 'imported_partial'))); return;
    }
    if (command === 'draft') {
      const body = await readFile(args['body-file'], 'utf8');
      const draft = formatMessage(state.agent, { to: args.to, kind: args.kind, replyTo: args['reply-to'], body });
      const target = path.join(ROOT, '.croupier-inbox', `draft-${key}-${randomUUID()}.txt`);
      await writeFile(target, draft, { mode: 0o600 });
      state.drafts ||= {};
      state.drafts[envelope(draft)['message-id']] = digest(draft);
      await saveJson(file, state);
      console.log(JSON.stringify({ draftFile: target, body: draft })); return;
    }
    if (command === 'record-sent') {
      const sent = recordSent(state, JSON.parse(await readFile(args.file, 'utf8')));
      await saveJson(file, state); console.log(JSON.stringify({ status: 'recorded', ...sent })); return;
    }
    if (command === 'cancel-send') {
      if (!state.sending || state.sending.messageId !== args.version || args.disposition !== 'verified-absent') {
        throw new Error('Verify the exact pending Message-ID is absent in GitLab, then pass it with --disposition verified-absent.');
      }
      delete state.sending;
      await saveJson(file, state); console.log(JSON.stringify({ status: 'send_unblocked', messageId: args.version })); return;
    }
    if (!['check', 'send'].includes(command)) throw new Error(`Unknown command: ${command}`);
    const token = process.env.GITLAB_TOKEN || (process.env.GITLAB_TOKEN_FILE
      ? (await readFile(process.env.GITLAB_TOKEN_FILE, 'utf8')).trim() : null);
    if (!token) {
      console.log(JSON.stringify({ ...pendingResult(state, 'transport_unavailable'),
        reason: 'No GitLab API credential. Use the connected GitLab tool or logged-in browser; do not claim no new messages.' }));
      process.exitCode = 2; return;
    }
    const request = apiClient(token);
    if (command === 'check') {
      await checkRemote(state, request); await saveJson(file, state);
      console.log(JSON.stringify(pendingResult(state))); return;
    }
    const body = await readFile(args.file, 'utf8');
    const meta = envelope(body);
    if (meta?.['agent-id'] !== state.agent.id || !meta['message-id'] || /^[ \t]*\//m.test(body)
      || state.drafts?.[meta['message-id']] !== digest(body)) {
      throw new Error('Only send a signed draft belonging to this agent, without GitLab quick actions.');
    }
    const messageId = meta['message-id'];
    if (state.sent[messageId]) {
      console.log(JSON.stringify({ status: 'already_sent', ...state.sent[messageId] })); return;
    }
    if (state.sending) throw new Error('Previous send outcome uncertain. Verify its Message-ID in GitLab before retrying.');
    // Persist intent before POST: a lost response must not produce an automatic duplicate.
    state.sending = { messageId, startedAt: new Date().toISOString() };
    await saveJson(file, state);
    let result;
    try { result = await request({}, { method: 'POST', body: JSON.stringify({ body }) }); }
    catch (error) {
      // These explicit rejections cannot have created a comment. Network/5xx outcomes stay uncertain.
      if ([400, 401, 403, 404, 422, 429].includes(error.status)) {
        delete state.sending; await saveJson(file, state);
      }
      throw error;
    }
    recordSent(state, result.data);
    await saveJson(file, state);
    console.log(JSON.stringify({ status: 'sent', ...state.sent[messageId] }));
  } finally {
    await lock.close(); await unlink(`${file}.lock`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(JSON.stringify({ status: 'error', reason: error.message })); process.exitCode = 1; });
}
