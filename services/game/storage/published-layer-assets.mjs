import {readPackagePresentation} from '../../../packages/presentation/server/presentation-package.mjs';
import {validateLayerAsset} from '../../../packages/presentation/contracts/presentation-layers.mjs';

export function createPublishedLayerAssets({packages,privateMedia}) {
  const noStore={'Cache-Control':'private, no-store'};
  return async function handle(request) {
    const url=new URL(request.url),match=/^\/api\/presentation\/layers\/([a-z][a-z0-9-]{0,62})\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/.exec(url.pathname);
    if(!match)return null;
    if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...noStore,Allow:'GET, HEAD'}});
    if(url.search)return new Response(null,{status:400,headers:noStore});
    try {
      const context=await packages.resolve(match[1]);
      const pack=context?.operator&&context.package?readPackagePresentation(context.package):null;
      const asset=pack?.assets.find(row=>row.id===match[2]);
      if(!asset)return new Response(null,{status:404,headers:noStore});
      const {pathname,sha256,size,contentType}=validateLayerAsset(asset);
      const response=await privateMedia({provider:'vercel-blob',pathname,sha256,size,contentType},request);
      const headers=new Headers(response.headers);
      // Every reuse still resolves the current publication above. Only exact,
      // hash-verified bytes may be retained by this browser, never a shared CDN.
      headers.set('Cache-Control',[200,206,304].includes(response.status)&&headers.get('etag')==='"sha256-'+sha256+'"'
        ?'private, no-cache, must-revalidate':'private, no-store');
      return new Response(response.body,{status:response.status,headers});
    }catch{return Response.json({error:'presentation_asset_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
  };
}
