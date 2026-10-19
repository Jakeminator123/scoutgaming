import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { safeChildDiagnosticLine, createChildDiagnosticForwarder, withChildDiagnostics } from '../child-diagnostics.mjs';
import { childSpecifications, validateCloudConfig } from '../config.mjs';
import { startChildren } from '../process-group.mjs';
import { main } from '../start.mjs';

const guard = { event: 'moving_drift_guard_rejected', phase: 'submit', reason: 'observation_unknown', desiredMode: 'saving', drainRequired: false,
  observedStatus: 'unknown', observedReason: 'drift_observation_stale', executionAge: 'fresh', observationAge: 'stale', lease: 'active',
  revisionMatches: true, operationMatches: true, profileMatches: true, endpointMatches: true, catalogueMatches: true, executorFenceMatches: true,
  appliedRevisionMatches: true, appliedOperationMatches: true, executionIdentityMatches: true, observationCatalogueMatches: true };

test('allowlisted finite game diagnostics are forwarded verbatim and tagged as game output', () => {
  const forwarded = JSON.parse(safeChildDiagnosticLine(JSON.stringify(guard)));
  assert.equal(forwarded.event, 'moving_drift_guard_rejected'); assert.equal(forwarded.source, 'game');
  assert.equal(forwarded.reason, 'observation_unknown'); assert.equal(forwarded.observationAge, 'stale');
  assert.equal(Object.keys(forwarded).length, Object.keys(guard).length + 1);
  assert.deepEqual(JSON.parse(safeChildDiagnosticLine(JSON.stringify({ event: 'moving_drift_readback_timing', phase: 'provider_observation', result: 'success', durationClass: 'overdue' }))),
    { event: 'moving_drift_readback_timing', source: 'game', phase: 'provider_observation', result: 'success', durationClass: 'overdue' });
  assert.deepEqual(JSON.parse(safeChildDiagnosticLine(JSON.stringify({ event: 'moving_speech_preparation_failed', code: 'moving_worker_closed', phase: 'worker-ready',
    streamId: 'a'.repeat(32), requestId: '38657101-da59-4796-96e2-2dbf7e014c4b' }))),
    { event: 'moving_speech_preparation_failed', source: 'game', code: 'moving_worker_closed', phase: 'worker-ready', streamId: 'a'.repeat(32), requestId: '38657101-da59-4796-96e2-2dbf7e014c4b' });
  assert.deepEqual(JSON.parse(safeChildDiagnosticLine(JSON.stringify({ event: 'moving_drift_readback_failed', code: 'drift_observation_unverified' }))),
    { event: 'moving_drift_readback_failed', source: 'game', code: 'drift_observation_unverified' });
});

test('unknown events, extra or unsafe fields, text, oversized and non-JSON lines are dropped', () => {
  assert.equal(safeChildDiagnosticLine('croupier demo on http://127.0.0.1:4173'), null);
  assert.equal(safeChildDiagnosticLine(JSON.stringify({ event: 'astrid_speech_timing', trace: 'abcd', stage: 'text', ms: 5 })), null);
  assert.equal(safeChildDiagnosticLine(JSON.stringify({ event: 'speech_reply_library', status: 'ready' })), null);
  assert.equal(safeChildDiagnosticLine(JSON.stringify({ ...guard, reason: 'https://evil.invalid/?ticket=abc' })), null);
  assert.equal(safeChildDiagnosticLine(JSON.stringify({ ...guard, observationAge: 'ancient' })), null);
  assert.equal(safeChildDiagnosticLine(JSON.stringify({ event: 'moving_speech_preparation_failed', code: 'Bearer secret', phase: 'x', streamId: null, requestId: null })), null);
  assert.equal(safeChildDiagnosticLine(JSON.stringify({ event: 'moving_speech_preparation_failed', code: 'moving_worker_closed', phase: 'submit', streamId: 'not-hex', requestId: null })), null);
  assert.equal(safeChildDiagnosticLine(JSON.stringify({ event: 'moving_drift_readback_timing', phase: 'provider_observation', result: 'success', durationClass: 'slow', extra: 'ignored' })).includes('extra'), false);
  assert.equal(safeChildDiagnosticLine(JSON.stringify({ event: 'moving_drift_readback_failed', code: 'drift_x', url: 'https://x' })).includes('url'), false);
  assert.equal(safeChildDiagnosticLine('{' + 'x'.repeat(5000) + '}'), null);
  assert.equal(safeChildDiagnosticLine('["event","moving_drift_readback_failed"]'), null);
  assert.equal(safeChildDiagnosticLine('{"event":{"toString":1}}'), null);
});

