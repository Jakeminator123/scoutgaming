import { headers } from 'next/headers';
import { LabStudio } from '@/components/lab-studio';
import { studioUiInitialData } from '@/lib/ui-server';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Studio · Backoffice/Lab' };
export default async function Page() {
  const h = await headers();
  const data = await studioUiInitialData(new Request(`http://${h.get('host') || 'invalid'}/`, { headers: h }));
  return <LabStudio initialProject={data.project} initialVideos={data.videos} connectedLane={process.env.CROUPIER_STREAM_LANE === 'lissabon-stream-lane'} />;
}
