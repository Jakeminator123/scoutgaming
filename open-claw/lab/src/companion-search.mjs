// Only a key-free provider, with no paid fallback and no user-selectable URL.
// Search fees are therefore 0 SEK. Model/TTS/hosting fees are separate.
const HOST = 'https://html.duckduckgo.com/html/';
const decode = value => value.replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
  const code = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
  return code <= 0x10ffff ? String.fromCodePoint(code) : '';
}).replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const plain = value => decode(value.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();

export function parseSearchResults(html) {
  const results = [];
  const links = [...html.matchAll(/<a\b([^>]*\bclass=["'][^"']*\bresult__a\b[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi)];
  for (let i = 0; i < links.length && results.length < 3; i++) {
    const href = links[i][1].match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    let url;
    try {
      const link = new URL(decode(href), HOST);
      url = new URL(link.hostname.endsWith('duckduckgo.com') ? link.searchParams.get('uddg') || link.href : link.href);
    } catch { continue; }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) continue;
    const tail = html.slice(links[i].index + links[i][0].length, links[i + 1]?.index ?? html.length);
    const snippet = tail.match(/<(?:a|div)\b[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div)>/i)?.[1] || '';
    results.push({ title: plain(links[i][2]).slice(0, 160), url: url.href.slice(0, 1500), snippet: plain(snippet).slice(0, 500) });
  }
  return results;
}

export async function searchPublicWeb(query, { store, fetchImpl = fetch } = {}) {
  if (typeof query !== 'string' || !query.trim() || query.length > 240 || /[\u0000-\u001f]/.test(query)) return { status: 'invalid_query', results: [], costSek: 0 };
  if (!store.reserveSearch()) return { status: 'hourly_limit', results: [], costSek: 0 };
  try {
    const url = new URL(HOST); url.searchParams.set('q', query.trim()); url.searchParams.set('kp', '1');
    const response = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(8000), headers: { Accept: 'text/html' } });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) { await response.body?.cancel(); return { status: 'unavailable', results: [], costSek: 0 }; }
    const reader = response.body.getReader(); let bytes = 0; const chunks = [];
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        bytes += value.length;
        if (bytes > 256 * 1024) { await reader.cancel(); return { status: 'unavailable', results: [], costSek: 0 }; }
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
    const html = Buffer.concat(chunks).toString('utf8');
    const results = /anomaly\.js|challenge-form|anomaly-modal/i.test(html) ? [] : parseSearchResults(html);
    return { status: results.length ? 'searched' : 'unavailable', results, costSek: 0 };
  } catch { return { status: 'unavailable', results: [], costSek: 0 }; }
}
