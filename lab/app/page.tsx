import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { publicAbsoluteUrl } from '@/lib/lab-url.mjs';

export const dynamic = 'force-dynamic';

// /studio is a technical mount. Keep old links usable through the public URL.
export default async function Page({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams ?? {})) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  }
  const suffix = query.size ? `?${query}` : '';
  permanentRedirect(publicAbsoluteUrl(await headers(), `/control/clips${suffix}`));
}
