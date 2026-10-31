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

const socketIdentity = { event: 'shared_room_socket_identity', processId: '38657101-da59-4796-96e2-2dbf7e014c4b',
  socketNonce: '62fe0cc0-912f-4a4d-8a56-819794c8b2c1', at: 1793448000000 };

test('room socket correlation forwards only generated UUIDs and a safe timestamp, never extra fields', () => {
  const emitted=[];
  const {web}=withChildDiagnostics({web:{}},{emit:line=>emitted.push(JSON.parse(line))});
  const line=JSON.stringify({...socketIdentity,source:'private-source',cookie:'private-cookie',token:'private-token',
    text:'private-text',url:'https://private.invalid',headers:{authorization:'Bearer private-secret'},actorId:'private-actor'});
  web.onStdoutLine(line);web.onStderrLine(line);
  assert.deepEqual(emitted,[{...socketIdentity,source:'game'},{...socketIdentity,source:'game'}]);
  assert.equal(JSON.stringify(emitted).includes('private'),false);
});

test('room socket correlation drops missing, malformed or unsafe required fields', () => {
  for(const key of ['processId','socketNonce']) {
    for(const value of [undefined,null,1,{},[],socketIdentity[key].toUpperCase(),'private-token','https://private.invalid',
      socketIdentity[key]+'\n',socketIdentity[key].replace('-4','-1'),socketIdentity[key].slice(0,19)+'0'+socketIdentity[key].slice(20)]) {
      assert.equal(safeChildDiagnosticLine(JSON.stringify({...socketIdentity,[key]:value})),null,key);
    }
  }
  for(const at of [undefined,null,'1793448000000',true,{},-1,1.5,Number.MAX_SAFE_INTEGER,8640000000000001,Infinity])
    assert.equal(safeChildDiagnosticLine(JSON.stringify({...socketIdentity,at})),null);
  for(const at of [0,Date.now(),8640000000000000])
    assert.equal(JSON.parse(safeChildDiagnosticLine(JSON.stringify({...socketIdentity,at}))).at,at);
});

test('room socket diagnostics share the existing stream flood cap and never propagate emitter failures', () => {
  const emitted=[];
  const {web}=withChildDiagnostics({web:{}},{limit:2,emit:line=>{emitted.push(JSON.parse(line));throw Error('sink unavailable');}});
  web.onStdoutLine(JSON.stringify({...socketIdentity,processId:'invalid'}));
  web.onStdoutLine(JSON.stringify(socketIdentity));
  web.onStderrLine(JSON.stringify({event:'moving_speech_cleanup_requires_recovery'}));
  web.onStderrLine(JSON.stringify(socketIdentity));web.onStdoutLine(JSON.stringify(socketIdentity));
  assert.deepEqual(emitted,[{...socketIdentity,source:'game'},{event:'moving_speech_cleanup_requires_recovery',source:'game'}]);
});

test('the actual room upgrade console.info record crosses a real child stdout and production forwarder', {timeout:5000}, async t => {
  const emitted=[],startedAt=Date.now();let received;
  const observed=new Promise(resolve=>{received=resolve;});
  const moduleUrl=new URL('../../../services/game/shared-room-upgrade.mjs',import.meta.url).href;
  const script=`
    import {EventEmitter} from 'node:events';
    import {createSharedRoomUpgrade} from ${JSON.stringify(moduleUrl)};
    class Server extends EventEmitter {
      handleUpgrade(request,socket,head,done){const client=new EventEmitter();client.readyState=3;done(client);}
      close(done){done();}
    }
    const request=Object.assign(new EventEmitter(),{method:'GET',url:'/shared-room/synthetic',rawHeaders:[],
      headers:{host:'engine.invalid',origin:'https://player.invalid',upgrade:'websocket',connection:'Upgrade',cookie:'private-cookie'}});
    const raw=Object.assign(new EventEmitter(),{readable:true,writable:true,readableEnded:false,destroyed:false,pause(){},resume(){}});
    const upgrade=createSharedRoomUpgrade({engineOrigin:'https://engine.invalid',origin:'https://player.invalid',WebSocketServer:Server,
      channel:{async prepare(){return {attach(){}};},close(){}}});
    console.info('private startup text https://private.invalid');
    await upgrade.handleUpgrade(request,raw,Buffer.alloc(0));await upgrade.close();
    setInterval(()=>{},1000);
  `;
  const specs=withChildDiagnostics({web:{command:process.execPath,args:['--input-type=module','-e',script],cwd:process.cwd(),
    env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot}}},{emit:line=>{emitted.push(JSON.parse(line));received();}});
  const group=await startChildren(specs,{portCheck:async()=>{},wait:async()=>{}});
  t.after(()=>group.stop());
  await Promise.race([observed,group.ended.then(()=>assert.fail('child exited before correlation log'))]);
  await group.stop();
  assert.equal(emitted.length,1);
  const row=emitted[0];
  assert.deepEqual(Object.keys(row).sort(),['at','event','processId','socketNonce','source']);
  assert.equal(row.event,socketIdentity.event);assert.equal(row.source,'game');
  assert.notEqual(row.processId,row.socketNonce);assert.ok(row.at>=startedAt && row.at<=Date.now());
  assert.equal(JSON.stringify(row).includes('private'),false);
});

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
  const specs = withChildDiagnostics({ web: { command: 'node', env: {} } }, { emit: () => {} });
  assert.equal(typeof specs.web.onStdoutLine, 'function'); assert.equal(specs.web.onStderrLine, specs.web.onStdoutLine);
  assert.deepEqual(Object.keys(specs), ['web']);
  // Specifications stay stdio-free until start applies the transform; QA keeps its own transform.
  const env = { NODE_ENV:'production', CROUPIER_CLOUD_LAUNCH:'pilot', CROUPIER_CLOUD_LAYOUT:'single-origin',
    RENDER_EXTERNAL_URL:'https://game.example.test', PORT:'10000',     CROUPIER_GAME_DATABASE_URL:'postgresql://game:fixture@game.neon.tech/game?sslmode=require',
    CROUPIER_STUDIO_ENVIRONMENT_ID:'production', CROUPIER_STUDIO_WORKSPACE_ID:'croupier',
    BLOB_READ_WRITE_TOKEN:'fixture-blob',
    OPENCLAW_PRODUCT_SPEECH_URL:'https://speech.example.test', OPENCLAW_PRODUCT_SPEECH_TOKEN:'fixture-speech' };
  const plain = childSpecifications(validateCloudConfig(env), env);
  assert.deepEqual(Object.keys(plain), ['web']);
  assert.equal(plain.web.onStdoutLine, undefined);
  await assert.rejects(main(['--bogus'], env), /Usage/);
});

