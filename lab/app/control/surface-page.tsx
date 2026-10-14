import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { KevinBackoffice } from '@/components/kevin-bo/kevin-backoffice';
import { ControlWorkspace } from '@/components/control-workspace';
import { PartnerWorkspace } from '@/components/partner-workspace';
import { controlStudioSummary } from '../../lib/control-overview.mjs';

import { controlToolPath } from '@/lib/control-workspace.mjs';
import { nativeStudioAdminEnabled, studioNativeRuntime } from '../../lib/studio-native-runtime.mjs';
import { publicAbsoluteUrl } from '@/lib/lab-url.mjs';
import { partnerPreviewInitialData } from '@/lib/partner-preview.mjs';
import { partnerWorkspaceInitialData } from '@/lib/partner-data.mjs';
import { internalSessionPresent } from '@/lib/partner-session.mjs';
import { partnerLoginReturnTo } from '@/lib/partner-login-return.mjs';
import { nextStudioLoginRedirect } from '@/lib/next-page-navigation.mjs';
import { resolveWorkspaceSurfacePath } from '@/lib/workspace-surfaces.mjs';

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

type ListedOperator = { id: string; slug: string; name: string; publishedPackage?: { revision: number; lanes: string[] } | null };

async function controlSavedStudio() {
  if (!nativeStudioAdminEnabled()) return null;
  try {
    const native = await studioNativeRuntime();
    const { project } = await native.gamePolicy.readSaved();
    return controlStudioSummary(project);
  } catch { return null; }
}

// Demonstrations are explicit. A failed live read must never look like connected companies.
async function controlOperators(fallback: ListedOperator[]) {
  if (!nativeStudioAdminEnabled()) return { operators: fallback, operatorStatus: 'demo' as const };
  try {
    const native = await studioNativeRuntime();
    if (typeof native.listLaneOperators !== 'function') throw new Error('operator_list_unavailable');
    const listed = await native.listLaneOperators();
    if (!Array.isArray(listed)) throw new Error('operator_list_unavailable');
    const operators: ListedOperator[] = [];
    for (const operator of listed) {
      if (!operator || typeof operator.id !== 'string' || typeof operator.slug !== 'string' || typeof operator.name !== 'string') throw new Error('operator_list_unavailable');
      operators.push({ id: operator.id, slug: operator.slug, name: operator.name, ...(operator.publishedPackage === undefined ? {} : { publishedPackage: operator.publishedPackage }) });
    }
    return { operators, operatorStatus: 'live' as const };
  } catch {
    return { operators: [], operatorStatus: 'unavailable' as const };
  }
}

function statusOf(error: unknown) {
  return typeof error === 'object' && error !== null && 'statusCode' in error
    ? Number((error as { statusCode?: number }).statusCode) : undefined;
}

export async function WorkspaceSurfacePage({ surface, path = [], initialRoomId }: {
  surface: 'partner' | 'control'; path?: string[]; initialRoomId?:string|string[];
}) {
  const route = resolveWorkspaceSurfacePath('/' + [surface, ...path].join('/'));
  if (!route || route.surface !== surface) notFound();
  let returnPath = route.publicPath;
  if (surface === 'partner' && route.view === 'bj' && initialRoomId !== undefined) {
    returnPath = typeof initialRoomId === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(initialRoomId)
      ? `${route.publicPath}?room=${initialRoomId}` : '/admin';
  }
  const h = await headers();
  // Absolute public URL so Next does not prefix the /studio basePath.
  if (route.legacyPath !== null) redirect(publicAbsoluteUrl(h, route.legacyPath));
  const request = new Request(`https://${h.get('host') || 'invalid'}${route.studioPath}`, { headers: h });
  let data;
  if (surface === 'partner') {
    try {
      data = await partnerWorkspaceInitialData(request, route.operatorSlug ? { operatorSlug: route.operatorSlug } : {});
    } catch (error) {
      const status = statusOf(error);
      // Match the backend's fail-closed N1 priority, including stale N1 cookies.
      // A partner login cannot repair an expired administrator credential.
      if (status === 401) redirect(internalSessionPresent(request)
        ? nextStudioLoginRedirect(returnPath) : partnerLoginAbsoluteUrl(h, returnPath));
      if (status === 404) notFound();
      throw error;
    }
  } else {
    try {
      data = await partnerPreviewInitialData(request, route.operatorSlug ? { operatorSlug: route.operatorSlug } : {});
    } catch (error) {
      const status = statusOf(error);
      if (status === 401) redirect(nextStudioLoginRedirect(route.publicPath));
      if (status === 404) notFound();
      throw error;
    }
  }
  const user = data.session.user;
  if (typeof user !== 'string' || !user) throw new Error('workspace_identity_unavailable');
  if (surface === 'control') {
    const tool = controlToolPath(route.view);
    if (tool) redirect(publicAbsoluteUrl(h, tool));
    // A missing fixture list is empty; live errors receive their own visible state.
    const fallback = (Array.isArray(data.snapshot.operators) ? data.snapshot.operators : [])
      .map(({ id, slug, name }: ListedOperator) => ({ id, slug, name }));
    const [companies, studio] = await Promise.all([controlOperators(fallback), controlSavedStudio()]);
    return <ControlWorkspace user={user} initialView={route.view} {...(studio ? { studio } : {})} {...companies} />;
  }
  if (route.operatorSlug === null) {
    return <PartnerWorkspace user={user} apiBase={data.apiBase}
      accessClass={data.session.accessClass === 'internal-admin' ? 'internal-admin' : 'partner'}
      operators={data.snapshot.operators.map(({ slug, name }: { slug: string; name: string }) => ({ slug, name }))} />;
  }
  return <KevinBackoffice surface="partner"
    initialSnapshot={data.snapshot} initialView={route.view} {...(initialRoomId===undefined?{}:{initialRoomId})} apiBase={data.apiBase} user={user} />;
}
