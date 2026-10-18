// Internal gateway authorization only. Native BO cookies and older opaque Lab
// sessions are checked against the same current Neon identity on every call.
export function createStudioLabSessionCheck({authorize,publicOrigin,labOrigin} = {}) {
  const publicUrl=new URL(publicOrigin),labUrl=new URL(labOrigin);
  if(typeof authorize!=='function'||publicUrl.origin!==publicOrigin||labUrl.origin!==labOrigin
    ||publicUrl.protocol!=='https:'||labUrl.protocol!=='https:') throw Error('studio_lab_session_configuration_invalid');
  return async request=>{
    const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
    if(request.method!=='GET'||request.url!=='/api/auth/lab/check'||request.headers.host!==labUrl.host
      ||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.socket?.remoteAddress)
      ||request.headers.origin&&request.headers.origin!==publicOrigin) return new Response(null,{status:401,headers});
    try {
      const session=await authorize(new Request(`${publicOrigin}${request.url}`,{headers:request.headers}));
      return new Response(null,{status:['admin','superadmin'].includes(session?.role)?200:401,headers});
    } catch(error) {return new Response(null,{status:error?.statusCode===401||error?.statusCode===403?401:503,headers});}
  };
}
