import { request as httpRequest } from 'node:http';

// Read-only probes, no cookies/credentials from a real account and no provider calls.
// This verifies local access boundaries, NOT public TLS, browser login or durability.
export function probeStatus({ port, host, path, headers = {}, timeoutMs = 3000 }) {
  return new Promise((resolve, reject) => {
    const request = httpRequest({ hostname: '127.0.0.1', port, path, method: 'GET',
      agent: false, headers: { ...headers, Host: host } }, response => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
      response.on('error', () => reject(new Error('Cloud access probe failed.')));
    });
    const deadline = setTimeout(() => request.destroy(new Error('Cloud access probe timed out.')), timeoutMs);
    request.on('close', () => clearTimeout(deadline));
    request.on('error', () => reject(new Error('Cloud access probe failed.')));
    request.end();
  });
}

export async function verifyCloudAccess(config, { gatewayPort } = {}) {
  const game = new URL(config.gameOrigin).host;
  const bo = new URL(config.boOrigin).host;
  const lab = new URL(config.labOrigin).host;
  const transportHost = config.vercelIngress ? new URL(config.vercelIngress.transportOrigin).host : null;
  const ingressHeaders = config.vercelIngress ? {
    'X-Croupier-Vercel-Secret': config.vercelIngress.secret,
    'X-Croupier-Public-Origin': config.vercelIngress.publicOrigin,
    'X-Forwarded-Host': game, 'X-Forwarded-Proto': 'https',
  } : {};
  const probes = [
    ['gateway health', game, '/__cloud/health', 200],
    ['unknown host', 'cloud-access-probe.invalid', '/__cloud/health', 421],
    ['player authentication', game, '/api/table', 401],
    ['BO speech QA authentication', bo, '/api/bo/speech-qa', 403],
    ['BO host boundary', game, '/api/bo/speech-qa', config.singleOrigin ? 403 : 421],
    ['Studio runtime boundary', lab, '/studio/api/project', 421],
    ['Studio forged session', lab, '/studio/api/project', 421, { Cookie: 'lab_session=invalid-cloud-start-probe' }],
    ['Lab internal route', lab, '/api/auth/lab/check', 421],
    ...(config.vercelIngress ? [['Studio session authentication', game, '/__vercel/lab/session', 401,
      { Cookie: 'lab_session=invalid-cloud-start-probe' }]] : []),
  ];
  for (const [label, host, path, expected, headers] of probes) {
    const unknown = label === 'unknown host';
    const status = await probeStatus({ port: gatewayPort, host: transportHost && !unknown ? transportHost : host,
      path, headers: { ...(!unknown ? ingressHeaders : {}), ...headers } });
    if (status !== expected) throw new Error(`Cloud access check failed: ${label}.`);
  }
}
