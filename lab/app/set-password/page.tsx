import { StudioLogin } from '@/components/studio-login';
import { nativeStudioAdminConfiguration, nativeStudioAdminEnabled } from '@/lib/studio-native-runtime.mjs';
import { studioPasswordToken } from '@/lib/studio-login-client.mjs';
import { notFound } from 'next/navigation';
export const dynamic = 'force-dynamic';
export const metadata = {title:'Välj lösenord · Croupier Studio',referrer:'no-referrer'};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  if (!nativeStudioAdminEnabled()) notFound();
  const config = nativeStudioAdminConfiguration();
  if (!config) notFound();
  const query = await searchParams;
  return <StudioLogin authBase={config.authBase} mode="set-password" token={studioPasswordToken(query.t)} gameOrigin={config.allowedOrigins[0]} />;
}
