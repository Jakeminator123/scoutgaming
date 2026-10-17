// Shared transport configuration must not import UI or browser-only modules.
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
export function exactPlatformOrigin(value, name) {
  let url;
  try { url = new URL(value); } catch { throw Error(`${name} must be an exact HTTPS origin.`); }
  if (url.protocol !== 'https:' || value !== url.origin || url.username || url.password || LOOPBACK.has(url.hostname)) {
    throw Error(`${name} must be an exact HTTPS origin.`);
  }
  return url.origin;
}

export function platformConfiguration(env = process.env) {
  if (env.CROUPIER_VERCEL_UI !== '1') return null;
  const publicOrigin = exactPlatformOrigin(env.CROUPIER_PUBLIC_ORIGIN, 'CROUPIER_PUBLIC_ORIGIN');
  const backendOrigin = exactPlatformOrigin(env.CROUPIER_BACKEND_ORIGIN, 'CROUPIER_BACKEND_ORIGIN');
  const unifiedUi = env.CROUPIER_VERCEL_UNIFIED_UI === '1';
  const labUiOrigin = unifiedUi ? publicOrigin : exactPlatformOrigin(env.CROUPIER_LAB_UI_ORIGIN, 'CROUPIER_LAB_UI_ORIGIN');
  const secret = env.CROUPIER_VERCEL_INGRESS_SECRET;
  if (new Set(unifiedUi ? [publicOrigin, backendOrigin] : [publicOrigin, backendOrigin, labUiOrigin]).size !== (unifiedUi ? 2 : 3)) throw Error('Public UI, backend transport and Lab UI origins must be distinct.');
  if (unifiedUi && env.CROUPIER_STUDIO_NATIVE_ADMIN !== '1') throw Error('Unified UI requires native Studio administration.');
  if (typeof secret !== 'string' || secret.length < 32 || /[\r\n]/.test(secret)) throw Error('A private ingress secret of at least 32 bytes is required.');
  return { publicOrigin, backendOrigin, labUiOrigin, secret,
    ...(unifiedUi ? { unifiedUi: true } : {}),
    ...(env.CROUPIER_STUDIO_NATIVE_ADMIN === '1' ? { nativeStudio: true } : {}),
    ...(env.CROUPIER_STUDIO_NEON_POLICY === '1' ? { canonicalGame: true } : {}) };
}
