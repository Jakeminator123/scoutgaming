import { headers } from 'next/headers';
import { assertLocalPageRequest } from '@/lib/http-guard.mjs';
import { loadVideoRegistry } from '@/lib/video-registry.mjs';
import { BackgroundZones } from '@/components/background-zones';
import type { VideoInventory } from '@/components/studio-types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bakgrundszoner · Backoffice/Lab' };

export default async function Page() {
  const h = await headers();
  assertLocalPageRequest(new Request(`http://${h.get('host') || 'invalid'}/zones`, { headers: h }));
  const inventory = await loadVideoRegistry() as VideoInventory;
  return <BackgroundZones videos={inventory.videos.filter(video => video.dealer === 'astrid' && video.available && video.previewUrl).map(video => ({ id: video.id, label: video.label, url: video.previewUrl }))} />;
}