test('a real child process: console.warn diagnostics on stderr reach the parent emitter, startup text and stdout noise do not', async () => {
  const emitted = [];
  const script = [
    "console.log('croupier demo on http://127.0.0.1:4173 private-startup-detail');",
    "console.warn('plain startup warning that must stay private');",
    "console.warn(JSON.stringify({event:'moving_drift_guard_rejected',phase:'submit',reason:'observation_unknown',desiredMode:'saving',drainRequired:false,observedStatus:'unknown',observedReason:'drift_observation_stale',executionAge:'fresh',observationAge:'stale',lease:'active',revisionMatches:true,operationMatches:true,profileMatches:true,endpointMatches:true,catalogueMatches:true,executorFenceMatches:true,appliedRevisionMatches:true,appliedOperationMatches:true,executionIdentityMatches:true,observationCatalogueMatches:true}));",
    "console.info(JSON.stringify({event:'moving_drift_readback_timing',phase:'provider_observation',result:'success',durationClass:'overdue'}));",
    "console.warn(JSON.stringify({event:'moving_speech_preparation_failed',code:'generated_speech_total_budget_exhausted',phase:'admission',streamId:null,requestId:'62fe0cc0-912f-4a4d-8a56-819794c8b2c1'}));",
    'setTimeout(()=>{},200);',
  ].join('\n');
  const specs = withChildDiagnostics({ web: { command: process.execPath, args: ['-e', script], cwd: process.cwd(), env: { PATH: process.env.PATH } } }, { emit: value => emitted.push(JSON.parse(value)) });
  let seenStdio;
  const group = await startChildren(specs, { portCheck: async () => {}, wait: async () => {},
    spawnProcess: (command, args, options) => { seenStdio ??= options.stdio; return spawn(command, args, options); } });
  await new Promise(resolve => setTimeout(resolve, 600));
  await group.stop();
  assert.deepEqual(seenStdio, ['ignore', 'pipe', 'pipe']);
  assert.deepEqual(emitted.map(row => row.event).sort(), ['moving_drift_guard_rejected', 'moving_drift_readback_timing', 'moving_speech_preparation_failed']);
  assert.equal(emitted.find(row => row.event === 'moving_speech_preparation_failed').code, 'generated_speech_total_budget_exhausted');
  assert.ok(emitted.every(row => row.source === 'game' && !JSON.stringify(row).includes('private') && !JSON.stringify(row).includes('startup')));
});

test('moving speech recovery is forwarded per dealer with a bounded dealer ID and count only', () => {
  assert.deepEqual(JSON.parse(safeChildDiagnosticLine(JSON.stringify({ event: 'moving_speech_recovery', dealerId: 'paow', unresolved: 2, sessionIds: ['a'.repeat(32)] }))),
    { event: 'moving_speech_recovery', source: 'game', dealerId: 'paow', unresolved: 2 });
  for (const bad of [{ unresolved: 1 }, { dealerId: 'Paow', unresolved: 1 }, { dealerId: 'x'.repeat(41), unresolved: 1 },
    { dealerId: 'https://evil.invalid', unresolved: 1 }, { dealerId: 'paow', unresolved: -1 }, { dealerId: 'paow', unresolved: 100001 }, { dealerId: 'paow' }])
    assert.equal(safeChildDiagnosticLine(JSON.stringify({ event: 'moving_speech_recovery', ...bad })), null, JSON.stringify(bad));
});


test('optional speech startup diagnostic forwards only fixed unavailable status and reasons',()=>{
  const emitted=[];
  const {web}=withChildDiagnostics({web:{}},{emit:line=>emitted.push(JSON.parse(line))});
  for(const reason of ['configuration_invalid','configuration_or_bank_invalid','bank_preflight_timeout']) {
    web.onStderrLine(JSON.stringify({event:'speech_startup_unavailable',state:'unavailable',reason,
      error:'private-provider-failure',url:'https://private.invalid',token:'private-token'}));
    assert.deepEqual(emitted.at(-1),{event:'speech_startup_unavailable',source:'game',state:'unavailable',reason});
  }
  for(const invalid of [{state:'ready',reason:'configuration_invalid'},
    {state:'unavailable',reason:'private-provider-failure'}, {reason:'configuration_invalid'}]) {
    assert.equal(safeChildDiagnosticLine(JSON.stringify({event:'speech_startup_unavailable',...invalid})),null);
  }
  assert.equal(emitted.length,3);assert.equal(JSON.stringify(emitted).includes('private'),false);
});
