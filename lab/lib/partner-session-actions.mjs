import { createStudioLoginClient, StudioLoginUiError } from './studio-login-client.mjs';
import { resolveWorkspaceSurfacePath } from '../../packages/navigation/workspace-surfaces.mjs';

function sessionRoute(apiBase, accessClass) {
  if (!['/studio/api/partner/snapshot', '/api/partner/snapshot'].includes(apiBase)
    || !['internal-admin', 'partner'].includes(accessClass)) throw new StudioLoginUiError(400);
  const prefix = apiBase.startsWith('/studio/') ? '/studio' : '';
  return { partnerBase: `${prefix}/api/partner`, authBase: `${prefix}/api/auth`,
    login: accessClass === 'internal-admin' ? `${prefix}/login` : '/partner/login' };
}

export function partnerSessionDestination({ apiBase, accessClass, action, returnTo }) {
  const { login } = sessionRoute(apiBase, accessClass);
  if (!['switch', 'logout'].includes(action)) throw new StudioLoginUiError(400);
  const target = resolveWorkspaceSurfacePath(returnTo);
  return action === 'switch' && target?.surface === 'partner'
    ? `${login}?returnTo=${encodeURIComponent(target.canonicalPath)}` : login;
}

// The server-supplied identity decides which principal ends. Never infer identity
// from cookies, and never navigate after only a partially completed logout.
export async function endPartnerSession({ apiBase, accessClass, action, returnTo, fetchImpl = fetch }) {
  const destination = partnerSessionDestination({ apiBase, accessClass, action, returnTo });
  const { partnerBase, authBase } = sessionRoute(apiBase, accessClass);
  if (accessClass === 'internal-admin') {
    try {
      await createStudioLoginClient({ authBase: partnerBase, fetchImpl }).request('logout', {});
    } catch (error) {
      // Existing partner logout expires its cookie even when no valid partner
      // session exists. This exception applies only to the secondary principal.
      if (!(error instanceof StudioLoginUiError) || error.status !== 401) throw error;
    }
    await createStudioLoginClient({ authBase, fetchImpl }).request('logout', {});
  } else {
    await createStudioLoginClient({ authBase: partnerBase, fetchImpl }).request('logout', {});
  }
  return destination;
}
