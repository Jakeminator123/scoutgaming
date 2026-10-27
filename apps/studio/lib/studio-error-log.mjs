// One server-side line per opaque Studio failure so Vercel logs show the failing
// layer. Fixed fields only: never request bodies, headers, cookies or query
// strings; network URLs (connection strings), emails and key=value secrets are redacted.
const redact = value => String(value ?? '').replace(/\b(?!file:|webpack-internal:)[a-z][a-z0-9+.-]*:\/\/[^\s)'"]+/gi, '[url]')
  .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]').replace(/\b(password|passwd|pwd|token|secret|key|apikey|authorization)=\S+/gi, '$1=[redacted]').slice(0, 300);
const frames = error => typeof error?.stack === 'string'
  ? error.stack.split('\n').filter(line => /^\s+at /.test(line)).slice(0, 8).map(line => redact(line.trim())) : [];
const describe = error => ({ code: typeof error?.code === 'string' || Number.isFinite(error?.code) ? error.code : null,
  name: typeof error?.name === 'string' ? error.name.slice(0, 100) : null, message: redact(error?.message) });

// context is trusted caller metadata: {method, route} (a pathname or admin action key).
export function logStudioServerFailure(error, { method, route } = {}) {
  const cause = error?.cause instanceof Error ? { ...describe(error.cause), stack: frames(error.cause) } : null;
  console.error(JSON.stringify({ studioNativeError: true, ...describe(error),
    route: typeof route === 'string' ? redact(route).slice(0, 200) : null,
    method: typeof method === 'string' ? method.slice(0, 16) : null, stack: frames(error), cause }));
}
