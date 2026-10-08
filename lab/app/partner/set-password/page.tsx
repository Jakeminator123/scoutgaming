import { StudioLogin } from '@/components/studio-login';
import { nativeStudioAdminConfiguration, nativeStudioAdminEnabled } from '@/lib/studio-native-runtime.mjs';
import { studioPasswordToken } from '@/lib/studio-login-client.mjs';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Välj lösenord · Partnerportal',
  referrer: 'no-referrer' as const,
  robots: { index: false, follow: false },
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!nativeStudioAdminEnabled()) notFound();
  const config = nativeStudioAdminConfiguration();
  if (!config) notFound();
  const query = await searchParams;
  const authBase = (config.apiBase === '/studio/api/admin' ? '/studio/api/partner' : '/api/partner') as '/studio/api/partner' | '/api/partner';
  return <StudioLogin authBase={authBase} mode="set-password" token={studioPasswordToken(query.t)} gameOrigin={config.allowedOrigins[0]} />;
}
