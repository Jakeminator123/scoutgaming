import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { prepareLegacySpeechLedgerSnapshot } from '../ops/neon-studio/speech-ledger-snapshot.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const observedAt = '2026-10-04T01:00:00.000Z', stamp = Date.parse(observedAt);
const id = 'a'.repeat(32), key = 'b'.repeat(64), ownerHash = 'c'.repeat(64), fingerprint = 'd'.repeat(64);
const packet = (name, value) => { const bytes = Buffer.from(JSON.stringify(value)); return { name, bytes, sha256:hash(bytes), updatedAt:observedAt }; };
const args = sources => ({ scope:{ environment:'snapshot-qa', workspaceId:'croupier' }, endpointId:'isolated-endpoint', observedAt, sources,
  confirmation:'verified-frozen-complete-speech-ledger', drainProof:{ observedAt, workers:0, busy:0, available:0 },
  lockState:{ fullfileProvider:'stopped', streamSession:'stopped', operatorQa:'disabled' } });
const reservation = patch => ({ id, endpointId:'isolated-endpoint', workerId:`croupier-${id}`, createdAt:Date.parse('2026-10-03T23:59:00Z'),
  days:['2026-10-03','2026-10-04'], reservedMicroUsd:200000, ...patch });
const policy = () => packet('gpu-budget-policy.json', { version:1, dailyBudgetMicroUsd:9940000, createdAt:stamp - 86400000 });
const base = () => [policy(), packet(`gpu-session-${id}.reservation.json`, reservation()),
  packet(`${key}.request.json`, { ownerHash, fingerprint })];

test('offline snapshot preserves opaque request key, uncertain GPU submit and both immutable UTC charges', () => {
  const source = base(), output = prepareLegacySpeechLedgerSnapshot(args(source));
  assert.equal(output.snapshot.scope.environment, 'snapshot-qa');
  assert.equal(output.snapshot.budgetPolicy.dailyBudgetMicroUsd, 9940000);
  assert.equal(output.snapshot.requests[0].key, key);
  assert.equal(output.snapshot.requests[0].requestId, `legacy-key:${key}`);
  assert.equal(output.snapshot.requests[0].state, 'submission_uncertain');
  assert.equal(output.snapshot.sessions[0].state, 'submission_uncertain');
  assert.equal(output.snapshot.sessions[0].sourceId, `gpu-session-${id}.reservation.json`);
  assert.equal(output.snapshot.requests[0].sourceId, `${key}.request.json`);
  assert.equal(output.sourceId, `legacy-speech-${output.checksum}`);
  assert.deepEqual(output.snapshot.reservations.map(value => value.day), ['2026-10-03','2026-10-04']);
  assert.ok(output.snapshot.requires.includes('operator-reconciliation-of-unknown-submit'));
  assert.equal(Object.keys(output.snapshot.sourceHashes).length, 3);
  assert.ok(Object.isFrozen(output.snapshot.requests[0]));
  assert.throws(() => { output.snapshot.budgetPolicy.dailyBudgetMicroUsd = 10000000; }, TypeError);
  source[1].bytes.fill(0); assert.equal(output.snapshot.sessions[0].sessionId, id);
  assert.match(output.checksum, /^[a-f0-9]{64}$/);
});

test('known terminal receipt uses explicit frozen drain proof, never refunds reservations or drops old requests', () => {
  const output = prepareLegacySpeechLedgerSnapshot(args([...base(), packet(`gpu-session-${id}.job.json`, { jobId:'known-job' }),
    packet(`gpu-session-${id}.cancel.json`, { requestedAt:stamp - 1000 }), packet(`gpu-session-${id}.terminal.json`, { status:'CANCELLED' })]));
  assert.equal(output.snapshot.sessions[0].releasedAt, stamp);
  assert.equal(output.snapshot.sessions[0].terminalReason, 'provider');
  assert.equal(output.snapshot.sessions[0].cancelRequestedAt, stamp - 1000);
  assert.deepEqual(output.snapshot.reservations.map(value => value.reservedMicroUsd), [200000,200000]);
  assert.equal(output.snapshot.requests.length, 1);
});

test('unverified completeness, draining, locks, scope, checksums or timestamps fail before producing an import', () => {
  const source = base();
  for (const patch of [ { confirmation:'automatically-empty' }, { drainProof:{ observedAt, workers:1, busy:0, available:0 } },
    { lockState:{ fullfileProvider:'stopped', streamSession:'running', operatorQa:'disabled' } }, { observedAt:'2026-10-03' },
    { scope:{ environment:'wrong/scope', workspaceId:'croupier' } }, { sources:[...source, source[0]] } ]) {
    assert.throws(() => prepareLegacySpeechLedgerSnapshot({ ...args(source), ...patch }));
  }
  assert.throws(() => prepareLegacySpeechLedgerSnapshot(args([{ ...source[0], sha256:'0'.repeat(64) }])));
  assert.throws(() => prepareLegacySpeechLedgerSnapshot(args([{ ...source[0], updatedAt:'2026-10-05T00:00:00.000Z' }])));
});

test('missing policy, UTC corruption, orphan receipts, duplicate shared keys and mismatched endpoint fail closed', () => {
  const cases = [base().slice(1), [policy(), packet(`gpu-session-${id}.reservation.json`, reservation({ days:['2026-10-03'] }))],
    [policy(), packet(`gpu-session-${id}.reservation.json`, reservation({ endpointId:'foreign' }))],
    [policy(), packet(`gpu-session-${id}.job.json`, { jobId:'orphan' })],
    [packet(`${key}.done.json`, { id })],
    [packet(`${key}.request.json`, { ownerHash, fingerprint, state:'reserved', createdAt:stamp }),
      packet(`stream-${key}.request.json`, { ownerHash, fingerprint, state:'reserved', createdAt:stamp })],
    [packet('unknown-ledger.json', { secret:'must not be accepted' })] ];
  for (const source of cases) assert.throws(() => prepareLegacySpeechLedgerSnapshot(args(source)), { code:'studio_speech_import_source_invalid' });
});

test('operator campaign attempts remain hash-bound retained state and cannot reset the paid QA gate', () => {
  const campaignId = '550e8400-e29b-41d4-a716-446655440000';
  const gate = { id:campaignId, createdAt:stamp - 600000, expiresAt:stamp + 600000 };
  const output = prepareLegacySpeechLedgerSnapshot(args([packet('operator-qa.json', gate),
    packet(`operator-qa-${campaignId}.campaign.json`, gate),
    packet(`operator-qa-${campaignId}.attempt-1.json`, { campaignId, attempt:1, turn:2, reservedAt:stamp - 1000 })]));
  assert.equal(output.snapshot.retainedOperatorQa.length, 3);
  assert.ok(output.snapshot.requires.includes('retained-operator-qa-state'));
  assert.equal(output.snapshot.budgetPolicy, null, 'missing budget is recorded, never seeded');
  assert.throws(() => prepareLegacySpeechLedgerSnapshot(args([
    packet(`operator-qa-${campaignId}.attempt-1.json`, { campaignId, attempt:1, turn:1, reservedAt:stamp })])), { code:'studio_speech_import_source_invalid' });
});
