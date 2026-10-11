import {headers} from 'next/headers';
import {ControlRepliesPage} from '@/components/control-replies-page';
import {firstQueryValue} from '@/components/studio-types';
import {studioUiInitialData} from '@/lib/ui-server';
import {studioNavigationContextFromQuery} from '@/lib/studio-navigation.mjs';

export const dynamic='force-dynamic';
export const metadata={title:'Svarsbibliotek · Croupier Studio'};

export default async function Page(props:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query=props?.searchParams?await props.searchParams:{};
  const h=await headers();
  const requestedDealer=firstQueryValue(query.dealer);
  const returnQuery=new URLSearchParams();
  for(const key of ['dealer','event','variant','situation','lane','category']){const value=firstQueryValue(query[key]);if(value)returnQuery.set(key,value);}
  const initialNavigationContext=studioNavigationContextFromQuery(returnQuery);
  const data=await studioUiInitialData(new Request(`http://${h.get('host')||'invalid'}/control/replies${returnQuery.size?'?'+returnQuery:''}`,{method:'GET',headers:h}));
  return <ControlRepliesPage dealers={data.project.dealers.map(({id,label}:{id:string;label:string})=>({id,label}))} initialDealerId={requestedDealer} initialCategory={firstQueryValue(query.category)} initialNavigationContext={initialNavigationContext}/>;
}
