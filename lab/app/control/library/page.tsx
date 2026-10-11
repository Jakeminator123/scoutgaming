import {headers} from 'next/headers';
import {ControlLayerLibraryPage} from '@/components/control-layer-library-page';
import {firstQueryValue} from '@/components/studio-types';
import {studioUiInitialData} from '@/lib/ui-server';

export const dynamic='force-dynamic';
export const metadata={title:'Bord & bakgrunder · Croupier Studio'};

export default async function Page(props:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query=props?.searchParams?await props.searchParams:{};
  const h=await headers();
  const data=await studioUiInitialData(new Request(`http://${h.get('host')||'invalid'}/control/library`,{method:'GET',headers:h}));
  return <ControlLayerLibraryPage initialRole={firstQueryValue(query.tab)==='backgrounds'?'background':'table'} initialProject={data!.project} initialVideos={data!.videos} initialStatus={data!.status}/>;
}
