// Dealer clips through the media cache, with this host as the fallback (Emil 12 Oct). The cache answers only the
// production origin (Caddy sets Access-Control-Allow-Origin to croupier.scoutgg.dev), so on any other host, staging
// for one, the browser blocks every clip and the table showed "Video loading failed". A clip the cache cannot give
// comes from this host instead, and the cache is skipped for the rest of the visit. That also covers a cache outage.
export function createMediaFetch(urlFor, disable, fetchImpl = (u, o) => fetch(u, o)) {
  return async (u, o) => {
    const via = urlFor(u);
    if (via !== u) {
      try { const r = await fetchImpl(via, o); if (r.ok) return r; }
      catch (e) { if (o?.signal?.aborted) throw e; }
      disable();
    }
    return fetchImpl(u, o);
  };
}
