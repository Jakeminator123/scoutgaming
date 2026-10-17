import { headers } from 'next/headers';
import { NativeAdministration } from '@/components/native-administration';
import { nativeStudioAdminConfiguration, assertNativeStudioRequest, studioNativeRuntime } from '@/lib/studio-native-runtime.mjs';
import { normalizeNativeStudioPageRequest } from '@/lib/studio-native-request.mjs';
import { redirect } from 'next/navigation';
import { firstQueryValue } from '@/components/studio-types';
import { redirectToPublicControl } from '../public-redirect';
import { nextStudioLoginRedirect } from '@/lib/next-page-navigation.mjs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Administration · Croupier Studio' };

export default async function Page(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const h = await headers();
  const config = nativeStudioAdminConfiguration();
  const request = normalizeNativeStudioPageRequest(new Request(`https://${h.get('host') || 'invalid'}/studio/administration`, { headers: h }), config);
  assertNativeStudioRequest(request, config);
  const native = await studioNativeRuntime();
  let session;
  try { session = await native.authorize(request); }
  catch (error) {
    if ((error as {statusCode?:number})?.statusCode === 401) redirect(nextStudioLoginRedirect('/studio/administration'));
    throw error;
  }
  const query = props?.searchParams ? await props.searchParams : {};
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  if (tab === 'tables') {
    const context = new URLSearchParams();
    for (const key of ['operator', 'composition', 'dealer', 'table']) {const value = firstQueryValue(query[key]);if (value) context.set(key, value);}
    if (!context.has('composition') && firstQueryValue(query.lane)) context.set('composition', firstQueryValue(query.lane)!);
    return redirectToPublicControl('/control/rooms' + (context.size ? '?' + context : ''));
  }
  return <NativeAdministration apiBase={native.config.apiBase} gameOrigin={native.config.allowedOrigins[0]} availableActions={native.api.availableActions(session)} initialGroup={tab} initialDealerId={Array.isArray(query.dealer) ? query.dealer[0] : query.dealer} />;
}
