import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEVICES, PEOPLE, REPO, TARGETS, closeOwnIssue, composeBody, ensureLabels, labelsFor, ownerOfBranch, parseArgs, readLocalIdentity, recipients, registerDevice } from '../tools/inbox.mjs';

function localFixture(t, host = 'test-laptop') {
  const directory = mkdtempSync(join(tmpdir(), 'scout-inbox-device-'));
  t.after(() => {
    for (const name of readdirSync(directory)) rmSync(join(directory, name));
    rmdirSync(directory);
  });
  return { file: join(directory, 'local-device.json'), host, workspace: directory };
}

test('every person owns exactly one unique branch and "me" resolves through the current branch', () => {
  // Structural: the registry stays consistent whoever is listed in inbox/people.json.
  const people = Object.entries(PEOPLE);
  assert.ok(people.length > 0);
  for (const [id, person] of people) {
    assert.match(id, /^[a-z][a-z0-9-]*$/);
    assert.ok(typeof person.branch === 'string' && person.branch.length > 0, `${id} owns a branch`);
    assert.equal(ownerOfBranch(person.branch), id);
  }
  assert.equal(new Set(people.map(([, person]) => person.branch)).size, people.length, 'branches are unique');
  assert.equal(ownerOfBranch('main'), 'jakob');
  assert.throws(() => ownerOfBranch('feature-x'), /Ingen i inbox\/people.json äger grenen "feature-x"/);
  assert.deepEqual(recipients('me', 'john'), ['john']);
  assert.deepEqual(recipients('me,john', 'john'), ['john']);
  assert.throws(() => recipients('me', 'codex/example'), /Ange --to med ett namn/);
  assert.deepEqual(recipients('jakob', 'codex/example'), ['jakob']);
});

test('inbox targets the policy repository and every person has a name and a github field (null until the login is known)', () => {
  assert.equal(REPO, 'Jakeminator123/scoutgaming');
  assert.ok(PEOPLE.jakob, 'the repository owner is registered');
  for (const person of Object.values(PEOPLE)) {
    assert.equal(typeof person.name, 'string');
    assert.ok('github' in person);
  }
});

test('arguments parse flags, values and positionals; a flag without a value fails', () => {
  assert.deepEqual(parseArgs(['send', '--to', 'john,kevin', '--subject', 'Hej', '--body-file', 'b.md', '--decision']),
    { command: 'send', options: { positional: [], to: 'john,kevin', subject: 'Hej', 'body-file': 'b.md', decision: true } });
  assert.deepEqual(parseArgs(['reply', '12', '--body-file', 's.md']), { command: 'reply', options: { positional: ['12'], 'body-file': 's.md' } });
  assert.deepEqual(parseArgs(['list', '--all']), { command: 'list', options: { positional: [], all: true } });
  assert.throws(() => parseArgs(['send', '--subject']), /--subject behöver ett värde/);
  assert.throws(() => parseArgs(['send', '--subject', '--to']), /--subject behöver ett värde/);
});

test('recipients are validated, lower-cased and de-duplicated', () => {
  assert.deepEqual(recipients('John, kevin,john', 'main'), ['john', 'kevin']);
  assert.deepEqual(parseArgs(['ping', '--to', 'kevin', '--message', 'Hej?']), { command: 'ping', options: { positional: [], to: 'kevin', message: 'Hej?' } });
  assert.throws(() => recipients(''), /Ange mottagare/);
  assert.throws(() => recipients('astrid'), /Okänd mottagare "astrid"/);
  assert.throws(() => recipients('constructor'), /Okänd mottagare/);
});

test('device destinations stay separate while sharing Jakob ownership and GitHub assignment', () => {
  assert.equal(DEVICES['jakob-bgvp01j'].name, 'Jakobs laptop');
  assert.equal(DEVICES['jakob-dator2'].name, 'Jakobs stationdata');
  for (const id of Object.keys(DEVICES)) {
    assert.equal(TARGETS[id].github, PEOPLE.jakob.github);
    assert.equal(TARGETS[id].owner, 'jakob');
    assert.equal(TARGETS[id].branch, undefined);
  }
  assert.deepEqual(recipients('JAKOB-BGVP01J,jakob-dator2,jakob-bgvp01j', 'main'), ['jakob-bgvp01j', 'jakob-dator2']);
  assert.deepEqual(labelsFor(['jakob-bgvp01j', 'jakob-dator2']), ['inbox', 'till:jakob-bgvp01j', 'till:jakob-dator2']);
  assert.equal(ownerOfBranch('main'), 'jakob');
});

