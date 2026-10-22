import { adminDocumentHref } from './admin-workspace-routes.mjs';

// Public document names. Stored IDs and API contracts keep their compatibility.
export function compositionLabel(value, language = 'sv') {
  const label = typeof value === 'string' ? value.trim() : '';
  return label === 'Mobile Phone Lane' ? (language === 'en' ? 'Standard composition' : 'Standardsammansättning')
    : label === 'Layer Preview Lane' ? (language === 'en' ? 'Layer composition' : 'Lagersammansättning') : label || (language === 'en' ? 'Unnamed composition' : 'Namnlös sammansättning');
}

export function canonicalControlHref(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) throw new TypeError('Local document path required');
  const pathname = value.split(/[?#]/, 1)[0];
  if (/(?:^|\/)\.\.?(?:\/|$)|%2e|%2f|%5c|\/\//i.test(pathname)) throw new TypeError('Unambiguous local path required');
  const url = new URL(value, 'https://studio.invalid');
  url.pathname = url.pathname.replace(/^\/studio(?=\/control(?:\/|$))/, '');
  if (url.pathname === '/control/lanes') {
    url.pathname = url.searchParams.get('tab') === 'companies' ? '/control/companies' : '/control/rooms';
    url.searchParams.delete('tab');
  }
  if (url.pathname === '/control/preview') url.pathname = '/control/compositions';
  if (url.pathname === '/control/activity') url.pathname = '/control/rehearsal';
  if (url.pathname === '/control/dealer-forge') {
    url.pathname = '/control/clips';
    url.searchParams.set('view', 'generate');
    if (!url.searchParams.has('dealer') && url.searchParams.get('dealerId')) url.searchParams.set('dealer', url.searchParams.get('dealerId'));
    url.searchParams.delete('dealerId');
  }
  if (url.pathname.startsWith('/control/')) {
    if (!url.searchParams.has('composition') && url.searchParams.get('lane')) url.searchParams.set('composition', url.searchParams.get('lane'));
    url.searchParams.delete('lane');
    for (const key of ['operator','composition','dealer','table']) if (url.searchParams.get(key) === '') url.searchParams.delete(key);
  }
  // Retired editors and tools now have only their Admin documents.
  if (url.pathname === '/control/clips') {
    url.pathname = '/admin/dealer-studio';
    if (!url.searchParams.has('dealer') && url.searchParams.has('dealerId')) url.searchParams.set('dealer', url.searchParams.get('dealerId'));
    url.searchParams.delete('dealerId');
  }
  if (url.pathname === '/control/rooms') url.pathname = '/admin/rooms';
  if (url.pathname === '/control/companies') url.pathname = '/admin/companies';
  if (url.pathname === '/control/guide') url.pathname = '/admin/guide';
  if (url.pathname === '/control/videos') url.pathname = '/admin/videos';
  if (url.pathname === '/control/compositions') url.pathname = '/admin/compositions';
  if (url.pathname === '/control/rehearsal') url.pathname = '/admin/rehearsal';
  // OpenClaw is one Admin page; Control's chat, ops and operator chat open its tabs.
  const openClawTab = url.pathname === '/control/openclaw' ? (url.searchParams.get('tab') === 'chat' ? 'agent' : 'models')
    : url.pathname === '/control/ops' ? 'drift' : url.pathname === '/control/operator-chat' ? 'agent' : null;
  if (openClawTab) {
    url.pathname = '/admin/openclaw';
    url.searchParams.delete('tab');
    url.search = 'tab=' + openClawTab + (url.search ? '&' + url.search.slice(1) : '');
  }
  const href = url.pathname + url.search + url.hash;
  return url.pathname === '/control/administration' ? adminDocumentHref(href) : href;
}

// Activity bookmarks accept only one value for each observation identity.
export function legacyActivityDocumentHref(value) {
  const url = new URL(value, 'https://studio.invalid');
  const query = new URLSearchParams();
  for (const key of ['dealer','operator','table','room','game','composition']) {
    const values = url.searchParams.getAll(key);
    if (values.length === 1 && values[0]) query.set(key, values[0]);
  }
  const lanes = url.searchParams.getAll('lane');
  if (!query.has('composition') && lanes.length === 1 && lanes[0]) query.set('composition', lanes[0]);
  return '/admin/rehearsal' + (query.size ? '?' + query : '') + url.hash;
}
