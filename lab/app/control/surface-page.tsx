import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { KevinBackoffice } from '@/components/kevin-bo/kevin-backoffice';
import { ControlWorkspace } from '@/components/control-workspace';
import { controlToolPath } from '@/lib/control-workspace.mjs';
import { partnerPreviewInitialData } from '@/lib/partner-preview.mjs';
import { nextStudioLoginRedirect } from '@/lib/next-page-navigation.mjs';
import { resolveWorkspaceSurfacePath } from '@/lib/workspace-surfaces.mjs';

export async function WorkspaceSurfacePage({ surface, path = [] }: {
  surface: 'partner' | 'control'; path?: string[];
}) {
  const route = resolveWorkspaceSurfacePath('/' + [surface, ...path].join('/'));
  if (!route || route.surface !== surface) notFound();
  // Next applies the configured /studio basePath to app-relative redirects.
  if (route.legacyPath !== null) redirect(route.legacyPath);
  const h = await headers();
  const request = new Request(`https://${h.get('host') || 'invalid'}${route.studioPath}`, { headers: h });
  let data;
  try {
    data = await partnerPreviewInitialData(request, route.operatorSlug ? { operatorSlug: route.operatorSlug } : {});
  } catch (error) {
    const status = (error as { statusCode?: number })?.statusCode;
    if (status === 401) redirect(nextStudioLoginRedirect(route.publicPath));
    if (status === 404) notFound();
    throw error;
  }
  if (surface === 'control') {
    if (typeof data.session.user !== 'string') throw new Error('control_identity_unavailable');
    const tool = controlToolPath(route.view);
    if (tool) redirect(tool);
    return <ControlWorkspace user={data.session.user} initialView={route.view} />;
  }
  return <KevinBackoffice surface="partner"
    initialSnapshot={data.snapshot} initialView={route.view} apiBase={data.apiBase} user={data.session.user} />;
}
