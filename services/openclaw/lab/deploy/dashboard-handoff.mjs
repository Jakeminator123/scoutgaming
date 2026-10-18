import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);

// Official v2026.9.5 dashboard JSON issues a single-use owner handoff. Capture
// stdout privately: the CLI also returns legacy password/token fields. Never log it.
export async function issueDashboardHandoff(env, { execute = run, now = Date.now } = {}) {
  if (env.OPENCLAW_DASHBOARD_ORIGIN !== 'https://croupier-lab-director.onrender.com') throw new Error('openclaw_dashboard_unavailable');
  try {
    const { stdout } = await execute(process.execPath, ['/app/openclaw.mjs', 'dashboard', '--json', '--no-open'],
      { env, encoding:'utf8', timeout:20000, maxBuffer:32768, windowsHide:true });
    const result = JSON.parse(stdout);
    const url = new URL(result.browserUrl);
    const params = new URLSearchParams(url.hash.slice(1));
    const bootstrapToken = params.get('bootstrapToken');
    const expiresAtMs = result.browserBootstrapExpiresAtMs;
    const gateway = new URL(params.get('gatewayUrl'));
    if (result.ok !== true || !['http:', 'https:'].includes(url.protocol) || !['localhost','127.0.0.1','[::1]'].includes(url.hostname)
      || url.username || url.password || url.pathname !== '/openclaw/' || url.search
      || gateway.host !== url.host || gateway.pathname.replace(/\/$/, '') !== '/openclaw' || gateway.username || gateway.password || gateway.search || gateway.hash
      || gateway.protocol !== (url.protocol === 'https:' ? 'wss:' : 'ws:')
      || params.size !== 3 || params.get('bootstrapProfile') !== 'owner'
      || typeof bootstrapToken !== 'string' || !/^[a-zA-Z0-9_-]{32,256}$/.test(bootstrapToken)
      || !Number.isSafeInteger(expiresAtMs) || expiresAtMs <= now() || expiresAtMs > now() + 600000) throw Error();
    return { bootstrapToken, expiresAtMs };
  } catch { throw new Error('openclaw_dashboard_unavailable'); }
}
