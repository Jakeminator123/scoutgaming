const capabilities=Object.freeze({schemaVersion:1,registeredDealerIds:Object.freeze(['nora']),compositing:'per-clip'});
export function presentationCapabilitiesResponse(request) {
  const url=new URL(request.url);if(url.pathname!=='/api/presentation/capabilities')return null;
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(url.search)return new Response(null,{status:400,headers});
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
  return new Response(request.method==='HEAD'?null:JSON.stringify(capabilities),{status:200,headers});
}
