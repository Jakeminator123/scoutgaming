import { ControlVideosPage } from '@/components/control-videos-page';
import { firstQueryValue } from '@/components/studio-types';
import { loadControlStudio } from '../../control-studio-data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Klippbibliotek · Croupier Studio' };

export default async function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query: Record<string, string | string[] | undefined> = props?.searchParams ? await props.searchParams : {};
  const data = await loadControlStudio('/control/videos');
  return (
    <ControlVideosPage
      initialProject={data.project}
      initialVideos={data.videos}
      initialStatus={data.status}
      initialDealerId={firstQueryValue(query.dealer)}
      initialEventId={firstQueryValue(query.event)}
      initialVariantId={firstQueryValue(query.variant)}
      connectedLane={process.env.CROUPIER_STREAM_LANE === 'lissabon-stream-lane'}
    />
  );
}
