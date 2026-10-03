import { StudioLogin } from '@/components/studio-login';
import { nativeStudioAdminConfiguration, nativeStudioAdminEnabled } from '@/lib/studio-native-runtime.mjs';
import { studioLoginReturnTo } from '@/lib/studio-login-client.mjs';
import { notFound } from 'next/navigation';
export const dynamic = 'force-dynamic';
export const metadata = {title:'Logga in · Croupier Studio',referrer:'no-referrer'};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  if (!nativeStudioAdminEnabled()) notFound();
  const config = nativeStudioAdminConfiguration();
  if (!config) notFound();
  const query = await searchParams;
  return <StudioLogin authBase={config.authBase} returnTo={studioLoginReturnTo(query.returnTo)} resetAvailable={Boolean(process.env.RESEND_API_KEY)} />;
}
