import { ControlEventsPage } from '@/components/control-events-page';
import { firstQueryValue } from '@/components/studio-types';
import { loadControlStudio } from '../../control-studio-data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Händelser · Croupier Studio' };

export default async function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await (props?.searchParams ?? Promise.resolve({}));
  const data = await loadControlStudio('/control/events');
  return <ControlEventsPage
    initialProject={data.project}
    initialVideos={data.videos}
    initialStatus={data.status}
    initialDealerId={firstQueryValue(query.dealer)}
    initialEventId={firstQueryValue(query.event)}
    initialVariantId={firstQueryValue(query.variant)}
    initialTab={firstQueryValue(query.tab)}
    connectedLane={process.env.CROUPIER_STREAM_LANE === 'lissabon-stream-lane'}
  />;
}
