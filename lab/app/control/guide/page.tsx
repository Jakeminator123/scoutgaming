import { ControlGuidePage } from '@/components/control-guide-page';
import { firstQueryValue } from '@/components/studio-types';
import { loadControlStudio } from '../../control-studio-data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Guide & hjälp · Croupier Studio' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const data = await loadControlStudio('/control/guide');
  return <ControlGuidePage initialProject={data.project} initialVideos={data.videos} initialStatus={data.status} initialDealerId={firstQueryValue(query.dealer)} initialEventId={firstQueryValue(query.event)} />;
}
