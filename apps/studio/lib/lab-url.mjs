import {adminDocumentHref} from '../../../packages/navigation/admin-workspace-routes.mjs';
// Public routing only; never put credentials in these build-time variables.
export function labBasePath() {
  return process.env.NEXT_PUBLIC_LAB_BASE_PATH === '/studio' ? '/studio' : '';
}

function publicProductPath(value) {
  const path = value.split(/[?#]/, 1)[0];
  return ['/admin', '/lobby', '/control', '/partner', '/play'].some(root => path === root || path.startsWith(`${root}/`));
}

export function labUrl(value) {
  if(process.env.NEXT_PUBLIC_ADMIN_WORKSPACE==='1')value=adminDocumentHref(value);
  const base = labBasePath();
  if (!base || typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')
    || value === base || value.startsWith(`${base}/`) || publicProductPath(value)) return value;
  return value === '/' ? base : `${base}${value}`;
}

// Absolute public URL so Next redirect() does not prefix the /studio basePath.
export function publicAbsoluteUrl(headerList, pathname) {
  if (typeof pathname !== 'string' || (pathname !== '/admin' && !/^\/admin\/(?:publication|companies|guide|videos|probe|replies)(?:[?#]|$)/.test(pathname) && !pathname.startsWith('/control')) || pathname.includes('//') || /[\s\\]/.test(pathname)) {
    throw new Error('control_redirect_rejected');
  }
  const read = name => {
    const value = headerList && typeof headerList.get === 'function' ? headerList.get(name) : '';
    return typeof value === 'string' ? value.split(',')[0].trim() : '';
  };
  const forwarded = read('x-forwarded-proto').toLowerCase();
  const proto = forwarded === 'http' || forwarded === 'https' ? forwarded : 'https';
  const host = read('x-forwarded-host') || read('host');
  const safeHost = /^[A-Za-z0-9.-]+(?::\d{1,5})?$/.test(host) ? host : 'invalid';
  return `${proto}://${safeHost}${pathname}`;
}

export function stripLabBasePath(value) {
  const base = labBasePath();
  return base && (value === base || value.startsWith(`${base}/`)) ? value.slice(base.length) || '/' : value;
}
