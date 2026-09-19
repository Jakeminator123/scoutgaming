import { mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { gatewayConfig } from './gateway-config.mjs';

async function main() {
  const stateDir = process.env.OPENCLAW_STATE_DIR || '/data/openclaw';
  const configPath = process.env.OPENCLAW_CONFIG_PATH || path.join(stateDir, 'openclaw.json');
  const config = gatewayConfig(process.env);
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  for (const agent of Object.values(config.agents.entries)) {
    await mkdir(agent.workspace, { recursive: true, mode: 0o700 });
    await mkdir(agent.agentDir, { recursive: true, mode: 0o700 });
  }
  // Only this dedicated lab config is managed. Sessions/workspaces are preserved.
  await writeFile(`${configPath}.tmp`, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await rename(`${configPath}.tmp`, configPath);
  const gatewayEnv = {
    ...process.env,
    OPENCLAW_STATE_DIR: stateDir,
    OPENCLAW_CONFIG_PATH: configPath,
    OPENCLAW_GATEWAY_TOKEN: process.env.OPENCLAWAPI_KEY,
  };
  const validate = spawn(process.execPath, ['/app/openclaw.mjs', 'config', 'validate', '--json'], {
    env: gatewayEnv, stdio: 'ignore',
  });
  const validationCode = await new Promise((resolve, reject) => {
    validate.once('error', reject);
    validate.once('exit', resolve);
  });
  if (validationCode !== 0) throw new Error('OpenClaw rejected the generated configuration. Inspect config validation in the private service shell.');
  const gateway = spawn(process.execPath, ['/app/openclaw.mjs', 'gateway', '--bind', 'lan'], {
    env: gatewayEnv, stdio: 'inherit',
  });
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => gateway.kill(signal));
  gateway.once('error', () => { console.error('OpenClaw could not start.'); process.exitCode = 1; });
  gateway.once('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
}

main().catch((error) => {
  // All setup errors above name missing fields; never log the environment/config.
  console.error(error.message);
  process.exitCode = 1;
});
