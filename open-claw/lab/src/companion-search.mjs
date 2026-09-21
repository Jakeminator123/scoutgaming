import { randomBytes } from 'node:crypto';
import { boundedJson } from './openclaw.mjs';
import { gatewayEndpoint } from './settings.mjs';

// The private helper owns the provider credential and durable money budget.
export async function searchPublicWeb(query, { store, settings, fetchImpl = fetch } = {}) {
  const unavailable = { status: 'unavailable', results: [], costSek: 0, costKind: 'reserved_upper_bound' };
  if (typeof query !== 'string' || !query.trim() || query.length > 240 || /[\u0000-\u001f]/.test(query)) return { ...unavailable, status: 'invalid_query' };
  if (!store.reserveSearch()) return { ...unavailable, status: 'hourly_limit' };
  try {
    const url = new URL(gatewayEndpoint(settings.baseUrl));
    if (url.protocol !== 'http:' || !(url.hostname.endsWith('.internal') || !url.hostname.includes('.') || ['127.0.0.1', '[::1]'].includes(url.hostname))) return unavailable;
    url.port = '18790'; url.pathname = '/search';
    const response = await fetchImpl(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(27000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.gatewayKey}` },
      body: JSON.stringify({ id: randomBytes(32).toString('hex'), query: query.trim() }) });
    if (!response.ok) { await response.body?.cancel(); return unavailable; }
    const evidence = await boundedJson(response, 16000);
    if (!['searched', 'hourly_limit', 'unavailable', 'not_configured', 'pricing_review_required', 'disabled', 'interrupted'].includes(evidence?.status)
      || !Array.isArray(evidence.results) || evidence.results.length > 3 || ![0, 0.5].includes(evidence.costSek)) return unavailable;
    return evidence;
  } catch { return unavailable; }
}
