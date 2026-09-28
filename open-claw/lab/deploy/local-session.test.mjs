import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { join, dirname, basename, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { acquireLocalSession } from './local-session.mjs';
import { startIsolatedConnection } from './local-connection.mjs';
import { startLocalComparison } from '../../../tools/start-local-comparison.mjs';
import { startLabSession } from '../../../tools/start-lab-session.mjs';

const moduleUrl = new URL('./local-session.mjs', import.meta.url).href;

async function testRoot(t) {
  const root = await mkdtemp(join(tmpdir(), 'croupier-session-test-'));
  t.after(async () => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(basename(root).startsWith('croupier-session-test-'));
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

async function ports() {
  const held = [createServer(), createServer()];
  for (const server of held) await new Promise(yes => server.listen(0, '127.0.0.1', yes));
  const [productPort, labPort] = held.map(server => server.address().port);
  for (const server of held) await new Promise(yes => server.close(yes));
  return { productPort, labPort };
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const ended = once(child, 'exit'); child.kill('SIGKILL'); await ended;
}

async function holder(t, root, pair) {
  const program = `
    import {acquireLocalSession} from ${JSON.stringify(moduleUrl)};
    try {
      const session = await acquireLocalSession(${JSON.stringify({ repoRoot: root, ...pair })});
      process.send({won:true});
      process.on('message',async message=>{
        if(message?.track){session.trackChild({pid:message.track});process.send({tracked:true});return;}
        await session.release();process.exit(0);
      });
    } catch(error) { process.send({won:false,code:error.code,message:error.message});process.exit(0); }
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', program], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  let stderr = ''; child.stderr.on('data', value => { stderr += value; });
  t.after(() => stop(child));
  const result = await new Promise((yes, no) => {
    child.once('message', yes); child.once('error', no);
    child.once('exit', code => no(new Error(`Holder exited ${code}: ${stderr}`)));
  });
  return { child, result };
}

test('different ports and a standalone lab share one session; release allows the next owner', async t => {
  const repoRoot = await testRoot(t), first = await ports(), next = await ports();
  const session = await acquireLocalSession({ repoRoot, ...first });
  try {
    await assert.rejects(acquireLocalSession({ repoRoot, ...next }), error => error.code === 'CROUPIER_SESSION_ACTIVE'
      && error.message.includes(String(first.productPort)) && error.message.includes(String(first.labPort)));
    await assert.rejects(acquireLocalSession({ repoRoot, labPort: next.labPort }), { code: 'CROUPIER_SESSION_ACTIVE' });
  } finally { await session.release(); }
  const replacement = await acquireLocalSession({ repoRoot, labPort: next.labPort });
  await replacement.release();
});

test('simultaneous independent starters elect exactly one owner', async t => {
  const repoRoot = await testRoot(t);
  const candidates = await Promise.all(Array.from({ length: 4 }, async () => holder(t, repoRoot, await ports())));
  assert.equal(candidates.filter(item => item.result.won).length, 1);
  assert.ok(candidates.filter(item => !item.result.won).every(item => item.result.code === 'CROUPIER_SESSION_ACTIVE'));
  const winner = candidates.find(item => item.result.won).child;
  const ended = once(winner, 'exit'); winner.send('stop'); await ended;
  const replacement = await acquireLocalSession({ repoRoot, ...await ports() }); await replacement.release();
});

test('dead owner is recovered, but an occupied old port still blocks a different pair', async t => {
  const repoRoot = await testRoot(t), pair = await ports();
  const owned = await holder(t, repoRoot, pair); assert.equal(owned.result.won, true);
  await stop(owned.child);
  const server = createServer();
  await new Promise(yes => server.listen(pair.productPort, '127.0.0.1', yes));
  try { await assert.rejects(acquireLocalSession({ repoRoot, ...await ports() }), { code: 'CROUPIER_SESSION_ACTIVE' }); }
  finally { await new Promise(yes => server.close(yes)); }
  const recovered = await acquireLocalSession({ repoRoot, ...await ports() }); await recovered.release();
});

test('a surviving build/server child keeps the session after its launcher crashes', async t => {
  const repoRoot = await testRoot(t), pair = await ports();
  const owned = await holder(t, repoRoot, pair); assert.equal(owned.result.won, true);
  // Spawn as a sibling so Windows job/process-tree cleanup cannot help this
  // test by killing the registered child together with the launcher.
  const survivor = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { windowsHide: true, stdio: 'ignore' });
  t.after(() => stop(survivor));
  const tracked = once(owned.child, 'message'); owned.child.send({ track: survivor.pid }); await tracked;
  await stop(owned.child);
  await assert.rejects(acquireLocalSession({ repoRoot, ...await ports() }), { code: 'CROUPIER_SESSION_ACTIVE' });
  await stop(survivor);
  const recovered = await acquireLocalSession({ repoRoot, ...await ports() }); await recovered.release();
});

test('a late child of an old session fails in preload before its program can run', async t => {
  const repoRoot = await testRoot(t), pair = await ports();
  const old = await acquireLocalSession({ repoRoot, ...pair });
  const oldEnv = old.environment(process.env);
  await old.release();
  const current = await acquireLocalSession({ repoRoot, ...pair });
  const marker = join(repoRoot, 'must-not-exist');
  try {
    const child = spawn(process.execPath, ['--input-type=module', '-e', `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(marker)},'started');`], {
      windowsHide: true, stdio: 'ignore', env: oldEnv,
    });
    t.after(() => stop(child));
    const [code] = await once(child, 'exit'); assert.notEqual(code, 0);
    await assert.rejects(access(marker), { code: 'ENOENT' });
  } finally { await current.release(); }
});

test('all launchers refuse before preparation and startup failure releases the session', async t => {
  const repoRoot = await testRoot(t), pair = await ports(), next = await ports();
  const session = await acquireLocalSession({ repoRoot, ...pair });
  let preparations = 0;
  const options = { repoRoot, ...next, envFiles: [], env: { LAB_REMOTE_URL: 'https://fixture.invalid', LAB_REMOTE_TOKEN: 'fixture' },
    prepare: () => { preparations++; throw new Error('fixture preparation failed'); } };
  try {
    await assert.rejects(startIsolatedConnection(options), { code: 'CROUPIER_SESSION_ACTIVE' });
    await assert.rejects(startLocalComparison({ repoRoot, gamePort: next.productPort, labPort: next.labPort }), { code: 'CROUPIER_SESSION_ACTIVE' });
    await assert.rejects(startLabSession({ repoRoot, port: next.labPort }), { code: 'CROUPIER_SESSION_ACTIVE' });
    assert.equal(preparations, 0);
  } finally { await session.release(); }
  await assert.rejects(startIsolatedConnection(options), /fixture preparation failed/);
  assert.equal(preparations, 1);
  const recovered = await acquireLocalSession({ repoRoot, ...next }); await recovered.release();
});
