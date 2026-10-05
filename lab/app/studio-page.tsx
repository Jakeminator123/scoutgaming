import { headers } from 'next/headers';
import { Studio } from '@/components/studio';
import { studioUiInitialData } from '@/lib/ui-server';
import { viewPaths, type StudioView } from '@/components/studio-types';

export async function StudioPage({ view = 'lab' }: { view?: StudioView }) {
  const h = await headers();
  const data = await studioUiInitialData(new Request(`http://${h.get('host') || 'invalid'}${viewPaths[view]}`, { method: 'GET', headers: h }));
  // Match the standalone voice endpoint's server-owned native/Neon boundary.
  const standaloneVoicePreviewAvailable = process.env.CROUPIER_STUDIO_NATIVE_ADMIN !== '1' && process.env.CROUPIER_STUDIO_NEON_POLICY !== '1';
  return <Studio initialProject={data.project} initialVideos={data.videos} initialStatus={data.status} initialView={view} connectedLane={process.env.CROUPIER_STREAM_LANE === 'lissabon-stream-lane'} standaloneVoicePreviewAvailable={standaloneVoicePreviewAvailable} />;
}
