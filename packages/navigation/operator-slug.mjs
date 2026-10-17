const reservedOperatorSlugs = new Set(['api', 'auth', 'login', 'logout', 'studio', 'control', 'partner', 'play', 'set-password']);
export const isOperatorSlug = value => typeof value === 'string' && value.length <= 63
  && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) && !reservedOperatorSlugs.has(value);
