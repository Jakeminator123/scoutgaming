import { canonicalControlHref } from '@/lib/control-flow.mjs';
import { redirectToPublicControl } from '../public-redirect';
export const dynamic = 'force-dynamic';
export default async function Page({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const query = await searchParams, params = new URLSearchParams();
  for (const key of ['operator','composition','lane','dealer','table','tab']) {
    const value = query[key];
    if (typeof value === 'string' && value) params.set(key, value);
  }
  await redirectToPublicControl(canonicalControlHref('/control/lanes' + (params.size ? '?' + params : '')));
}
