// Spelmotorns launch-adress från apikeys/launch: den godkända speladressen med exakt
// en launch-token. En regel för Integrationer (studioPartnerResult) och Demo-byggaren.
import { isDealerId } from '../../../packages/presentation/contracts/dealer-identity.mjs';
import { isOperatorSlug } from '../../../packages/navigation/operator-slug.mjs';

export const PARTNER_LAUNCH_PATHS = Object.freeze(['/game', '/blackjack']);
const LAUNCH_TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
// launch is required. operator is the key's company (Nyckel→bolag, docs/plans/NYCKEL-BOLAG.md):
// the engine adds its slug for a key with a company and checks it against the signed claim.
// dealer: an engine deployed before L1 (O02) still adds a well-formed one, which its landing
// then ignores without a company.
const LAUNCH_QUERY = new Set(['launch', 'operator', 'dealer']);

/** The parsed launch address when `value` is the engine's start on the exact https
 * `gameOrigin` (server configuration, never request JSON); otherwise null. */
export function approvedPartnerLaunchUrl(value, gameOrigin) {
  if (typeof value !== 'string' || typeof gameOrigin !== 'string') return null;
  let url, approved;
  try { url = new URL(value); approved = new URL(gameOrigin); } catch { return null; }
  const query = [...url.searchParams.keys()];
  if (approved.origin !== gameOrigin || approved.protocol !== 'https:' || approved.username || approved.password
    || url.origin !== approved.origin || url.username || url.password || url.hash || !PARTNER_LAUNCH_PATHS.includes(url.pathname)
    || new Set(query).size !== query.length || query.some(name => !LAUNCH_QUERY.has(name)) || !query.includes('launch')
    || query.includes('dealer') && !isDealerId(url.searchParams.get('dealer'))
    || query.includes('operator') && !isOperatorSlug(url.searchParams.get('operator'))
    || !LAUNCH_TOKEN.test(url.searchParams.get('launch') || '')
    || url.href.length > 16384) return null;
  return url;
}
