import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rm, access } from 'node:fs/promises';
import { join, dirname, basename, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { acquireLocalSession, matchesLocalSessionProcess } from './local-session.mjs';
import { startIsolatedConnection } from './local-connection.mjs';
import { startLocalComparison } from '../../../../tools/start-local-comparison.mjs';
import { startLabSession } from '../../../../tools/start-lab-session.mjs';

const moduleUrl = new URL('./local-session.mjs', import.meta.url).href;

test('retired live session blocks canonical guard and a released one never recreates the old directory', async t => {
  for (const legacyRoot of ['lissabon', 'lab']) {
  const repoRoot = await testRoot(t), pair = await ports();
  const legacyDir = join(repoRoot, legacyRoot, 'data');
  await mkdir(legacyDir, { recursive: true });
  const file = join(legacyDir, '.local-session.sqlite');
  const db = new DatabaseSync(file);
  try {
    db.exec('CREATE TABLE local_session(id INTEGER PRIMARY KEY,token TEXT,revision INTEGER,payload TEXT)');
    db.prepare('INSERT INTO local_session VALUES(1,?,1,?)').run('legacy', JSON.stringify({ ownerPid: process.pid, childPids: [], ...pair }));
    await assert.rejects(acquireLocalSession({ repoRoot, ...await ports() }), { code: 'CROUPIER_SESSION_ACTIVE' });
    db.prepare('DELETE FROM local_session').run();
  } finally { db.close(); }
  const migrated = await acquireLocalSession({ repoRoot, ...pair }); await migrated.release();
  await rm(join(repoRoot, legacyRoot), { recursive: true });
  const next = await acquireLocalSession({ repoRoot, ...pair }); await next.release();
  await assert.rejects(access(join(repoRoot, legacyRoot)), { code: 'ENOENT' });
  await access(join(repoRoot, 'apps/studio/data/.local-session.sqlite'));
  }
});

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

function changeSession(root, change) {
  const db = new DatabaseSync(join(root, 'apps', 'studio', 'data', '.local-session.sqlite'));
  try {
    const row = db.prepare('SELECT payload FROM local_session WHERE id=1').get();
    const state = JSON.parse(row.payload);
    change(state);
    db.prepare('UPDATE local_session SET payload=?,revision=revision+1 WHERE id=1').run(JSON.stringify(state));
  } finally { db.close(); }
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

test('process identity detects reused PIDs and conservatively handles legacy session rows', () => {
  const original = { name: 'node', startTime: '638946341234567890' };
  assert.equal(matchesLocalSessionProcess(original, { ...original }), true);
  assert.equal(matchesLocalSessionProcess(original, { ...original, startTime: '638946341234567891' }), false, 'A reused Node PID is not the old child.');
  assert.equal(matchesLocalSessionProcess(original, { name: 'conhost', startTime: '638946341234567999' }), false);
  assert.equal(matchesLocalSessionProcess(original, { name: 'next-server', startTime: original.startTime }), true, 'Changing a process title does not change its identity.');
  assert.equal(matchesLocalSessionProcess(undefined, { name: 'conhost', startTime: 'current' }), false, 'Legacy build PIDs reused by conhost must not permanently lock the repo.');
  for (const name of ['node', 'node.exe', 'cmd', 'powershell', 'next-server (v16)']) {
    assert.equal(matchesLocalSessionProcess(undefined, { name, startTime: 'current' }), true, `Legacy ${name} remains protected.`);
  }
  assert.equal(matchesLocalSessionProcess(undefined, null), true, 'Inspection failures remain conservative.');
  assert.equal(matchesLocalSessionProcess(original, { name: 'node', startTime: null }), true);
  assert.equal(matchesLocalSessionProcess(original, { name: 'chrome', startTime: null }), false, 'A verified browser PID cannot be the old Node child even when its start time is unreadable.');
  assert.equal(matchesLocalSessionProcess(original, { name: null, startTime: null }), true, 'Unknown process names still block a restart.');
});

test('Linux executable identity handles renamed threads and unavailable executable inspection', () => {
  const current = { name: 'MainThread', executableName: 'node', startTime: 'current' };
  assert.equal(matchesLocalSessionProcess(undefined, current), true, 'A Node executable stays protected after its thread is renamed.');
  assert.equal(matchesLocalSessionProcess(undefined, { ...current, executableName: 'sleep' }), false, 'An inspected unrelated executable is reclaimable.');
  assert.equal(matchesLocalSessionProcess(undefined, { ...current, executableName: null }), true, 'An unreadable executable is inconclusive.');
  assert.equal(matchesLocalSessionProcess({ name: 'node', startTime: 'old' }, current), false, 'Executable identity must not override a reused PID.');
  assert.equal(matchesLocalSessionProcess({ name: 'node', startTime: 'current' }, { ...current, executableName: null }), true);
});

test('a live PID with a different birth identity is reclaimed for both stale owners and children', async t => {
  const repoRoot = await testRoot(t), pair = await ports();
  for (const role of ['owner', 'child']) {
    await acquireLocalSession({ repoRoot, ...pair });
    changeSession(repoRoot, state => {
      assert.ok(state.processIdentities?.[process.pid]?.startTime, 'The current process must have an OS birth identity.');
      state.ownerPid = role === 'owner' ? process.pid : 0;
      state.childPids = role === 'child' ? [process.pid] : [];
      state.processIdentities[process.pid].startTime = 'a-previous-process-with-this-pid';
    });
    const recovered = await acquireLocalSession({ repoRoot, ...pair });
    await recovered.release();
  }
});

test('a legacy identity-free live Node child still prevents another session', async t => {
  const repoRoot = await testRoot(t), pair = await ports();
  const session = await acquireLocalSession({ repoRoot, ...pair });
  try {
    changeSession(repoRoot, state => { state.ownerPid = 0; state.childPids = [process.pid]; delete state.processIdentities; });
    await assert.rejects(acquireLocalSession({ repoRoot, ...await ports() }), { code: 'CROUPIER_SESSION_ACTIVE' });
  } finally {
    changeSession(repoRoot, state => { state.childPids = []; });
    await session.release();
  }
});

test('Linux legacy children remain protected when Node names its main thread MainThread', { skip: process.platform !== 'linux' }, async t => {
  const repoRoot = await testRoot(t), pair = await ports();
  const child = spawn(process.execPath, ['-e', 'process.title="MainThread";process.send({ready:true});setInterval(()=>{},1000)'], {
    windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  t.after(() => stop(child));
  const [ready] = await once(child, 'message', { signal: AbortSignal.timeout(10000) });
  assert.equal(ready.ready, true);
  const session = await acquireLocalSession({ repoRoot, ...pair });
  let replacement;
  try {
    changeSession(repoRoot, state => { state.ownerPid = 0; state.childPids = [child.pid]; delete state.processIdentities; });
    await assert.rejects(async () => {
      replacement = await acquireLocalSession({ repoRoot, ...await ports() });
    }, { code: 'CROUPIER_SESSION_ACTIVE' });
  } finally {
    await stop(child);
    await (replacement ?? session).release();
  }
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
