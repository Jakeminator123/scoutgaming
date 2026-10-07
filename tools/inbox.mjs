#!/usr/bin/env node
// Team inbox for Jakob, John, Kevin and Emil, kept as GitHub Issues on the policy repository.
// Not the retired GitLab inbox: nothing here reads or writes .croupier-inbox/.
//
//   node tools/inbox.mjs send --to john,kevin --subject "Rubrik" --body-file brev.md [--decision] [--from "Namn"]
//   node tools/inbox.mjs ping --to kevin --message "Kort fråga till dig eller din agent"   (same as send, inline text)
//   node tools/inbox.mjs list [--to kevin | --to me] [--all]      ("me" = owner of the current git branch)
//   node tools/inbox.mjs read <nummer>
//   node tools/inbox.mjs reply <nummer> --body-file svar.md | --message "Svar"
//   node tools/inbox.mjs done <nummer>
//   node tools/inbox.mjs labels
// Agents in the same checkout coordinate with tools/agent-talk.mjs; this tool reaches other machines and branches.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const readJson = file => JSON.parse(readFileSync(resolve(root, file), 'utf8'));
export const REPO = readJson('tools/repository-policy.json').repository;
export const PEOPLE = Object.freeze(readJson('inbox/people.json'));
export const LABELS = Object.freeze({ inbox: 'inbox', decision: 'beslut', to: name => `till:${name}` });

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

// "me" is whoever owns the current git branch, so an agent in a teammate's checkout reads that teammate's inbox.
export function ownerOfBranch(branch) {
  const entry = Object.entries(PEOPLE).find(([, person]) => person.branch === branch);
  if (!entry) throw new Error(`Ingen i inbox/people.json äger grenen "${branch}". Ange --to med ett namn.`);
  return entry[0];
}

function currentBranch() {
  try { return execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8', windowsHide: true }).trim(); } catch { return ''; }
}

export function recipients(list, branch = currentBranch()) {
  const names = String(list ?? '').split(',').map(name => name.trim().toLowerCase()).filter(Boolean)
    .map(name => name === 'me' ? ownerOfBranch(branch) : name);
  if (!names.length) throw new Error('Ange mottagare med --to, till exempel --to john,kevin.');
  for (const name of names) if (!PEOPLE[name]) throw new Error(`Okänd mottagare "${name}". Kända: ${Object.keys(PEOPLE).join(', ')}, me.`);
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
    const person = PEOPLE[name];
    return person.github && collaborators.includes(person.github) ? `@${person.github}` : `${person.name} (GitHub-inbjudan väntar)`;
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

function ensureLabels() {
  const wanted = [
    [LABELS.inbox, '0E8A16', 'Teaminbox: meddelande till en eller flera personer'],
    [LABELS.decision, 'D93F0B', 'Väntar på beslut'],
    ...Object.keys(PEOPLE).map(name => [LABELS.to(name), '1D76DB', `Till ${PEOPLE[name].name}`]),
  ];
  for (const [name, color, description] of wanted) gh(['label', 'create', name, '--repo', REPO, '--color', color, '--description', description, '--force']);
  return wanted.map(([name]) => name);
}

function sender(options) {
  if (options.from) return options.from;
  try { return execFileSync('git', ['config', 'user.name'], { encoding: 'utf8', windowsHide: true }).trim() || 'okänd'; } catch { return 'okänd'; }
}

export function main(argv = process.argv.slice(2)) {
  const { command, options } = parseArgs(argv);
  const number = options.positional[0];
  switch (command) {
    case 'ping':
    case 'send': {
      const text = messageBody(options);
      const subject = options.subject ?? (command === 'ping' ? `Ping: ${text.trim().split('\n')[0].slice(0, 70)}` : null);
      if (!subject) throw new Error('Ange --subject.');
      const to = recipients(options.to);
      const known = collaborators();
      ensureLabels();
      const body = composeBody({ to, from: sender(options), body: text, decision: Boolean(options.decision), collaborators: known });
      const assignees = to.map(name => PEOPLE[name].github).filter(login => login && known.includes(login));
      console.log(gh(['issue', 'create', '--repo', REPO, '--title', subject, '--body-file', '-',
        ...labelsFor(to, Boolean(options.decision)).flatMap(label => ['--label', label]),
        ...assignees.flatMap(login => ['--assignee', login])], body));
      return;
    }
    case 'list': {
      const args = ['issue', 'list', '--repo', REPO, '--label', LABELS.inbox, '--state', options.all ? 'all' : 'open',
        '--json', 'number,title,state,labels,updatedAt',
        '--jq', '.[] | "#\\(.number) \\(.state) \\(.updatedAt[:10]) \\(.title) [\\([.labels[].name] | join(" "))]"'];
      if (options.to) args.push('--label', LABELS.to(recipients(options.to)[0]));
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
      console.log(gh(['issue', 'close', number, '--repo', REPO]));
      return;
    case 'labels':
      console.log(ensureLabels().join('\n'));
      return;
    default:
      throw new Error('Kommandon: send, ping, list, read, reply, done, labels. Se huvudet i tools/inbox.mjs.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
