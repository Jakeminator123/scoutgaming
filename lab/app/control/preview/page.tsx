import { headers } from 'next/headers';
import { ControlPreviewPage } from '@/components/control-preview-page';
import { authorizeUiPage } from '@/lib/ui-server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Förhandsvisning · Croupier Studio' };

export default async function Page() {
  const h = await headers();
  await authorizeUiPage(new Request(`http://${h.get('host') || 'invalid'}/control/preview`, { method: 'GET', headers: h }));
  return <ControlPreviewPage />;
}
