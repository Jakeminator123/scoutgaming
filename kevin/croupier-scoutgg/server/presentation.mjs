// Pull published presentation from the existing BO. No game inputs are accepted.
export function createPresentationReader({base=process.env.BO_DESIGN_URL??'http://127.0.0.1:4173',fetcher=fetch}={}) {
  const origin=new URL(base);
  if(origin.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(origin.hostname)||origin.username||origin.password)throw Error('BO design must use a local service');
  const cache=new Map();
  return async brand=>{
    if(!['scout','nrk','bfj','aur'].includes(brand))throw Error('Unknown brand');
    const old=cache.get(brand);if(old&&Date.now()-old.at<2000)return old.value;
    const url=new URL('/api/bo/published-design',origin);url.searchParams.set('brand',brand);
    const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(2000)});
    if(!response.ok)throw Error('Published design unavailable');
    const value=await response.json();
    if(value.schema!==1||value.brand!==brand||!value.theme||typeof value.revision!=='string')throw Error('Invalid published design');
    cache.set(brand,{at:Date.now(),value});return value;
  };
}
