// Isolated acceptance of the production capture, selection and media routes.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {addDealer,createEmptyProject,defaultPresentationLane} from '../packages/presentation/contracts/studio-model.mjs';
import {captureFrozenPresentation} from '../packages/presentation/server/frozen-presentation-capture.mjs';
import {withPackagePresentation} from '../packages/presentation/server/presentation-package.mjs';
import {layerAssetPath} from '../packages/presentation/contracts/presentation-layers.mjs';
import {createPublicOperatorPreview} from '../web/public-operator-preview.mjs';
import {createPublicOperatorRooms} from '../web/public-operator-rooms.mjs';

export async function rouletteSceneFixture(manifestPath) {
  const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
  const dealerId='anna-jonsson',project=addDealer(createEmptyProject(),dealerId,'Anna');
  const lane=defaultPresentationLane(dealerId);lane.id='anna-roulette';lane.composition=manifest.settings;project.lanes=[lane];
  const files=new Map(),evidence={};
  async function bytes(name,input) {
    const data=await readFile(input.path),sha256=createHash('sha256').update(data).digest('hex');
    if(sha256!==input.sha256)throw Error('Fixture media hash mismatch: '+name);
    evidence[name]={sha256,size:data.length};return {data,sha256,size:data.length};
  }
  const mediaRows=[];
  for(const [i,name] of (manifest.variant?['base','variant']:['base']).entries()) {
    const input=manifest[name],b=await bytes(name,input),id=`10000000-0000-4000-8000-00000000000${i+1}`;
    const action=i?'glasses-clean':'breathing';
    const record={id,sha256:b.sha256,size:b.size,contentType:'video/webm',revision:'fixture-'+b.sha256,
      pathname:`croupier/media/dealers/${dealerId}/review/uploads/${id}/${b.sha256}.webm`,
      classification:{dealerId,game:'roulette',eventId:'roulette.idle',action,situation:action,startPose:'unverified',endPose:'unverified',kind:'idle',role:'standard',label:action,notes:'Isolated visual acceptance',playback:'once',compositing:{mode:'alpha'},framing:manifest.framing}};
    mediaRows.push(record);files.set(record.pathname,b.data);
  }
  project.dealers.find(row=>row.id===dealerId).rouletteIdle={videoId:mediaRows[0].id,variantVideoIds:mediaRows.slice(1).map(row=>row.id),foregroundPolygons:manifest.foregroundPolygons};
  if(manifest.start){
    const input=manifest.start,b=await bytes('start',input),id='10000000-0000-4000-8000-000000000003';
    if(input.poseReview!=='VILA-to-VILA')throw Error('Fixture start needs explicit first/last pose review');
    const record={id,sha256:b.sha256,size:b.size,contentType:'video/webm',revision:'fixture-'+b.sha256,
      pathname:`croupier/media/dealers/${dealerId}/review/uploads/${id}/${b.sha256}.webm`,
      classification:{dealerId,game:'roulette',eventId:'roulette.wheel-start',action:'wheel-start',situation:'wheel-start',startPose:'VILA',endPose:'VILA',kind:'action',role:'standard',label:'Hjulstart · granskningsklipp',notes:'Isolated timing review; not production approved',playback:'once',compositing:{mode:'alpha'},framing:input.framing}};
    mediaRows.push(record);files.set(record.pathname,b.data);
    project.dealers.find(row=>row.id===dealerId).rouletteStart={videoId:id,...input.profile};
  }
  project.layerAssets=[];
  for(const [i,role] of ['background','table'].entries()) {
    const input=manifest[role],b=await bytes(role,input);
    const record={schemaVersion:1,id:`20000000-0000-4000-8000-00000000000${i+1}`,role,label:role==='table'?'Roulette · Anna':'Casino · MP4',sha256:b.sha256,size:b.size,
      contentType:input.contentType,width:input.width,height:input.height,...(role==='table'?{game:'roulette'}:{})};
    record.pathname=layerAssetPath(record);project.layerAssets.push(record);files.set(record.pathname,b.data);
    lane.layers[role]={enabled:true,default:record.id,allowed:[record.id],...(role==='background'?{mode:'video'}:{colors:[]})};
  }
  const inventory={videos:mediaRows.map(record=>({id:record.id,sha256:record.sha256,bytes:record.size,dealer:dealerId,available:true,classification:record.classification,kind:record.classification.kind,playback:'once'})),families:[],summary:{readable:true,snapshotReadable:true}};
  const {presentation}=captureFrozenPresentation({snapshot:{projectDocument:{kind:'project',revision:project.revision,value:project},administrationDocument:{kind:'administration',revision:'fixture-admin',value:{rooms:[]}},mediaRows},inventory,selectedLaneIds:[lane.id],requiredRouletteIdleDealerIds:[dealerId]});
  const room={schemaVersion:2,id:'isolated-room',name:'Anna · rouletteprov',operatorId:'isolated-operator',presentationLaneId:lane.id,gameLaneId:'portrait-anna-jonsson',state:'live',game:'roulette'};
  const saved={operator:{id:room.operatorId,slug:'isolated',name:'Isolerat visuellt prov',status:'active'},administration:{gameLane:room.gameLaneId,gameLanes:[{schemaVersion:1,id:room.gameLaneId,label:'Anna',renderer:'portrait-video',dealer:dealerId,mediaCollection:dealerId+'-presentation'}],rooms:[room]},package:{operatorId:room.operatorId,revision:1,lanes:[lane.id],games:['roulette'],tables:[room.id],branding:withPackagePresentation({},presentation)}};
  const preview=createPublicOperatorPreview({readCurrentContext:async slug=>slug==='isolated'?structuredClone(saved):null,privateMedia:async(record,request)=>{
    const data=files.get(record.pathname);
    if(!data||data.length!==record.size||createHash('sha256').update(data).digest('hex')!==record.sha256)return new Response(null,{status:404});
    const headers={'Content-Type':record.contentType,ETag:'"sha256-'+record.sha256+'"','Accept-Ranges':'bytes'};
    const range=/^bytes=(\d+)-(\d*)$/.exec(request.headers.get('range')??'');
    let start=0,end=data.length-1;
    if(range){start=Number(range[1]);end=range[2]?Math.min(Number(range[2]),end):end;if(start>end)return new Response(null,{status:416});headers['Content-Range']=`bytes ${start}-${end}/${data.length}`;}
    headers['Content-Length']=String(end-start+1);
    return new Response(request.method==='HEAD'?null:data.subarray(start,end+1),{status:range?206:200,headers});
  }});
  const rooms=createPublicOperatorRooms({store:{getOperatorBySlug:async slug=>slug==='isolated'?saved.operator:null,getCurrentPackage:async()=>saved.package},policy:{readSaved:async()=>({administration:saved.administration,project:{}}),readGameConfiguration:()=>{throw Error('Unexpected legacy configuration');}}});
  return {evidence,settings:manifest.settings,project,presentation,preview,rooms};
}
