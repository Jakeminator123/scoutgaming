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
  if (url.pathname === '/control/rooms') url.pathname = '/admin/publication';
  if (url.pathname === '/control/companies') url.pathname = '/admin/companies';
  if (url.pathname === '/control/guide') url.pathname = '/admin/guide';
  if (url.pathname === '/control/videos') url.pathname = '/admin/videos';
  return url.pathname + url.search + url.hash;
}
