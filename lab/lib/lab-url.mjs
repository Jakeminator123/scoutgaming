// Public routing only; never put credentials in this build-time variable.
export function labBasePath() {
  return process.env.NEXT_PUBLIC_LAB_BASE_PATH === '/studio' ? '/studio' : '';
}

export function labUrl(value) {
  const base = labBasePath();
  if (!base || typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')
    || value === base || value.startsWith(`${base}/`)) return value;
  return value === '/' ? base : `${base}${value}`;
}

export function stripLabBasePath(value) {
  const base = labBasePath();
  return base && (value === base || value.startsWith(`${base}/`)) ? value.slice(base.length) || '/' : value;
}
