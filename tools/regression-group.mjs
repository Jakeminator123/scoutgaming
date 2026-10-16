import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

// Each invocation owns only the process tree it starts. No global process scan.
export async function runGroup({ name, seconds, command, args = [], cwd = process.cwd(),
  env = process.env, log = console.log, heartbeatMs = 30000, graceMs = 2000 }) {
  if (!/^[a-z0-9][a-z0-9/-]*$/.test(name) || !Number.isFinite(seconds) || seconds <= 0 || !command) {
    throw Error('Expected a group name, positive timeout in seconds, and command.');
  }
  const start = performance.now();
  const elapsed = () => Math.round(performance.now() - start);
  const record = row => {
    if (env.RUNNER_TEMP) appendFileSync(join(env.RUNNER_TEMP, 'dealer-regression-timing.jsonl'), JSON.stringify(row) + '\n');
  };
  log(`::group::${name} (limit ${seconds}s)`);
  log(`[regression] START ${name} ${new Date().toISOString()}`);
  record({ group: name, event: 'start', at: new Date().toISOString(), timeoutSeconds: seconds });
  let result;
  try {
    result = await new Promise(resolveRun => {
      const child = spawn(command === 'node' ? process.execPath : command, args, {
        cwd, env, stdio: 'inherit', detached: process.platform !== 'win32', windowsHide: true,
      });
      let stopping, finished = false, forceTimer;
      const killTree = force => {
        if (!child.pid) return;
        if (process.platform === 'win32') {
          // taskkill /F already terminates the tree immediately. Never target
          // that PID again after it exits (Windows may reuse it).
          if (force) return;
          const killed = spawnSync(join(process.env.SystemRoot || 'C:/Windows', 'System32/taskkill.exe'),
            ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
          if (killed.error || killed.status !== 0) {
            // Restricted shells can deny taskkill even for their own children.
            // Still close the direct child handle and report the cleanup failure.
            child.kill('SIGKILL');
            log(`[regression] Process-tree cleanup unavailable for ${name} (PID ${child.pid})`);
          }
        } else {
          try { process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM'); }
          catch (error) { if (error.code !== 'ESRCH') throw error; }
        }
      };
      const finish = (code, signal, error) => {
        if (finished) return;
        finished = true;
        clearTimeout(deadline); clearInterval(heartbeat); clearTimeout(forceTimer);
        process.off('SIGINT', interrupt); process.off('SIGTERM', terminate);
        resolveRun({ status: stopping || (error ? 'start-failed' : code === 0 ? 'passed' : 'failed'),
          exitCode: stopping === 'timed-out' ? 124 : stopping ? 130 : code === 0 ? 0 : code || 1,
          ...(signal ? { signal } : {}), ...(error ? { errorCode: error.code || 'spawn_failed' } : {}) });
      };
      const stop = status => {
        if (stopping || finished) return;
        stopping = status;
        log(`[regression] ${status.toUpperCase()} ${name} after ${(elapsed() / 1000).toFixed(1)}s`);
        killTree(false);
        // Kill descendants even when their parent exits during graceful cleanup.
        forceTimer = setTimeout(() => { killTree(true); finish(null); }, graceMs);
      };
      const interrupt = () => stop('cancelled');
      const terminate = () => stop('cancelled');
      const deadline = setTimeout(() => stop('timed-out'), seconds * 1000);
      const heartbeat = setInterval(() => log(`[regression] RUNNING ${name} ${(elapsed() / 1000).toFixed(1)}s / ${seconds}s`), heartbeatMs);
      process.on('SIGINT', interrupt); process.on('SIGTERM', terminate);
      child.once('error', error => finish(null, null, error));
      child.once('exit', (code, signal) => { if (!stopping) finish(code, signal); });
    });
    const row = { group: name, event: 'end', ...result, durationMs: elapsed() };
    record(row);
    log(`[regression] END ${name} ${row.status} ${(row.durationMs / 1000).toFixed(3)}s (exit ${row.exitCode})`);
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY,
      `- \`${name}\`: **${row.status}**, ${(row.durationMs / 1000).toFixed(3)}s (limit ${seconds}s)\n`);
    return row;
  } finally {
    log('::endgroup::');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [name, seconds, command, ...args] = process.argv.slice(2);
  try { process.exitCode = (await runGroup({ name, seconds: Number(seconds), command, args })).exitCode; }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
