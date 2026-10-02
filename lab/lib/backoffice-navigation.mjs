export const BACKOFFICE_SECTIONS = Object.freeze([
  { id: 'ops', label: 'Driftöversikt' },
  { id: 'voice', label: 'Tal och synkgranskning' },
  { id: 'clips', label: 'Äldre klipp och granskning' },
  { id: 'gens', label: 'Genererat material' },
  { id: 'apikeys', label: 'Partner och API-nycklar' },
  { id: 'emails', label: 'E-postmallar' },
  { id: 'users', label: 'Användare och roller' },
  { id: 'rooms', label: 'Bord och rum' },
  { id: 'dealers', label: 'Dealers' },
  { id: 'pit', label: 'Pit bosses' },
  { id: 'tours', label: 'Turneringar' },
  { id: 'players', label: 'Spelarkonton' },
  { id: 'pay', label: 'Betalningar och journal' },
  { id: 'shoes', label: 'Shoe och spelintegritet' },
]);

// All existing functions remain reachable, but only inside the Backoffice area.
export const BACKOFFICE_GROUPS = Object.freeze([
  { id: 'operations', label: 'Drift & spelintegritet', sections: ['ops', 'shoes'] },
  { id: 'tables', label: 'Bord & personal', sections: ['rooms', 'dealers', 'pit', 'tours'] },
  { id: 'accounts', label: 'Konton', sections: ['players', 'users'] },
  { id: 'partners', label: 'Partner', sections: ['apikeys', 'emails'] },
  { id: 'finance', label: 'Betalningar & journal', sections: ['pay'] },
  { id: 'media-review', label: 'Mediegranskning', sections: ['voice', 'clips', 'gens'] },
].map(group => Object.freeze({ ...group, sections: Object.freeze(group.sections) })));

export function backofficeGroup(value) {
  const section = backofficeSection(value);
  return BACKOFFICE_GROUPS.find(group => group.sections.includes(section));
}

export function backofficeSection(value) {
  const id = typeof value === 'string' ? value.replace(/^#/, '') : '';
  return BACKOFFICE_SECTIONS.some(section => section.id === id) ? id : 'ops';
}

// This is navigation to the existing product server, never a credential proxy.
// Only server-configured origins are exposed; no URL or host comes from a query.
export function backofficeOrigin(env = process.env) {
  const cloud = Boolean(env.LAB_PUBLIC_URL || env.CROUPIER_LAB_INTERNAL_SECRET);
  const value = cloud ? env.BO_URL ?? env.CROUPIER_GAME_ORIGIN ?? env.LAB_PUBLIC_URL
    : env.CROUPIER_GAME_ORIGIN ?? env.BETTALOTTO_PARTNER_BASE_URL;
  try {
    const url = new URL(value);
    if (url.origin !== value || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    if (cloud ? url.protocol !== 'https:' : url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return null;
    return url.origin;
  } catch { return null; }
}

export function backofficeFrameUrl(origin, section) {
  if (!origin) return null;
  const url = new URL('/bo/', origin);
  url.searchParams.set('workspace', 'lab');
  url.hash = backofficeSection(section);
  return url.href;
}
