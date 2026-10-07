import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { KevinBackoffice } from '@/components/kevin-bo/kevin-backoffice';
import { ControlWorkspace } from '@/components/control-workspace';
import { PartnerWorkspace } from '@/components/partner-workspace';
import { controlToolPath } from '@/lib/control-workspace.mjs';
import { publicAbsoluteUrl } from '@/lib/lab-url.mjs';
import { partnerPreviewInitialData } from '@/lib/partner-preview.mjs';
import { nextStudioLoginRedirect } from '@/lib/next-page-navigation.mjs';
import { resolveWorkspaceSurfacePath } from '@/lib/workspace-surfaces.mjs';

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
  try {
    data = await partnerPreviewInitialData(request, route.operatorSlug ? { operatorSlug: route.operatorSlug } : {});
  } catch (error) {
    const status = (error as { statusCode?: number })?.statusCode;
    if (status === 401) redirect(nextStudioLoginRedirect(route.publicPath));
    if (status === 404) notFound();
    throw error;
  }
  const user = data.session.user;
  if (typeof user !== 'string' || !user) throw new Error('workspace_identity_unavailable');
  if (surface === 'control') {
    const tool = controlToolPath(route.view);
    if (tool) redirect(publicAbsoluteUrl(h, tool));
    return <ControlWorkspace user={user} initialView={route.view} />;
  }
  if (route.operatorSlug === null) {
    return <PartnerWorkspace user={user}
      demonstrations={data.snapshot.operators.map(({ slug, name }: { slug: string; name: string }) => ({ slug, name }))} />;
  }
  return <KevinBackoffice surface="partner"
    initialSnapshot={data.snapshot} initialView={route.view} apiBase={data.apiBase} user={user} />;
}
