import { firstQueryValue } from '@/components/studio-types';
import { LabStudio } from '@/components/lab-studio';
import { loadControlStudio } from '../../control-studio-data';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dealers & klipp · Croupier Studio' };
export default async function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = props?.searchParams ? await props.searchParams : {};
  const returnQuery = new URLSearchParams();
  for (const [key, value] of Object.entries({dealer: query.dealer ?? query.dealerId, composition: query.composition ?? query.lane, operator: query.operator, table: query.table, game: query.game, event: query.event, situation: query.situation})) {
    const entry = firstQueryValue(value);
    if (entry && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(entry)) returnQuery.set(key, entry);
  }
  const view = firstQueryValue(query.view), category = firstQueryValue(query.category);
  if (view && ['idle', 'clips', 'generate', 'speech', 'settings'].includes(view)) returnQuery.set('view', view);
  if (category && ['all', 'idle', 'deal', 'speech', 'reaction', 'action'].includes(category)) returnQuery.set('category', category);
  const data = await loadControlStudio('/control/clips' + (returnQuery.size ? '?' + returnQuery : ''));
  return <LabStudio initialLaneId={firstQueryValue(query.composition) ?? firstQueryValue(query.lane)} initialOperatorId={firstQueryValue(query.operator)} initialTableId={firstQueryValue(query.table)} initialGame={firstQueryValue(query.game)} initialView={firstQueryValue(query.view)} initialCategory={firstQueryValue(query.category)} initialDealerId={firstQueryValue(query.dealer) ?? firstQueryValue(query.dealerId)} initialEventId={firstQueryValue(query.event)} initialSituation={firstQueryValue(query.situation)} initialProject={data.project} initialVideos={data.videos} connectedLane={process.env.CROUPIER_STREAM_LANE === 'lissabon-stream-lane'} />;
}
