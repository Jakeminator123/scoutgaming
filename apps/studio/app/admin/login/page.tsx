import { StudioLogin } from '@/components/studio-login';
import { nativeStudioAdminConfiguration, nativeStudioAdminEnabled } from '@/lib/studio-native-runtime.mjs';
import { studioLoginReturnTo } from '@/lib/studio-login-client.mjs';
import { headers } from 'next/headers';
import { nextStudioAuthEntryRedirect } from '@/lib/next-page-navigation.mjs';
import { notFound, redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export const metadata = {title:'Logga in · Scoutgaming Admin',referrer:'no-referrer'};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  if (!nativeStudioAdminEnabled()) notFound();
  const config = nativeStudioAdminConfiguration();
  if (!config) notFound();
  const query = await searchParams;
  const h = await headers();
  const entry = nextStudioAuthEntryRedirect(new Request('https://' + (h.get('host') || 'invalid') + '/admin/login', { headers: h }), config,
    { returnTo: query.returnTo });
  if (entry) redirect(entry);
  return <StudioLogin authBase={config.authBase} gameOrigin={config.allowedOrigins[0]} returnTo={studioLoginReturnTo(query.returnTo)} resetAvailable={Boolean(process.env.RESEND_API_KEY)} />;
}
