export const designPreviewPages = new Set(['', 'structure', 'rooms', 'dealers', 'clips', 'assets', 'drift', 'ekonomi',
  'admin/accounts', 'admin/operators', 'admin/players', 'admin/payments', 'admin/api', 'admin/log', 'ai/models', 'ai/chat']);
export function designPreviewReturnTo(value) {
  if (typeof value !== 'string') return null;
  const path = value.startsWith('/studio/') ? value.slice(7) : value;
  if (path === '/admin' || path === '/admin/lobby') return path;
  return path.startsWith('/admin/') && designPreviewPages.has(path.slice(7)) ? path : null;
}
