import { headers } from 'next/headers';
import { LabStudio } from '@/components/lab-studio';
import { studioInitialData } from '@/lib/studio-server.mjs';
import { assertLocalPageRequest } from '@/lib/http-guard.mjs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Studio · Backoffice/Lab' };
export default async function Page() {
  const h = await headers();
  assertLocalPageRequest(new Request(`http://${h.get('host') || 'invalid'}/`, { headers: h }));
  const data = await studioInitialData();
  return <LabStudio initialProject={data.project} initialVideos={data.videos} connectedLane={process.env.CROUPIER_STREAM_LANE === 'lissabon-stream-lane'} />;
}
