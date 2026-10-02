export function canOpenLab(role) { return role === 'admin' || role === 'superadmin'; }

const localLabPorts = new Map([['4200', '4201'], ['4194', '4192']]);
const loopback = hostname => ['127.0.0.1', 'localhost', '[::1]'].includes(hostname);

export function workspaceUrl(location) {
  const url = new URL(location);
  if (url.username || url.password) return null;
  if (url.protocol === 'http:' && loopback(url.hostname)) {
    // Both launchers reserve one product/Lab pair through the shared guard.
    // Keep the hostname so the iframe and BO cookies remain on the same site.
    const labPort = localLabPorts.get(url.port);
    if (!labPort) return null;
    url.port = labPort; url.pathname = '/';
  } else if (url.protocol === 'https:') url.pathname = '/studio';
  else return null;
  url.search = ''; url.hash = ''; return url.href;
}

export function isEmbeddedWorkspace(location, parentLocation, framed) {
  if (!framed) return false;
  try {
    const child = new URL(location);
    const parent = new URL(parentLocation);
    if (child.username || child.password || parent.username || parent.password) return false;
    const sameOrigin = parent.origin === child.origin;
    const localPair = child.protocol === 'http:' && parent.protocol === 'http:'
      && loopback(child.hostname) && child.hostname === parent.hostname
      && parent.port === localLabPorts.get(child.port);
    // Referrer-Policy may reduce a cross-origin referrer to the origin.
    return (sameOrigin || localPair) && (child.searchParams.get('workspace') === 'lab'
      || parent.pathname === '/administration' || parent.pathname === '/studio/administration' || localPair);
  } catch { return false; }
}
