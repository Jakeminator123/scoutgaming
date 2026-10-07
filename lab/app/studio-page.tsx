import { headers } from 'next/headers';
import { Studio } from '@/components/studio';
import { viewPaths, type StudioView } from '@/components/studio-types';
import { studioUiInitialData } from '@/lib/ui-server';

export async function loadControlStudio(path: string) {
  const h = await headers();
  return studioUiInitialData(new Request(`http://${h.get('host') || 'invalid'}${path}`, { method: 'GET', headers: h }));
}

export async function StudioPage({ view = 'lab', searchParams }: { view?: StudioView; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const data = await loadControlStudio(viewPaths[view]);
  const query = searchParams ? await searchParams : {};
  const dealer = Array.isArray(query.dealer) ? query.dealer[0] : query.dealer;
  const event = Array.isArray(query.event) ? query.event[0] : query.event;
  // Match the standalone voice endpoint's server-owned native/Neon boundary.
  const standaloneVoicePreviewAvailable = process.env.CROUPIER_STUDIO_NATIVE_ADMIN !== '1' && process.env.CROUPIER_STUDIO_NEON_POLICY !== '1';
  return <Studio initialProject={data.project} initialVideos={data.videos} initialStatus={data.status} initialView={view} initialDealerId={dealer} initialEventId={event} connectedLane={process.env.CROUPIER_STREAM_LANE === 'lissabon-stream-lane'} standaloneVoicePreviewAvailable={standaloneVoicePreviewAvailable} />;
}
