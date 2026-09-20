import { headers } from 'next/headers';
import { Studio } from '@/components/studio';
import { studioInitialData } from '@/lib/studio-server.mjs';
import { assertLocalRequest } from '@/lib/http-guard.mjs';
import type { StudioView } from '@/components/studio-types';

export async function StudioPage({ view = 'lab' }: { view?: StudioView }) {
  const h = await headers();
  assertLocalRequest(new Request(`http://${h.get('host') || 'invalid'}/`, { headers: h }));
  const data = await studioInitialData();
  return <Studio initialProject={data.project} initialVideos={data.videos} initialStatus={data.status} initialView={view} />;
}
