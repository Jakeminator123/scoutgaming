#!/usr/bin/env node
// Team inbox for Jakob, John, Kevin and Emil, kept as GitHub Issues on the policy repository.
// Not the retired GitLab inbox: nothing here reads or writes .croupier-inbox/.
//
//   node tools/inbox.mjs send --to john,kevin --subject "Rubrik" --body-file brev.md [--decision] [--from "Namn"]
//   node tools/inbox.mjs ping --to kevin --message "Kort fråga till dig eller din agent"   (same as send, inline text)
//   node tools/inbox.mjs register --device jakob-bgvp01j --email <ChatGPT account email>
//   node tools/inbox.mjs identity
//   node tools/inbox.mjs list [--to kevin | --to me] [--all]      ("me" = local device, otherwise branch owner)
//   node tools/inbox.mjs read <nummer>
//   node tools/inbox.mjs reply <nummer> --body-file svar.md | --message "Svar"
//   node tools/inbox.mjs done <nummer>
//   node tools/inbox.mjs labels
// Reaches people and their agents in other branches and on other machines through GitHub Issues.
import { execFileSync } from 'node:child_process';
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const readJson = file => JSON.parse(readFileSync(resolve(root, file), 'utf8'));
export const REPO = readJson('tools/repository-policy.json').repository;
export const PEOPLE = Object.freeze(readJson('inbox/people.json'));
export const DEVICES = Object.freeze(readJson('inbox/devices.json'));
export const TARGETS = Object.freeze({ ...PEOPLE, ...Object.fromEntries(Object.entries(DEVICES).map(([id, device]) => {
  if (PEOPLE[id] || !PEOPLE[device.owner]) throw new Error(`Ogiltig dator i inbox/devices.json: ${id}`);
  return [id, { ...device, github: PEOPLE[device.owner].github }];
})) });
export const LABELS = Object.freeze({ inbox: 'inbox', decision: 'beslut', to: name => `till:${name}` });
const localIdentityFile = resolve(root, 'inbox/local-device.json');

export function registerDevice({ device, email }, { file = localIdentityFile, host = hostname(), workspace = root } = {}) {
  device = String(device ?? '').trim().toLowerCase();
  if (!Object.hasOwn(DEVICES, device)) throw new Error(`Okänd dator "${device}". Kända: ${Object.keys(DEVICES).join(', ')}.`);
  email = String(email ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Ange ChatGPT-kontots mejladress med --email.');
  const identity = { version: 1, device, accountEmail: email, hostname: host, workspace: resolve(workspace) };
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(identity, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
  return identity;
}

export function readLocalIdentity({ file = localIdentityFile, host = hostname(), workspace = root } = {}) {
  let contents;
  try { contents = readFileSync(file, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  let identity;
  try { identity = JSON.parse(contents); }
  catch { throw new Error('Ogiltig lokal inboxidentitet. Kör register på den här datorn.'); }
  if (identity?.version !== 1 || !Object.hasOwn(DEVICES, identity.device) ||
      typeof identity.accountEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.accountEmail) ||
      identity.hostname !== host || identity.workspace !== resolve(workspace)) {
    throw new Error('Inboxidentiteten matchar inte denna dator och checkout. Kör register här.');
  }
  return identity;
}

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { positional: [] };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg.startsWith('--')) { options.positional.push(arg); continue; }
    const key = arg.slice(2);
    if (key === 'decision' || key === 'all') { options[key] = true; continue; }
    const value = rest[++i];
    if (value === undefined || value.startsWith('--')) throw new Error(`--${key} behöver ett värde.`);
    options[key] = value;
  }
  return { command, options };
}

// Branch ownership is independent of per-device inbox routing.
export function ownerOfBranch(branch) {
  const entry = Object.entries(PEOPLE).find(([, person]) => person.branch === branch);
  if (!entry) throw new Error(`Ingen i inbox/people.json äger grenen "${branch}". Ange --to med ett namn.`);
  return entry[0];
}

function currentBranch() {
  try { return execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8', windowsHide: true }).trim(); } catch { return ''; }
}

export function recipients(list, branch = currentBranch(), device = null) {
  if (device !== null && !Object.hasOwn(DEVICES, device)) throw new Error(`Okänd dator "${device}".`);
  const names = String(list ?? '').split(',').map(name => name.trim().toLowerCase()).filter(Boolean)
    .map(name => name === 'me' ? device ?? ownerOfBranch(branch) : name);
  if (!names.length) throw new Error('Ange mottagare med --to, till exempel --to john,kevin.');
  for (const name of names) if (!Object.hasOwn(TARGETS, name)) throw new Error(`Okänd mottagare "${name}". Kända: ${Object.keys(TARGETS).join(', ')}, me.`);
  return [...new Set(names)];
}

function messageBody(options) {
  if (options.message && options['body-file']) throw new Error('Ange antingen --message eller --body-file.');
  if (options.message) return options.message;
  if (options['body-file']) return readFileSync(resolve(options['body-file']), 'utf8');
  throw new Error('Ange --message "text" eller --body-file fil.md.');
}

export function labelsFor(to, decision = false) {
  return [LABELS.inbox, ...(decision ? [LABELS.decision] : []), ...to.map(LABELS.to)];
}

// People without an accepted GitHub invitation are named in plain text; a mention would not reach them.
export function composeBody({ to, from, body, decision = false, collaborators = [] }) {
  const line = to.map(name => {
    const person = TARGETS[name];
    const mention = person.github && collaborators.includes(person.github) ? `@${person.github}` : null;
    if (Object.hasOwn(DEVICES, name)) return `${person.name} (\`${name}\`; ${mention ?? 'GitHub-inbjudan väntar'})`;
    return mention ?? `${person.name} (GitHub-inbjudan väntar)`;
  }).join(', ');
  return [
    `**Till:** ${line}`,
    `**Från:** ${from}`,
    decision ? '**Svar:** kommentera med radnummer och A/B/C. Ärendet stängs när allt är beslutat.' : null,
    '',
    String(body).trim(),
  ].filter(part => part !== null).join('\n');
}

function gh(args, input) {
  return execFileSync('gh', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true }).trim();
}

