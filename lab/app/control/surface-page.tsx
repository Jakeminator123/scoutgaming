import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { KevinBackoffice } from '@/components/kevin-bo/kevin-backoffice';
import { ControlWorkspace } from '@/components/control-workspace';
import { PartnerWorkspace } from '@/components/partner-workspace';
import { controlToolPath } from '@/lib/control-workspace.mjs';
import { nativeStudioAdminEnabled, studioNativeRuntime } from '../../lib/studio-native-runtime.mjs';
import { publicAbsoluteUrl } from '@/lib/lab-url.mjs';
import { partnerPreviewInitialData } from '@/lib/partner-preview.mjs';
import { partnerWorkspaceInitialData } from '@/lib/partner-data.mjs';
import { partnerSessionPresent } from '@/lib/partner-session.mjs';
import { nextStudioLoginRedirect } from '@/lib/next-page-navigation.mjs';
import { resolveWorkspaceSurfacePath } from '@/lib/workspace-surfaces.mjs';

function partnerLoginAbsoluteUrl(headerList: { get(name: string): string | null }) {
  const read = (name: string) => {
    const value = headerList.get(name);
    return typeof value === 'string' ? value.split(',')[0].trim() : '';
  };
  const forwarded = read('x-forwarded-proto').toLowerCase();
  const proto = forwarded === 'http' || forwarded === 'https' ? forwarded : 'https';
  const host = read('x-forwarded-host') || read('host');
  const safeHost = /^[A-Za-z0-9.-]+(?::\d{1,5})?$/.test(host) ? host : 'invalid';
  return `${proto}://${safeHost}/partner/login`;
}

type ListedOperator = { id: string; slug: string; name: string };

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
      operators.push({ id: operator.id, slug: operator.slug, name: operator.name });
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

export async function WorkspaceSurfacePage({ surface, path = [] }: {
  surface: 'partner' | 'control'; path?: string[];
}) {
  const route = resolveWorkspaceSurfacePath('/' + [surface, ...path].join('/'));
  if (!route || route.surface !== surface) notFound();
  const h = await headers();
  // Absolute public URL so Next does not prefix the /studio basePath.
  if (route.legacyPath !== null) redirect(publicAbsoluteUrl(h, route.legacyPath));
  const request = new Request(`https://${h.get('host') || 'invalid'}${route.studioPath}`, { headers: h });
  let data;
  if (surface === 'partner' && partnerSessionPresent(request)) {
    try {
      data = await partnerWorkspaceInitialData(request, route.operatorSlug ? { operatorSlug: route.operatorSlug } : {});
    } catch (error) {
      const status = statusOf(error);
      if (status === 401) redirect(partnerLoginAbsoluteUrl(h));
      if (status === 404) notFound();
      throw error;
    }
  } else {
    try {
      data = await partnerPreviewInitialData(request, route.operatorSlug ? { operatorSlug: route.operatorSlug } : {});
    } catch (error) {
      const status = statusOf(error);
      if (status === 401) redirect(surface === 'partner' ? partnerLoginAbsoluteUrl(h) : nextStudioLoginRedirect(route.publicPath));
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
    const companies = await controlOperators(fallback);
    return <ControlWorkspace user={user} initialView={route.view} {...companies} />;
  }
  if (route.operatorSlug === null) {
    return <PartnerWorkspace user={user}
      {...(data.snapshot.preview === false ? { preview: false as const } : {})}
      demonstrations={data.snapshot.operators.map(({ slug, name }: { slug: string; name: string }) => ({ slug, name }))} />;
  }
  return <KevinBackoffice surface="partner"
    initialSnapshot={data.snapshot} initialView={route.view} apiBase={data.apiBase} user={user} />;
}