test('me selects the registered device even on a feature branch, with unchanged person fallback', () => {
  assert.deepEqual(recipients('me', 'codex/example', 'jakob-bgvp01j'), ['jakob-bgvp01j']);
  assert.deepEqual(recipients('me', 'main', 'jakob-dator2'), ['jakob-dator2']);
  assert.deepEqual(recipients('jakob,me', 'main', 'jakob-bgvp01j'), ['jakob', 'jakob-bgvp01j']);
  assert.deepEqual(recipients('me', 'john'), ['john']);
  assert.throws(() => recipients('me', 'main', 'unknown-device'), /Okänd dator/);
});

test('registration keeps account and checkout details local and can replace an old registration', t => {
  const context = localFixture(t);
  assert.equal(readLocalIdentity(context), null);
  const identity = registerDevice({ device: 'JAKOB-BGVP01J', email: 'laptop@example.com' }, context);
  assert.deepEqual(readLocalIdentity(context), identity);
  assert.equal(identity.workspace, context.workspace);
  assert.equal(identity.hostname, context.host);
  assert.equal(identity.accountEmail, 'laptop@example.com');
  registerDevice({ device: 'jakob-dator2', email: 'desktop@example.com' }, context);
  assert.equal(readLocalIdentity(context).device, 'jakob-dator2');
  assert.deepEqual(readdirSync(context.workspace), ['local-device.json']);
});

test('copied or malformed local identities fail rather than silently routing to the wrong computer', t => {
  const context = localFixture(t);
  registerDevice({ device: 'jakob-bgvp01j', email: 'laptop@example.com' }, context);
  assert.throws(() => readLocalIdentity({ ...context, host: 'other-computer' }), /matchar inte/);
  assert.throws(() => readLocalIdentity({ ...context, workspace: join(context.workspace, 'other-checkout') }), /matchar inte/);
  writeFileSync(context.file, '{broken');
  assert.throws(() => readLocalIdentity(context), /Ogiltig lokal/);
  writeFileSync(context.file, 'null');
  assert.throws(() => readLocalIdentity(context), /matchar inte/);
});

test('invalid registrations do not overwrite an existing local identity', t => {
  const context = localFixture(t);
  const identity = registerDevice({ device: 'jakob-bgvp01j', email: 'laptop@example.com' }, context);
  assert.throws(() => registerDevice({ device: 'jakob', email: 'laptop@example.com' }, context), /Okänd dator/);
  assert.throws(() => registerDevice({ device: 'jakob-dator2', email: 'not an email' }, context), /mejladress/);
  assert.deepEqual(readLocalIdentity(context), identity);
});

test('messages visibly name both computers without exposing private registration metadata', () => {
  const body = composeBody({ to: ['jakob-bgvp01j', 'jakob-dator2'], from: 'Jakobs laptop', body: 'Hej', collaborators: ['Jakeminator123'] });
  assert.match(body, /Jakobs laptop \(`jakob-bgvp01j`; @Jakeminator123\)/);
  assert.match(body, /Jakobs stationdata \(`jakob-dator2`; @Jakeminator123\)/);
  assert.doesNotMatch(body, /accountEmail|workspace|gmail\.com|C:\\/);
});

test('labels carry the inbox marker, one label per recipient and the decision marker on request', () => {
  assert.deepEqual(labelsFor(['john']), ['inbox', 'till:john']);
  assert.deepEqual(labelsFor(['john', 'kevin'], true), ['inbox', 'beslut', 'till:john', 'till:kevin']);
});

test('body mentions accepted collaborators, names the rest in plain text and adds the answer line only for decisions', () => {
  const body = composeBody({ to: ['john', 'kevin'], from: 'Jakob', body: '  Rad 1: A eller B?\n', decision: true, collaborators: ['Johncleochile'] });
  assert.equal(body, [
    '**Till:** @Johncleochile, Kevin (GitHub-inbjudan väntar)',
    '**Från:** Jakob',
    '**Svar:** kommentera med radnummer och A/B/C. Ärendet stängs när allt är beslutat.',
    '',
    'Rad 1: A eller B?',
  ].join('\n'));
  const plain = composeBody({ to: ['john'], from: 'Jakob', body: 'Hej', collaborators: [] });
  assert.equal(plain, '**Till:** John (GitHub-inbjudan väntar)\n**Från:** Jakob\n\nHej');
  assert.doesNotMatch(plain, /Svar:/);
});

