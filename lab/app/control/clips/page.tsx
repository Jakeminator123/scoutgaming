import { firstQueryValue } from '@/components/studio-types';
import { headers } from 'next/headers';
import { LabStudio } from '@/components/lab-studio';
import { studioUiInitialData } from '@/lib/ui-server';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dealers & klipp · Croupier Studio' };
export default async function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = props?.searchParams ? await props.searchParams : {};
  const h = await headers();
  const data = await studioUiInitialData(new Request(`http://${h.get('host') || 'invalid'}/`, { headers: h }));
  return <LabStudio initialLaneId={firstQueryValue(query.lane)} initialView={firstQueryValue(query.view)} initialCategory={firstQueryValue(query.category)} initialDealerId={firstQueryValue(query.dealer) ?? firstQueryValue(query.dealerId)} initialEventId={firstQueryValue(query.event)} initialSituation={firstQueryValue(query.situation)} initialProject={data.project} initialVideos={data.videos} connectedLane={process.env.CROUPIER_STREAM_LANE === 'lissabon-stream-lane'} />;
}
