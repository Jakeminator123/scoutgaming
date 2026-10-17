import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { firstQueryValue, studioHref } from '@/components/studio-types';
import { publicAbsoluteUrl } from '@/lib/lab-url.mjs';
import { authorizeUiPage } from '@/lib/ui-server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Operatörschatt · Croupier Studio' };

export default async function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const h = await headers();
  const query = props?.searchParams ? await props.searchParams : {};
  await authorizeUiPage(new Request(`http://${h.get('host') || 'invalid'}/control/operator-chat`, { method: 'GET', headers: h }));
  redirect(publicAbsoluteUrl(h, studioHref('/control/openclaw', {
    dealerId: firstQueryValue(query.dealer),
    eventId: firstQueryValue(query.event),
    tab: 'chat',
  })));
}
