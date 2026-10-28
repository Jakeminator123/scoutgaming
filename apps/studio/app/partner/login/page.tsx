import { PartnerLogin } from '@/components/partner-login';
import { nativeStudioAdminConfiguration, nativeStudioAdminEnabled } from '@/lib/studio-native-runtime.mjs';
import { notFound } from 'next/navigation';
import { partnerLoginReturnTo } from '@/lib/partner-login-return.mjs';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Logga in · Partnerportalen',
  referrer: 'no-referrer' as const,
  robots: { index: false, follow: false },
};

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  if (!nativeStudioAdminEnabled()) notFound();
  const config = nativeStudioAdminConfiguration();
  if (!config) notFound();
  const authBase = (config.apiBase === '/studio/api/admin' ? '/studio/api/partner' : '/api/partner') as '/studio/api/partner' | '/api/partner';
  const query = searchParams ? await searchParams : {};
  return <PartnerLogin authBase={authBase} returnTo={partnerLoginReturnTo(query.returnTo)} />;
}
