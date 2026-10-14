import { resolveWorkspaceSurfacePath } from './workspace-surfaces.mjs';

// Navigation only: the destination still authorizes the current session,
// operator and room. Accept one decoded local document path, never another URL.
export function partnerLoginReturnTo(value) {
  if (typeof value !== 'string' || value.length > 250 || /[%#\\\x00-\x20\x7f-\x9f]/.test(value)) return '/partner';
  const parts = value.split('?');
  const route = resolveWorkspaceSurfacePath(parts[0]);
  if (parts.length > 2 || route?.surface !== 'partner') return '/partner';
  if (parts.length === 1) return route.canonicalPath;
  if (!route.operatorSlug || route.view !== 'bj' || !/^room=[a-z][a-z0-9-]{0,63}$/.test(parts[1])) return '/partner';
  return `${route.canonicalPath}?${parts[1]}`;
}
