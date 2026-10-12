import {headers} from 'next/headers';
import {DealerForgePage} from '@/components/dealer-forge-page';
import {firstQueryValue} from '@/components/studio-types';
import {authorizeUiPage} from '@/lib/ui-server';
import {dealerForgeInitialData} from '@/lib/dealer-forge-api.mjs';

export const dynamic='force-dynamic';
export const metadata={title:'Dealer Forge · Croupier Studio'};

export default async function Page(props:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query=props?.searchParams?await props.searchParams:{};
  const h=await headers();
  await authorizeUiPage(new Request(`http://${h.get('host')||'invalid'}/control/dealer-forge`,{method:'GET',headers:h}));
  const dealerId=firstQueryValue(query.dealer)??firstQueryValue(query.dealerId);
  const initial=await dealerForgeInitialData(dealerId);
  return <DealerForgePage initialDealerId={dealerId} initialIndex={initial.index} initialState={initial.state as never} />;
}
