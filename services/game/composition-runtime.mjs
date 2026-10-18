import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const sources=new Map([
  ['/composition-runtime/compositor.js',new URL('../../packages/presentation/compositor/compositor.js',import.meta.url)],
  ['/composition-runtime/geometry.js',new URL('../../packages/presentation/compositor/geometry.js',import.meta.url)],
]);
export async function compositionRuntimeResponse(request) {
  const url=new URL(request.url),source=sources.get(url.pathname);
  if(!source)return null;
  const headers={'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'};
  if(url.search)return new Response(null,{status:400,headers});
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
  return new Response(request.method==='HEAD'?null:await readFile(fileURLToPath(source)),{status:200,headers});
}