function githubFixture(...responses) {
  const calls = [];
  return { calls, run(args) {
    calls.push(args);
    assert.ok(responses.length, 'Unexpected GitHub call');
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return response;
  } };
}

test('label setup reads all pages and preserves existing labels, including custom capitalization', () => {
  const wanted = labelsFor(Object.keys(TARGETS), true);
  const github = githubFixture(wanted.map(name => name.toUpperCase()).join('\r\n'));
  assert.deepEqual(ensureLabels(github.run), wanted);
  assert.deepEqual(github.calls, [['api', `repos/${REPO}/labels?per_page=100`, '--paginate', '--jq', '.[].name']]);
});

test('label setup creates only missing labels without force-updating existing labels', () => {
  const wanted = labelsFor(Object.keys(TARGETS), true);
  const github = githubFixture(wanted.filter(name => name !== 'inbox' && name !== 'till:john').join('\n'), '', '');
  assert.deepEqual(ensureLabels(github.run), wanted);
  assert.deepEqual(github.calls.slice(1), [
    ['label', 'create', 'inbox', '--repo', REPO, '--color', '0E8A16', '--description', 'Teaminbox: meddelande till en eller flera personer'],
    ['label', 'create', 'till:john', '--repo', REPO, '--color', '1D76DB', '--description', 'Till John'],
  ]);
});

test('label lookup and creation failures propagate without further writes', () => {
  const lookup = githubFixture(new Error('GitHub unavailable'));
  assert.throws(() => ensureLabels(lookup.run), /GitHub unavailable/);
  assert.equal(lookup.calls.length, 1);
  const creation = githubFixture('', new Error('Creation denied'));
  assert.throws(() => ensureLabels(creation.run), /Creation denied/);
  assert.equal(creation.calls.length, 2);
});

const inboxIssue = (author = 'Jakeminator123', labels = [{ name: 'inbox' }]) => JSON.stringify({ author: { login: author }, labels });

test('done closes an inbox issue only after verifying the authenticated author', () => {
  const github = githubFixture(inboxIssue(), 'jakeminator123', 'Closed');
  assert.equal(closeOwnIssue('12', github.run), 'Closed');
  assert.deepEqual(github.calls, [
    ['issue', 'view', '12', '--repo', REPO, '--json', 'author,labels'],
    ['api', 'user', '--jq', '.login'],
    ['issue', 'close', '12', '--repo', REPO],
  ]);
});

test('done refuses another author, missing author or unknown authenticated account without closing', () => {
  for (const [author, login] of [['Johncleochile', 'Jakeminator123'], [null, 'Jakeminator123'], ['Jakeminator123', '']]) {
    const github = githubFixture(inboxIssue(author), login);
    assert.throws(() => closeOwnIssue('12', github.run), /Bara ärendets skapare/);
    assert.equal(github.calls.length, 2);
  }
});

test('done refuses non-inbox issues and invalid issue numbers without mutation', () => {
  for (const issue of [inboxIssue('Jakeminator123', []), '{}', 'null']) {
    const github = githubFixture(issue);
    assert.throws(() => closeOwnIssue('12', github.run), /etiketten inbox/);
    assert.equal(github.calls.length, 1);
  }
  for (const number of ['', '0', '-1', '12abc', '--help']) {
    const github = githubFixture();
    assert.throws(() => closeOwnIssue(number, github.run), /positivt ärendenummer/);
    assert.equal(github.calls.length, 0);
  }
});

test('done propagates failed issue or account reads and never closes on incomplete verification', () => {
  for (const responses of [[new Error('Issue unavailable')], [inboxIssue(), new Error('Account unavailable')], ['{invalid']]) {
    const github = githubFixture(...responses);
    assert.throws(() => closeOwnIssue('12', github.run));
    assert.ok(github.calls.every(args => args[1] !== 'close'));
  }
});