function collaborators() {
  try { return JSON.parse(gh(['api', `repos/${REPO}/collaborators`, '--jq', '[.[].login]'])); } catch { return []; }
}

export function ensureLabels(run = gh) {
  const wanted = [
    [LABELS.inbox, '0E8A16', 'Teaminbox: meddelande till en eller flera personer'],
    [LABELS.decision, 'D93F0B', 'Väntar på beslut'],
    ...Object.keys(TARGETS).map(name => [LABELS.to(name), '1D76DB', `Till ${TARGETS[name].name}`]),
  ];
  const existing = new Set(run(['api', `repos/${REPO}/labels?per_page=100`, '--paginate', '--jq', '.[].name'])
    .split(/\r?\n/).map(name => name.toLowerCase()));
  for (const [name, color, description] of wanted) {
    if (!existing.has(name.toLowerCase())) run(['label', 'create', name, '--repo', REPO, '--color', color, '--description', description]);
  }
  return wanted.map(([name]) => name);
}

export function closeOwnIssue(number, run = gh) {
  if (!/^[1-9]\d*$/.test(String(number))) throw new Error('Ange ett positivt ärendenummer.');
  const issue = JSON.parse(run(['issue', 'view', String(number), '--repo', REPO, '--json', 'author,labels']));
  if (!Array.isArray(issue?.labels) || !issue.labels.some(label => label.name?.toLowerCase() === LABELS.inbox)) {
    throw new Error('Bara ärenden med etiketten inbox får stängas via inboxverktyget.');
  }
  const login = run(['api', 'user', '--jq', '.login']).trim();
  const author = issue.author?.login;
  if (typeof author !== 'string' || !author || !login || author.toLowerCase() !== login.toLowerCase()) {
    throw new Error('Bara ärendets skapare får stänga det. Det inloggade GitHub-kontot måste matcha skaparen.');
  }
  return run(['issue', 'close', String(number), '--repo', REPO]);
}

function sender(options) {
  if (options.from) return options.from;
  const identity = readLocalIdentity();
  if (identity) return `${DEVICES[identity.device].name} (\`${identity.device}\`)`;
  try { return execFileSync('git', ['config', 'user.name'], { encoding: 'utf8', windowsHide: true }).trim() || 'okänd'; } catch { return 'okänd'; }
}

export function main(argv = process.argv.slice(2)) {
  const { command, options } = parseArgs(argv);
  const number = options.positional[0];
  switch (command) {
    case 'register':
      console.log(JSON.stringify(registerDevice({ device: options.device, email: options.email }), null, 2));
      return;
    case 'identity': {
      const identity = readLocalIdentity();
      console.log(identity ? JSON.stringify({ name: DEVICES[identity.device].name, ...identity }, null, 2)
        : 'Ingen dator registrerad. Kör register --device <alias> --email <ChatGPT-mejl>.');
      return;
    }
    case 'ping':
    case 'send': {
      const text = messageBody(options);
      const subject = options.subject ?? (command === 'ping' ? `Ping: ${text.trim().split('\n')[0].slice(0, 70)}` : null);
      if (!subject) throw new Error('Ange --subject.');
      const to = recipients(options.to, currentBranch(), readLocalIdentity()?.device ?? null);
      const known = collaborators();
      ensureLabels();
      const body = composeBody({ to, from: sender(options), body: text, decision: Boolean(options.decision), collaborators: known });
      const assignees = [...new Set(to.map(name => TARGETS[name].github).filter(login => login && known.includes(login)))];
      console.log(gh(['issue', 'create', '--repo', REPO, '--title', subject, '--body-file', '-',
        ...labelsFor(to, Boolean(options.decision)).flatMap(label => ['--label', label]),
        ...assignees.flatMap(login => ['--assignee', login])], body));
      return;
    }
    case 'list': {
      const args = ['issue', 'list', '--repo', REPO, '--label', LABELS.inbox, '--state', options.all ? 'all' : 'open',
        '--json', 'number,title,state,labels,updatedAt',
        '--jq', '.[] | "#\\(.number) \\(.state) \\(.updatedAt[:10]) \\(.title) [\\([.labels[].name] | join(" "))]"'];
      if (options.to) args.push('--label', LABELS.to(recipients(options.to, currentBranch(), readLocalIdentity()?.device ?? null)[0]));
      console.log(gh(args) || 'Inboxen är tom.');
      return;
    }
    case 'read':
      if (!number) throw new Error('Ange ärendenummer.');
      console.log(gh(['issue', 'view', number, '--repo', REPO, '--comments']));
      return;
    case 'reply':
      if (!number) throw new Error('Ange ärendenummer.');
      console.log(gh(['issue', 'comment', number, '--repo', REPO, '--body-file', '-'], messageBody(options)));
      return;
    case 'done':
      if (!number) throw new Error('Ange ärendenummer.');
      console.log(closeOwnIssue(number));
      return;
    case 'labels':
      console.log(ensureLabels().join('\n'));
      return;
    default:
      throw new Error('Kommandon: register, identity, send, ping, list, read, reply, done, labels. Se huvudet i tools/inbox.mjs.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
