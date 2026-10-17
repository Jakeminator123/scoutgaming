import { headers } from 'next/headers';
import { studioUiInitialData } from '@/lib/ui-server';

export async function loadControlStudio(path: string) {
  const h = await headers();
  return studioUiInitialData(new Request(`http://${h.get('host') || 'invalid'}${path}`, { method: 'GET', headers: h }));
}
