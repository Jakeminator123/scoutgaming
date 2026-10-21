// Call only after the caller's fresh authorization/context checks and the
// reader's exact-byte verification. This never authorizes or caches a lookup.
export async function revalidatePrivateMedia(response, request, sha256) {
  const headers = new Headers(response.headers);
  const etag = `"sha256-${sha256}"`;
  const verified = ['GET', 'HEAD'].includes(request.method)
    && /^[a-f0-9]{64}$/.test(sha256 ?? '')
    && headers.get('etag') === etag
    && [200, 206, 304].includes(response.status);
  headers.set('Cache-Control', verified ? 'private, no-cache, must-revalidate' : 'private, no-store');
  // A 304 without the expected identity must never revive cached bytes.
  if (response.status === 304 && !verified) {
    headers.delete('Content-Length');
    headers.delete('Content-Range');
    return new Response(null, {status: 503, headers});
  }
  const matches = request.headers.get('if-none-match')?.split(',')
    .some(value => value.trim() === '*' || value.trim().replace(/^W\//, '') === etag);
  if (verified && matches && response.status !== 304) {
    await response.body?.cancel();
    headers.delete('Content-Length');
    headers.delete('Content-Range');
    return new Response(null, {status: 304, headers});
  }
  return new Response(response.body, {status: response.status, headers});
}
