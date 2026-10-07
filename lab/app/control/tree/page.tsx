import { ControlTreePage } from '@/components/control-tree-page';
import { firstQueryValue } from '@/components/studio-types';
import { loadControlStudio } from '../../control-studio-data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Händelser → klipp · Croupier Studio' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const data = await loadControlStudio('/control/tree');
  return <ControlTreePage initialProject={data.project} initialVideos={data.videos} initialStatus={data.status} initialDealerId={firstQueryValue(query.dealer)} initialEventId={firstQueryValue(query.event)} />;
}
