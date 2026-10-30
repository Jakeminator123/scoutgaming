import { createHmac, randomBytes } from 'node:crypto';
import { remoteRequest } from '../../../packages/presentation/server/director-transport.mjs';
import { StudioError } from './project-store.mjs';

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
  const cookiePath = '/studio/api/social';
  return { identity, cookie: token ? null : `${COOKIE}=${fresh}; Path=${cookiePath}; HttpOnly; SameSite=Strict; Max-Age=2592000${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}` };
}

// Names and memory live only in the Render Director's store. The connected-local
// mode that opened that store inside the Studio process is retired (AGENTS.md).
export async function companionRequest(body, settings, fetchImpl = fetch) {
  if (settings.companionEnabled === false) throw new StudioError('Namn och minne är avstängt.', 503);
  if (!settings.remoteUrl) throw new StudioError('Namn och minne kräver den anslutna Render-Directorn.', 503);
  return remoteRequest('/api/studio/companion', body, settings, fetchImpl, 90000);
}
