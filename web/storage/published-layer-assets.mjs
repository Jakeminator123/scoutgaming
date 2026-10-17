import {readPackagePresentation} from '../../packages/presentation/server/presentation-package.mjs';
import {validateLayerAsset} from '../../packages/presentation/contracts/presentation-layers.mjs';

export function createPublishedLayerAssets({packages,privateMedia}) {
  return async function handle(request) {
    const url=new URL(request.url),match=/^\/api\/presentation\/layers\/([a-z][a-z0-9-]{0,62})\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/.exec(url.pathname);
    if(!match)return null;
    if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
    if(url.search)return new Response(null,{status:400});
    try {
      const context=await packages.resolve(match[1]);
      const pack=context?.operator&&context.package?readPackagePresentation(context.package):null;
      const asset=pack?.assets.find(row=>row.id===match[2]);
      if(!asset)return new Response(null,{status:404});
      const {pathname,sha256,size,contentType}=validateLayerAsset(asset);
      return await privateMedia({provider:'vercel-blob',pathname,sha256,size,contentType},request);
    }catch{return Response.json({error:'presentation_asset_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
  };
}
