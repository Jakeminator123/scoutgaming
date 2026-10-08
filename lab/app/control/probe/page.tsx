import { ControlProbePage } from '@/components/control-probe-page';
import { firstQueryValue } from '@/components/studio-types';
import { loadControlStudio } from '../../control-studio-data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Probe · Croupier Studio' };

export default async function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = props?.searchParams ? await props.searchParams : {};
  const data = await loadControlStudio('/control/probe');
  return <ControlProbePage initialProject={data.project} initialVideos={data.videos} initialStatus={data.status} initialDealerId={firstQueryValue(query.dealer)} initialEventId={firstQueryValue(query.event)} />;
}
