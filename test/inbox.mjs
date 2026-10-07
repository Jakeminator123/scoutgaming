import test from 'node:test';
import assert from 'node:assert/strict';
import { PEOPLE, REPO, composeBody, labelsFor, parseArgs, recipients } from '../tools/inbox.mjs';

test('inbox targets the policy repository and knows the four people', () => {
  assert.equal(REPO, 'Jakeminator123/scoutgaming');
  assert.deepEqual(Object.keys(PEOPLE).sort(), ['emil', 'jakob', 'john', 'kevin']);
  for (const person of Object.values(PEOPLE)) assert.equal(typeof person.name, 'string');
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
  assert.deepEqual(recipients('John, kevin,john'), ['john', 'kevin']);
  assert.throws(() => recipients(''), /Ange mottagare/);
  assert.throws(() => recipients('astrid'), /Okänd mottagare "astrid"/);
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
