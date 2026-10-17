export function effectiveAccountRole(role) {
  if (role === 'admin' || role === 'superadmin') return 'admin';
  if (['reader', 'staff', 'player'].includes(role)) return 'player';
  return null;
}
export const isAdministratorRole = role => effectiveAccountRole(role) === 'admin';
