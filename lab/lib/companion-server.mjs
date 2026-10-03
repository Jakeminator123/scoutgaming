import { createHmac, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { createCompanionService } from '../../open-claw/lab/src/companion.mjs';
import { remoteRequest } from './studio-server.mjs';
import { StudioError } from './project-store.mjs';
import { labUrl } from './lab-url.mjs';

const COOKIE = 'croupier_lab_companion';
export function labCompanionIdentity(request, settings) {
  const token = request.headers.get('cookie')?.match(/(?:^|;\s*)croupier_lab_companion=([a-f0-9]{64})(?:;|$)/)?.[1];
  const fresh = token || randomBytes(32).toString('hex');
  const secret = settings.remoteToken || settings.gatewayKey;
  if (!secret) throw new StudioError('OpenClaw måste anslutas innan namn och minne kan användas.', 503);
  // Names are not credentials. No browser-supplied playerId or Partner key is
  // accepted here. A future product adapter must derive its own authenticated
  // (tenant, player) identity in a different namespace.
  const identity = createHmac('sha256', secret).update(`croupier-lab-v1\0${fresh}`).digest('hex');
  const cookiePath = process.env.CROUPIER_LAB_BASE_PATH === '/studio' ? '/studio/api/social' : labUrl('/api/social');
  return { identity, cookie: token ? null : `${COOKIE}=${fresh}; Path=${cookiePath}; HttpOnly; SameSite=Strict; Max-Age=2592000${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}` };
}

const directServices = new Map();
export async function companionRequest(body, settings, fetchImpl = fetch) {
  if (settings.companionEnabled === false) throw new StudioError('Namn och minne är avstängt.', 503);
  if (settings.remoteUrl) return remoteRequest('/api/studio/companion', body, settings, fetchImpl, 90000);
  const directory = resolve(settings.dataDir, 'companion');
  let service = directServices.get(directory);
  if (!service) {
    service = createCompanionService({ directory, settings, fetchImpl });
    directServices.set(directory, service);
  }
  return service.handle(body);
}
