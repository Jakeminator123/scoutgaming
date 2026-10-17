import { ControlActivityPage } from '@/components/control-activity-page';
import { firstQueryValue } from '@/components/studio-types';
import { loadControlStudio } from '../../control-studio-data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Provspelning & logg · Croupier Studio' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const returnQuery = new URLSearchParams();
  for (const [key, value] of Object.entries({dealer: query.dealer, composition: query.composition ?? query.lane, operator: query.operator, table: query.table})) {
    const entry = firstQueryValue(value);
    if (entry && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(entry)) returnQuery.set(key, entry);
  }
  const data = await loadControlStudio('/control/rehearsal' + (returnQuery.size ? '?' + returnQuery : ''));
  return <ControlActivityPage initialProject={data.project} initialVideos={data.videos} initialStatus={data.status}
    initialDealerId={firstQueryValue(query.dealer)} initialLaneId={firstQueryValue(query.composition) ?? firstQueryValue(query.lane)}
    initialOperatorSlug={firstQueryValue(query.operator)} initialTableId={firstQueryValue(query.table)} />;
}
