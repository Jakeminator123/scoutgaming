import { request as httpRequest } from 'node:http';
import { WEB_PORT } from './config.mjs';

// Only the gateway calls this loopback endpoint. The Web process checks the
// current CRAIG identity and BO role for every Lab request.
export async function checkLabSession(cookie, labHost, { port = WEB_PORT, timeoutMs = 2000 } = {}) {
  if (typeof cookie !== 'string' || !cookie || Buffer.byteLength(cookie) > 8192) {
    return { authorized: false, available: true };
  }
  return new Promise(resolve => {
    let settled = false;
    const finish = result => { if (!settled) { settled = true; resolve(result); } };
    const request = httpRequest({ hostname: '127.0.0.1', port,
      path: '/api/auth/lab/check', method: 'GET',
      headers: { Host: labHost, Cookie: cookie, Accept: 'text/plain' } }, response => {
      response.resume();
      finish({ authorized: response.statusCode === 200, available: [200, 401].includes(response.statusCode) });
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error('lab_check_timeout')));
    request.on('error', () => finish({ authorized: false, available: false }));
    request.end();
  });
}
