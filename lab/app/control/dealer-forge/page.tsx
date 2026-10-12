import { canonicalControlHref } from '@/lib/control-flow.mjs';
import { firstQueryValue } from '@/components/studio-types';
import { redirectToPublicControl } from '../public-redirect';

export const dynamic='force-dynamic';
export default async function Page({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const query = await searchParams, params = new URLSearchParams();
  for (const [key, value] of Object.entries({dealer: query.dealer ?? query.dealerId, composition: query.composition ?? query.lane, operator: query.operator, table: query.table})) {
    const entry = firstQueryValue(value);
    if (entry && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(entry)) params.set(key, entry);
  }
  await redirectToPublicControl(canonicalControlHref('/control/dealer-forge' + (params.size ? '?' + params : '')));
}
