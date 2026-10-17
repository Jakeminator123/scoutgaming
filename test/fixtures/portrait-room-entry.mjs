import {createLegacyProject} from '../../lab/test/fixtures/legacy-project.mjs';
import {cloudPresentationFixture} from '../../lab/test/fixtures/cloud-presentation.mjs';
import {createSeedProject,defaultPresentationLane,normalizeProject} from '../../packages/presentation/contracts/studio-model.mjs';
import {buildPresentationPackage} from '../../packages/presentation/contracts/presentation-layers.mjs';
import {withPackagePresentation} from '../../packages/presentation/server/presentation-package.mjs';
import {createGameEntrySelector} from '../../web/game-entry-operator.mjs';
import {decorateGameEntryHtml} from '../../web/public/game-entry-contract.mjs';

// Isolated in-memory published room. No database, credentials or media writes.
// Browser QA can decorate the ordinary served HTML and then run real app/media.
export function createPortraitRoomEntryFixture({dealer='linnea',allowedDealers=[dealer],operator='sg-test',
  roomId='room-e46c60e2-8857-7b37-9363-5a37cff9e49a'}={}) {
  let project=dealer==='amira'?normalizeProject(createLegacyProject()):createSeedProject();
  const lane={...defaultPresentationLane(dealer==='amira'?'astrid':dealer),id:'fixture-presentation',label:'QA presentation',dealers:[...allowedDealers]};
  lane.layers.dealer={enabled:true,default:dealer,allowed:[...allowedDealers]};
  project.lanes=[lane];
  const room={schemaVersion:2,id:roomId,name:'QA dealer room',operatorId:'fixture-operator',presentationLaneId:lane.id,gameLaneId:'fixture-portrait-room',state:'live'};
  const administration={gameLane:room.gameLaneId,gameLanes:[{schemaVersion:1,id:room.gameLaneId,label:'QA portrait room',
    renderer:'portrait-video',dealer,mediaCollection:dealer+'-presentation'}],rooms:[room]};
  // Retired Amira is retained only as an explicit historical negative fixture.
  const cloud = dealer==='amira' ? null : cloudPresentationFixture({project,lanes:[lane]});
  if(cloud)project=cloud.project;
  const presentation=cloud?.presentation ?? buildPresentationPackage(project,[lane.id],[]);
  const pack={operatorId:room.operatorId,revision:7,lanes:[lane.id],games:['blackjack'],tables:[room.id],branding:withPackagePresentation({name:'QA operator'},presentation)};
  const select=createGameEntrySelector({policy:{readGameConfiguration(){},readSaved:async()=>({project,administration})},
    packages:{resolve:async slug=>slug===operator?{operator:{id:room.operatorId,slug:operator,status:'active'},package:pack}:{operator:null}},log(){}});
  const query='operator='+encodeURIComponent(operator)+'&table='+encodeURIComponent(room.id);
  return {select,query,room,project,administration,pack,
    async decorate(html,search=query) { const entry=await select(search);if(entry.status!==200)throw Error('Fixture entry rejected');return decorateGameEntryHtml(html,{CROUPIER_STUDIO_NEON_POLICY:'1'},entry.selection); }};
}
