import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { publicAbsoluteUrl } from '@/lib/lab-url.mjs';

export const dynamic = 'force-dynamic';

// /studio is a technical mount. Enter Admin unless an old bookmark carries clip context.
export default async function Page({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams ?? {})) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  }
  const destination = query.size ? `/control/clips?${query}` : '/admin';
  permanentRedirect(publicAbsoluteUrl(await headers(), destination));
}
