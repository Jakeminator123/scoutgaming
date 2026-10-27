import { createOpenClawAdminApi } from './openclaw-admin.mjs';
import { assistantJson, assistantFailure as fail } from './assistant-model.mjs';

export function assistantRequest(request,runtime,path,method='GET',body){
  const url=new URL(request.url);url.pathname=(runtime.config.apiBase==='/api/admin'?'/api':'/studio/api')+path;url.search='';
  const headers=new Headers(request.headers);headers.delete('content-length');headers.set('content-type','application/json');
  return new Request(url,{method,headers,signal:request.signal,...(body?{body:JSON.stringify(body)}:{})});
}
export async function assistantRead(response){
  const value=await assistantJson(response);
  if(!response.ok)fail('assistant_dependency_unavailable',response.status===409?409:503);
  return value;
}
// Mutation APIs can return an entire project or media library. A successful
// write must not be reported as failed merely because that receipt is large.
export async function assistantWrite(response){
  if(!response.ok)return assistantRead(response);
  await response.body?.cancel();return {completed:true};
}
export function assistantServices(runtime,{openclawOptions}={}){
  return {
    admin:(request,path,method='GET',body,{ackOnly=false}={})=>runtime.api.handle(assistantRequest(request,runtime,'/admin/'+path,method,body)).then(ackOnly?assistantWrite:assistantRead),
    openclaw:(request,method='GET',body)=>createOpenClawAdminApi({config:runtime.config,authorize:runtime.authorize,...openclawOptions})
      .handle(assistantRequest(request,runtime,'/openclaw/admin',method,body)).then(assistantRead),
  };
}
const pick=(row,keys)=>Object.fromEntries(keys.filter(key=>row?.[key]!==undefined).map(key=>[key,typeof row[key]==='string'?row[key].slice(0,180):row[key]]));
const list=(rows,project)=>({total:rows.length,partial:rows.length>150,items:rows.slice(0,150).map(project)});
export async function readAssistantContext(runtime,request,{services=assistantServices(runtime),mode='admin',now=Date.now}={}){
  const coverage={};const read=async(name,work)=>{try{const value=await work();coverage[name]='available';return value;}catch{coverage[name]='unavailable';return null;}};
  const openclaw=await read('openclaw',()=>services.openclaw(request));
  const architecture={
    site:'Vercel kör denna chatt och behörighetskontrollerna.',
    engine:'Render croupier-v3 äger spelet. Game/auth och Studio använder Neon PostgreSQL.',
    openclaw:'Director på Render förmedlar förfrågningar till separat OpenClaw Gateway. Dealer-/socialchatt styrs av sina egna roller.',
    permissions:'Adminroboten kan läsa sparade register och utföra granskade ändringar via ordinarie serverfunktioner. Modellen får inga databaslösenord, shell eller molnkontotoken.',
    monitoring:'Status läses när du öppnar eller frågar. Ingen bakgrundsövervakning är aktiverad.',
  };
  if(mode==='openclaw')return {observedAt:new Date(now()).toISOString(),architecture,coverage,openclaw,
    limits:['Gatewaymodell kan ändras efter bekräftelse. Renderkontots inställningar, loggar, diskfiler och godtyckliga OpenClaw-verktyg är inte anslutna.']};
  const [saved,lifecycle,database,shoes]=await Promise.all([
    read('studio',()=>runtime.repository.readDocument('project')),
    read('resources',()=>services.admin(request,'resource-lifecycle')),
    read('databaseSchema',()=>runtime.assistantDatabaseInventory()),
    read('gameReadout',()=>services.admin(request,'shoes')),
  ]);
  const project=saved?.value;
  return {observedAt:new Date(now()).toISOString(),architecture,coverage,openclaw,database,shoes,
    studio:project?{revision:saved.revision,
      dealers:list([...(project.dealers??[]).map(row=>({...row,archived:false})),...(project.dealerTrash??[]).map(row=>({...row.dealer,archived:true}))],row=>pick(row,['id','label','archived'])),
      materials:list([...(project.layerAssets??[]).map(row=>({...row,archived:false})),...(project.layerAssetTrash??[]).map(row=>({...row.asset,archived:true}))],row=>pick(row,['id','label','role','archived'])),
      compositions:list(project.lanes??[],row=>pick(row,['id','label']))}:null,
    resources:lifecycle?{historyCoverage:lifecycle.historyCoverage,
      companies:list(lifecycle.operators??[],row=>pick(row,['id','slug','name','status','roomCount','archivedRoomCount'])),
      rooms:list(lifecycle.rooms??[],row=>pick(row,['id','name','operatorId','state','presentationLaneId','archivedAt']))}:null,
    limits:['Listor med fler än 150 poster är begränsade. Använd read för sökning och fler registerposter. Konton, hemligheter, privata spelaruppgifter och kortföljder lämnas inte ut.',
      'Schema visar tabellnamn. Sparade dealer-, material-, fil-, bolags- och rumsposter kan läsas; stödda ändringar sparas i databasen med granskning. Ingen fri SQL. Blobfiler inventeras via mediaregistret, inte genom innehållsanalys.',
      'Renderkontots loggar och diskfiler är inte anslutna. Inga kvalitets- eller läppsynkgodkännanden görs av assistenten.'],
  };
}
