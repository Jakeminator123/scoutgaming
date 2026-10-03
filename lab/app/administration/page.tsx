import { headers } from 'next/headers';
import { authorizeUiPage } from '@/lib/ui-server';
import { backofficeOrigin } from '@/lib/backoffice-navigation.mjs';
import { BackofficePanel } from '@/components/backoffice-panel';
import { NativeAdministration } from '@/components/native-administration';
import { nativeStudioAdminEnabled, nativeStudioAdminConfiguration, assertNativeStudioRequest, studioNativeRuntime } from '@/lib/studio-native-runtime.mjs';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Backoffice · Croupier Studio' };

export default async function Page() {
  const h = await headers();
  if (nativeStudioAdminEnabled()) {
    const config = nativeStudioAdminConfiguration();
    const request = new Request(`https://${h.get('host') || 'invalid'}/studio/administration`, { headers: h });
    assertNativeStudioRequest(request, config);
    const native = await studioNativeRuntime();
    let session;
    try { session = await native.authorize(request); }
    catch (error) {
      if ((error as {statusCode?:number})?.statusCode === 401) redirect('/studio/login?returnTo=%2Fstudio%2Fadministration');
      throw error;
    }
    return <NativeAdministration apiBase={native.config.apiBase} gameOrigin={native.config.allowedOrigins[0]} availableActions={native.api.availableActions(session)} />;
  }
  await authorizeUiPage(new Request(`http://${h.get('host') || 'invalid'}/administration`, { headers: h }));
  return <BackofficePanel origin={backofficeOrigin()} />;
}