test('the forwarder is bounded, swallows emitter failures and is attached only by the production start default', async () => {
  const emitted = [];
  const forward = createChildDiagnosticForwarder({ emit: value => { emitted.push(value); if (emitted.length === 2) throw Error('log sink closed'); }, limit: 3 });
  for (let i = 0; i < 6; i++) forward(JSON.stringify({ event: 'moving_drift_readback_failed', code: 'drift_observation_unverified' }));
  forward('plain text');
  assert.equal(emitted.length, 3);
  const specs = withChildDiagnostics({ web: { command: 'node', env: {} }, lab: { command: 'node', env: {} } }, { emit: () => {} });
  assert.equal(typeof specs.web.onStdoutLine, 'function'); assert.equal(specs.web.onStderrLine, specs.web.onStdoutLine);
  assert.equal(specs.lab.onStdoutLine, undefined); assert.equal(specs.lab.onStderrLine, undefined);
  // Specifications stay stdio-free until start applies the transform; QA keeps its own transform.
  const env = { CROUPIER_CLOUD_LAUNCH: 'pilot', CROUPIER_CLOUD_LAYOUT: 'unified', NODE_ENV: 'production' };
  let plain;
  try { plain = childSpecifications(validateCloudConfig({ ...env, CROUPIER_PUBLIC_ORIGIN: 'https://www.scoutgaming.tech', CROUPIER_BACKEND_ORIGIN: 'https://croupier-v2.onrender.com' }), env, { labInternalSecret: 'x'.repeat(64) }); }
  catch { plain = null; }
  if (plain) assert.equal(plain.web.onStdoutLine, undefined);
  await assert.rejects(main(['--bogus'], env), /Usage/);
});

test('a real child process: console.warn diagnostics on stderr reach the parent emitter, startup text and stdout noise do not', async () => {
  const emitted = [];
  const script = [
    "console.log('croupier demo on http://127.0.0.1:4173 token=should-never-forward');",
    "console.warn('Bearer secret-looking startup line');",
    "console.warn(JSON.stringify({event:'moving_drift_guard_rejected',phase:'submit',reason:'observation_unknown',desiredMode:'saving',drainRequired:false,observedStatus:'unknown',observedReason:'drift_observation_stale',executionAge:'fresh',observationAge:'stale',lease:'active',revisionMatches:true,operationMatches:true,profileMatches:true,endpointMatches:true,catalogueMatches:true,executorFenceMatches:true,appliedRevisionMatches:true,appliedOperationMatches:true,executionIdentityMatches:true,observationCatalogueMatches:true}));",
    "console.info(JSON.stringify({event:'moving_drift_readback_timing',phase:'provider_observation',result:'success',durationClass:'overdue'}));",
    "console.warn(JSON.stringify({event:'moving_speech_preparation_failed',code:'generated_speech_total_budget_exhausted',phase:'admission',streamId:null,requestId:'62fe0cc0-912f-4a4d-8a56-819794c8b2c1'}));",
    'setTimeout(()=>{},200);',
  ].join('\n');
  const specs = withChildDiagnostics({ web: { command: process.execPath, args: ['-e', script], cwd: process.cwd(), env: { PATH: process.env.PATH } },
    lab: { command: process.execPath, args: ['-e', 'setTimeout(()=>{},200)'], cwd: process.cwd(), env: { PATH: process.env.PATH, CROUPIER_LAB_BASE_PATH: '' } } }, { emit: value => emitted.push(JSON.parse(value)) });
  let seenStdio;
  const group = await startChildren(specs, { portCheck: async () => {}, wait: async () => {},
    spawnProcess: (command, args, options) => { seenStdio ??= options.stdio; return spawn(command, args, options); } });
  await new Promise(resolve => setTimeout(resolve, 600));
  await group.stop();
  assert.deepEqual(seenStdio, ['ignore', 'pipe', 'pipe']);
  assert.deepEqual(emitted.map(row => row.event).sort(), ['moving_drift_guard_rejected', 'moving_drift_readback_timing', 'moving_speech_preparation_failed']);
  assert.equal(emitted.find(row => row.event === 'moving_speech_preparation_failed').code, 'generated_speech_total_budget_exhausted');
  assert.ok(emitted.every(row => row.source === 'game' && !JSON.stringify(row).includes('secret') && !JSON.stringify(row).includes('token=')));
});
