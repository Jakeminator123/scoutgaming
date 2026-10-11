import { ControlEventsPage } from '@/components/control-events-page';
import { ControlTreePage } from '@/components/control-tree-page';
import { firstQueryValue } from '@/components/studio-types';
import { loadControlStudio } from '../../control-studio-data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Spelhändelser & villkor · Scoutgaming' };

export default async function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await (props?.searchParams ?? Promise.resolve({}));
  const data = await loadControlStudio('/control/events');
  const dealerId = firstQueryValue(query.dealer);
  const eventId = firstQueryValue(query.event);
  if (!eventId) return <ControlTreePage initialProject={data.project} initialVideos={data.videos} initialStatus={data.status} initialDealerId={dealerId} />;
  return <ControlEventsPage
    initialProject={data.project}
    initialVideos={data.videos}
    initialStatus={data.status}
    initialDealerId={dealerId}
    initialEventId={eventId}
    initialVariantId={firstQueryValue(query.variant)}
    initialTab={firstQueryValue(query.tab)}
    initialSituation={firstQueryValue(query.situation)}
    connectedLane={process.env.CROUPIER_STREAM_LANE === 'lissabon-stream-lane'}
  />;
}
