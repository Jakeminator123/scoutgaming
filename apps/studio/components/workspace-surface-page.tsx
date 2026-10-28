import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { PartnerOperatorWorkspace } from '@/components/kevin-bo/partner-operator-workspace';
import { PartnerWorkspace } from '@/components/partner-workspace';

import { publicAbsoluteUrl } from '@/lib/lab-url.mjs';
import { partnerWorkspaceInitialData } from '@/lib/partner-data.mjs';
import { internalSessionPresent } from '@/lib/partner-session.mjs';
import { partnerLoginReturnTo } from '@/lib/partner-login-return.mjs';
import { nextStudioLoginRedirect } from '@/lib/next-page-navigation.mjs';
import { resolveWorkspaceSurfacePath } from '../../../packages/navigation/workspace-surfaces.mjs';

function partnerLoginAbsoluteUrl(headerList: { get(name: string): string | null }, returnTo: string) {
  const read = (name: string) => {
    const value = headerList.get(name);
    return typeof value === 'string' ? value.split(',')[0].trim() : '';
  };
  const forwarded = read('x-forwarded-proto').toLowerCase();
  const proto = forwarded === 'http' || forwarded === 'https' ? forwarded : 'https';
  const host = read('x-forwarded-host') || read('host');
  const safeHost = /^[A-Za-z0-9.-]+(?::\d{1,5})?$/.test(host) ? host : 'invalid';
  return `${proto}://${safeHost}/partner/login?returnTo=${encodeURIComponent(partnerLoginReturnTo(returnTo))}`;
}

function statusOf(error: unknown) {
  return typeof error === 'object' && error !== null && 'statusCode' in error
    ? Number((error as { statusCode?: number }).statusCode) : undefined;
}

export async function WorkspaceSurfacePage({ surface, path = [], initialRoomId, initialRoomScope }: {
  surface: 'partner'; path?: string[]; initialRoomId?:string|string[]; initialRoomScope?:string|string[];
}) {
  const route = resolveWorkspaceSurfacePath('/' + [surface, ...path].join('/'));
  if (!route || route.surface !== 'partner') notFound();
  const selector = initialRoomScope === undefined && typeof initialRoomId === 'string' ? 'room=' + initialRoomId
    : initialRoomId === undefined && initialRoomScope === 'company' ? 'scope=company' : null;
  // Kevins gamla adresser (/tables, /presentation, /transactions …) omdirigeras
  // till den nya vyns adress innan något läses; bara ett giltigt rumsval följer med.
  if (route.operatorSlug && route.canonicalPath && route.canonicalPath !== route.publicPath) {
    const safe = selector === null ? route.canonicalPath : partnerLoginReturnTo(route.canonicalPath + '?' + selector);
    redirect(safe === '/partner' ? route.canonicalPath : safe);
  }
  let returnPath = route.publicPath;
  if (route.operatorSlug && (initialRoomId !== undefined || initialRoomScope !== undefined)) {
    const safe = selector === null ? '/partner' : partnerLoginReturnTo(route.publicPath + '?' + selector);
    returnPath = safe === '/partner' ? '/admin' : safe;
  }
  const h = await headers();
  const request = new Request(`https://${h.get('host') || 'invalid'}${route.studioPath}`, { headers: h });
  let data;
  try {
    data = await partnerWorkspaceInitialData(request, route.operatorSlug ? { operatorSlug: route.operatorSlug, view: route.view } : {});
  } catch (error) {
    const status = statusOf(error);
    // Match the backend's fail-closed N1 priority, including stale N1 cookies.
    // A partner login cannot repair an expired administrator credential.
    if (status === 401) redirect(internalSessionPresent(request)
      ? nextStudioLoginRedirect(returnPath, new URL(publicAbsoluteUrl(h, '/admin')).origin) : partnerLoginAbsoluteUrl(h, returnPath));
    if (status === 404) notFound();
    throw error;
  }
  const user = data.session.user;
  if (typeof user !== 'string' || !user) throw new Error('workspace_identity_unavailable');
  if (route.operatorSlug === null) {
    return <PartnerWorkspace user={user} apiBase={data.apiBase}
      accessClass={data.session.accessClass === 'internal-admin' ? 'internal-admin' : 'partner'}
      operators={data.snapshot.operators.map(({ slug, name }: { slug: string; name: string }) => ({ slug, name }))} />;
  }
  return <PartnerOperatorWorkspace surface="partner"
    initialSnapshot={data.snapshot} initialView={route.view} {...(data.denied ? { denied: data.denied } : {})}
    {...(initialRoomId===undefined?{}:{initialRoomId})} {...(initialRoomScope===undefined?{}:{initialRoomScope})} apiBase={data.apiBase} user={user} />;
}
