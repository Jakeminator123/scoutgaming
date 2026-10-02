import { headers } from 'next/headers';
import { authorizeUiPage } from '@/lib/ui-server';
import { backofficeOrigin } from '@/lib/backoffice-navigation.mjs';
import { BackofficePanel } from '@/components/backoffice-panel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Administration · Backoffice/Lab' };

export default async function Page() {
  const h = await headers();
  await authorizeUiPage(new Request(`http://${h.get('host') || 'invalid'}/administration`, { headers: h }));
  return <BackofficePanel origin={backofficeOrigin()} />;
}
