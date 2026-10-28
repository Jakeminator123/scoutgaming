// Spelmotorns launch-adress från apikeys/launch: den godkända speladressen med exakt
// en launch-token. En regel för Integrationer (studioPartnerResult) och Demo-byggaren.
import { isDealerId } from '../../../packages/presentation/contracts/dealer-identity.mjs';

export const PARTNER_LAUNCH_PATHS = Object.freeze(['/game', '/blackjack']);
const LAUNCH_TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/** The parsed launch address when `value` is the engine's start on the exact https
 * `gameOrigin` (server configuration, never request JSON); otherwise null. */
export function approvedPartnerLaunchUrl(value, gameOrigin) {
  if (typeof value !== 'string' || typeof gameOrigin !== 'string') return null;
  let url, approved;
  try { url = new URL(value); approved = new URL(gameOrigin); } catch { return null; }
  const query = [...url.searchParams.keys()];
  if (approved.origin !== gameOrigin || approved.protocol !== 'https:' || approved.username || approved.password
    || url.origin !== approved.origin || url.username || url.password || url.hash || !PARTNER_LAUNCH_PATHS.includes(url.pathname)
    // A launch opens the lobby (L1, O02); an engine deployed before that still adds a
    // well-formed dealer, which its landing then ignores without a company.
    || query.length !== (query.includes('dealer') ? 2 : 1) || !query.includes('launch')
    || query.includes('dealer') && !isDealerId(url.searchParams.get('dealer'))
    || !LAUNCH_TOKEN.test(url.searchParams.get('launch') || '')
    || url.href.length > 16384) return null;
  return url;
}
