import {createHash} from 'node:crypto';
import {addDealer,createSeedProject,defaultPresentationLane} from '../../packages/presentation/contracts/studio-model.mjs';
import {defaultCompositionSettings,defaultBlackjackTableGeometry} from '../../packages/presentation/contracts/composition-settings.mjs';
import {layerAssetPath} from '../../packages/presentation/contracts/presentation-layers.mjs';
import {captureFrozenPresentation} from '../../packages/presentation/server/frozen-presentation-capture.mjs';
import {DRAGAN_KEVIN_PROFILE as profile} from '../../packages/presentation/contracts/filmed-profiles/kevin-dragan-f15b2af1.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const uuid=key=>{const value=hash('isolated-compression-fixture:'+key);return `${value.slice(0,8)}-${value.slice(8,12)}-4000-8000-${value.slice(12,24)}`;};

// Real source hashes/pose count; deterministic synthetic IDs and source facts.
// No copied production account, project, publication or media registry records.
export function filmedPresentationFixture(){
  const project=addDealer(createSeedProject(),'dragan','Dragan');
  project.revision='studio-'+uuid('project');
  const lane=defaultPresentationLane('dragan');lane.id='compression-fixture';
  project.lanes=[lane];
  project.layerAssets=['background','table'].map(role=>{
    const asset={schemaVersion:1,id:uuid(role),role,label:'Fixture '+role,sha256:hash(role),size:100000,
      contentType:'image/png',width:1920,height:1080};return {...asset,pathname:layerAssetPath(asset)};
  });
  for(const asset of project.layerAssets)lane.layers[asset.role]={...lane.layers[asset.role],enabled:true,default:asset.id,allowed:[asset.id],...(asset.role==='background'?{mode:'image'}:{})};
  lane.composition=defaultCompositionSettings();
  lane.composition.blackjackTables=[defaultBlackjackTableGeometry(project.layerAssets[1].id)];
  const media=profile.takes.map(take=>{
    const seat=Number(take.target)-1;
    const eventId=take.target==='flip'?'reveal.dealer':['dealer','hole'].includes(take.target)?'deal.dealer':seat<2?'deal.player.left':seat<5?'deal.player.centre':'deal.player.right';
    const situation=['hole','flip'].includes(take.target)?'dealer-hole':take.target==='dealer'?'dealer-up':'box'+seat;
    const id=uuid(take.key),sha256=take.sha256;
    return {id,sha256,size:1000000+take.frames*1000,contentType:'video/mp4',
      pathname:`croupier/media/dealers/dragan/review/uploads/${id}/${sha256}.mp4`,classification:{dealerId:'dragan',eventId,situation,
        kind:'action',role:'alternative',playback:'once',label:'Kevin '+take.key,
        notes:`Source ${profile.source.commit}: ${take.repositoryPath}. SHA256 ${sha256}. Sequence ${take.key}: ${take.startPose} to ${take.endPose}. Source evidence only; no visual acceptance.`,
        compositing:{mode:'green-screen',threshold:.23,softness:.15,despill:0}}};
  });
  const id=uuid('idle'),sha256=hash('idle');
  media.push({id,sha256,size:1000000,contentType:'video/mp4',pathname:`croupier/media/dealers/dragan/review/uploads/${id}/${sha256}.mp4`,
    classification:{dealerId:'dragan',eventId:'idle.ready',situation:'',kind:'idle',role:'alternative',playback:'once',label:'Fixture idle',notes:'',
      compositing:{mode:'green-screen',threshold:.23,softness:.15,despill:0}}});
  for(const line of project.lines.filter(row=>row.dealerId==='dragan')){
    const records=media.filter(row=>row.classification.eventId===line.eventId),baseline=line.variants[0];
    if(line.eventId==='idle.ready')baseline.videoGenerationId=id;
    else line.variants.push(...records.map(row=>({...structuredClone(baseline),id:'dragan.'+line.eventId+'.'+row.id,label:row.classification.label,
      videoGenerationId:row.id,selection:{rules:false,model:false,random:false}})));
  }
  const inventory={families:[],videos:media.map(row=>({id:row.id,sha256:row.sha256,bytes:row.size,dealer:'dragan',available:true,integrity:'verified',classification:structuredClone(row.classification)}))};
  const {presentation}=captureFrozenPresentation({snapshot:{projectDocument:{kind:'project',revision:project.revision,value:project},
    administrationDocument:{kind:'administration',revision:'admin-fixture',value:{rooms:[]}},mediaRows:media.map(row=>({...row,revision:'media-fixture'}))},
    inventory,selectedLaneIds:[lane.id],requiredIdleDealerIds:['dragan']});
  return structuredClone(presentation);
}
