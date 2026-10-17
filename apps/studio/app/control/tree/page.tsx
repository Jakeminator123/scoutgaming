import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { publicAbsoluteUrl } from '@/lib/lab-url.mjs';
import { authorizeUiPage } from '@/lib/ui-server';

export const dynamic = 'force-dynamic';

// Absolute URL so Next does not prefix basePath /studio. Every query value is kept.
function eventsLocation(query: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : value == null ? [] : [value]) {
      if (typeof item === 'string') params.append(key, item);
    }
  }
  const search = params.toString();
  return search ? `/control/events?${search}` : '/control/events';
}

export default async function Page(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const h = await headers();
  const query = props?.searchParams ? await props.searchParams : {};
  await authorizeUiPage(new Request(`http://${h.get('host') || 'invalid'}/control/tree`, { method: 'GET', headers: h }));
  permanentRedirect(publicAbsoluteUrl(h, eventsLocation(query)));
}
