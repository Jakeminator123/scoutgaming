import { headers } from 'next/headers';
import { ControlPreviewPage } from '@/components/control-preview-page';
import { studioUiInitialData } from '@/lib/ui-server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Förhandsvisning · Croupier Studio' };

export default async function Page() {
  const h = await headers();
  const data=await studioUiInitialData(new Request(`http://${h.get('host') || 'invalid'}/control/preview`, { method: 'GET', headers: h }));
  return <ControlPreviewPage initialProject={data!.project} initialVideos={data!.videos} initialStatus={data!.status} />;
}
