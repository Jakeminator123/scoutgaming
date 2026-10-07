import { PartnerLogin } from '@/components/partner-login';
import { nativeStudioAdminConfiguration, nativeStudioAdminEnabled } from '@/lib/studio-native-runtime.mjs';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Logga in · Partnerportal',
  referrer: 'no-referrer' as const,
  robots: { index: false, follow: false },
};

export default function Page() {
  if (!nativeStudioAdminEnabled()) notFound();
  const config = nativeStudioAdminConfiguration();
  if (!config) notFound();
  const authBase = (config.apiBase === '/studio/api/admin' ? '/studio/api/partner' : '/api/partner') as '/studio/api/partner' | '/api/partner';
  return <PartnerLogin authBase={authBase} />;
}
