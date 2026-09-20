import { mkdir, readFile, writeFile, rename, lstat, link, unlink } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { dashboardOrigin, planGatewayConfig, requireGatewaySecrets } from './gateway-config.mjs';
import { syncRuntimeBundle } from './runtime-bundle.mjs';

const OPENCLAW_ENTRY = '/app/openclaw.mjs';

export function gatewayEnvironment(env) {
  requireGatewaySecrets(env);
  // Validate ingress before reading or writing any persisted configuration.
  dashboardOrigin(env);
  const stateDir = env.OPENCLAW_STATE_DIR || '/data/openclaw';
  const configPath = env.OPENCLAW_CONFIG_PATH || path.join(stateDir, 'openclaw.json');
  const relative = path.relative(stateDir, configPath);
  if (!path.isAbsolute(stateDir) || !path.isAbsolute(configPath) || relative === ''
    || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('OPENCLAW_CONFIG_PATH must be a file inside the absolute OPENCLAW_STATE_DIR.');
  }
  const childEnv = {
    ...env,
    OPENCLAW_STATE_DIR: stateDir,
    OPENCLAW_CONFIG_PATH: configPath,
    OPENCLAW_GATEWAY_PASSWORD: env.OPENCLAWAPI_KEY.trim(),
  };
  // This service now uses native editable config and one password credential.
  // Never let a retired image/environment default put it back into read-only mode.
  delete childEnv.OPENCLAW_CONFIG_READONLY;
  delete childEnv.OPENCLAW_GATEWAY_TOKEN;
  return childEnv;
}

export function parseGatewayConfig(raw) {
  try { return JSON.parse(raw); } catch {
    // Native OpenClaw also accepts JSON5. Use its pinned, already-bundled parser;
    // there is no package download or unrelated workspace dependency fallback.
    try { return createRequire('/app/package.json')('json5').parse(raw); } catch {
      throw new Error('Persisted OpenClaw configuration is invalid JSON/JSON5 or its bundled parser is unavailable.');
    }
  }
}

export async function validateGatewayConfig(configPath, env) {
  const validate = spawn(process.execPath, ['/app/openclaw.mjs', 'config', 'validate', '--json'], {
    env: { ...env, OPENCLAW_CONFIG_PATH: configPath }, stdio: 'ignore',
  });
  const validationCode = await new Promise((resolve, reject) => {
    validate.once('error', reject);
    validate.once('close', resolve);
  });
  if (validationCode !== 0) {
    throw new Error('OpenClaw rejected the configuration. Inspect config validation in the private service shell; the saved configuration was not replaced.');
  }
}

async function readExistingConfig(configPath) {
  try {
    const file = await lstat(configPath);
    if (!file.isFile() || file.isSymbolicLink()) throw new Error('OPENCLAW_CONFIG_PATH must be a regular file, not a symlink.');
    return await readFile(configPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function prepareGatewayConfig(env, {
  validateConfig = validateGatewayConfig,
  parseConfig = parseGatewayConfig,
} = {}) {
  const gatewayEnv = gatewayEnvironment(env);
  const stateDir = gatewayEnv.OPENCLAW_STATE_DIR;
  const configPath = gatewayEnv.OPENCLAW_CONFIG_PATH;
  await mkdir(path.dirname(configPath), { recursive: true, mode: 0o700 });
  const original = await readExistingConfig(configPath);
  let existing = null;
  if (original !== null) {
    try { existing = parseConfig(original); } catch {
      throw new Error('Persisted OpenClaw configuration could not be parsed. It has been left unchanged.');
    }
    if (existing === null) throw new Error('Persisted OpenClaw configuration cannot be null. It has been left unchanged.');
  }
  const plan = planGatewayConfig(existing, gatewayEnv);
  if (plan.action === 'reuse') {
    await validateConfig(configPath, gatewayEnv);
    return { ...plan, gatewayEnv, configPath, backupPath: null };
  }
  const candidate = `${configPath}.${randomUUID()}.tmp`;
  let backupPath = null;
  try {
    await writeFile(candidate, `${JSON.stringify(plan.config, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    await validateConfig(candidate, gatewayEnv);
    if (plan.action === 'seed' || plan.action === 'migrate-legacy') {
      for (const agent of Object.values(plan.config.agents.entries)) {
        await mkdir(agent.workspace, { recursive: true, mode: 0o700 });
        await mkdir(agent.agentDir, { recursive: true, mode: 0o700 });
      }
    }
    if (original === null) {
      // An exclusive link cannot overwrite a config created during validation.
      await link(candidate, configPath);
    } else {
      if (await readExistingConfig(configPath) !== original) {
        throw new Error('OpenClaw configuration changed during startup; refusing to overwrite it. Restart after the other writer finishes.');
      }
      if (plan.action === 'migrate-legacy' || plan.action === 'reconcile-ownership') {
        backupPath = `${configPath}.${plan.action === 'migrate-legacy' ? 'pre-dashboard-migration' : 'pre-ownership-migration'}.bak`;
        try { await writeFile(backupPath, original, { flag: 'wx', mode: 0o600 }); } catch (error) {
          if (error.code !== 'EEXIST' || await readExistingConfig(backupPath) !== original) {
            throw new Error('Could not safely preserve the Gateway configuration backup. No configuration was replaced.');
          }
        }
      }
      await rename(candidate, configPath);
    }
    return { ...plan, gatewayEnv, configPath, backupPath };
  } finally {
    await unlink(candidate).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  }
}

export async function prepareGatewayRuntime(env, options = {}) {
  const prepared = await prepareGatewayConfig(env, options);
  const bundle = await syncRuntimeBundle(prepared.config, prepared.gatewayEnv.OPENCLAW_STATE_DIR, options);
  return { ...prepared, bundle };
}

async function main() {
  const { gatewayEnv, action, bundle } = await prepareGatewayRuntime(process.env);
  if (action === 'migrate-legacy') {
    console.info('Migrated the exact legacy lab configuration; a private backup was retained and agent state was preserved.');
  }
  console.info(`Croupier runtime bundle: ${JSON.stringify(bundle)}`);
  const gateway = spawn(process.execPath, [OPENCLAW_ENTRY, 'gateway', '--bind', 'lan'], {
    env: gatewayEnv, stdio: 'inherit',
  });
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => gateway.kill(signal));
  gateway.once('error', () => { console.error('OpenClaw could not start.'); process.exitCode = 1; });
  gateway.once('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // Known validation messages are static. Filesystem/spawn errors can include
    // user data in their messages, so report only their standard error code.
    console.error(error.code ? `OpenClaw setup failed (${error.code}).` : error.message);
    process.exitCode = 1;
  });
}
