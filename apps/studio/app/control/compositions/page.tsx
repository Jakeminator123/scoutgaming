import { firstQueryValue } from '@/components/studio-types';
import { ControlPreviewPage } from '@/components/control-preview-page';
import { loadControlStudio } from '../../control-studio-data';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sammansättningar · Croupier Studio' };
export default async function Page({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const key of ['operator','composition','dealer','table','game']) {const value=firstQueryValue(query[key]);if(value)params.set(key,value);}
  const data = await loadControlStudio('/control/compositions' + (params.size ? '?' + params : ''));
  return <ControlPreviewPage initialLaneId={firstQueryValue(query.composition ?? query.lane)} initialDealerId={firstQueryValue(query.dealer)} initialOperatorId={firstQueryValue(query.operator)} initialRoomId={firstQueryValue(query.table)} initialGame={firstQueryValue(query.game)==='roulette'?'roulette':'blackjack'} initialProject={data.project} initialVideos={data.videos} initialStatus={data.status} />;
}
