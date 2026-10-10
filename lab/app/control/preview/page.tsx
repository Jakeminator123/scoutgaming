import { firstQueryValue } from '@/components/studio-types';
import { headers } from 'next/headers';
import { ControlPreviewPage } from '@/components/control-preview-page';
import { studioUiInitialData } from '@/lib/ui-server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sammansättning · Croupier Studio' };

export default async function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = props?.searchParams ? await props.searchParams : {};
  const h = await headers();
  const data=await studioUiInitialData(new Request(`http://${h.get('host') || 'invalid'}/control/preview`, { method: 'GET', headers: h }));
  return <ControlPreviewPage initialLaneId={firstQueryValue(query.lane)} initialDealerId={firstQueryValue(query.dealer)} initialProject={data!.project} initialVideos={data!.videos} initialStatus={data!.status} />;
}
