import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { KevinBackoffice } from '@/components/kevin-bo/kevin-backoffice';
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
  return <KevinBackoffice surface={surface === 'control' ? 'internal' : 'partner'}
    initialSnapshot={data.snapshot} initialView={route.view} apiBase={data.apiBase} user={data.session.user} />;
}
