import test from 'node:test';
import assert from 'node:assert/strict';
import {BACKGROUND_EVENT_IDS, validateBackgroundPlayback, backgroundRuleAssetIds, defaultBackgroundRule} from '../packages/presentation/contracts/background-playback-policy.mjs';
import {createSeedProject, defaultPresentationLane, validateProject} from '../packages/presentation/contracts/studio-model.mjs';
import {layerAssetPath, validatePresentationPackage} from '../packages/presentation/contracts/presentation-layers.mjs';
import {cloudPresentationFixture} from '../apps/studio/test/fixtures/cloud-presentation.mjs';
import {withPackagePresentation, readPackagePresentation} from '../packages/presentation/server/presentation-package.mjs';
import {withoutPresentationLanes} from '../apps/studio/lib/dealer-archive-impact.mjs';
import {createGameEntrySelector} from '../packages/presentation/server/game-entry-selector.mjs';
import {createPublishedLayerAssets} from '../services/game/storage/published-layer-assets.mjs';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const rule = () => defaultBackgroundRule(id(2), 'celebration');
const policy = () => ({schemaVersion:1, rules:[rule()]});
function asset(n, contentType='video/mp4', role='background') {
  const value={schemaVersion:1,id:id(n),role,label:`Background ${n}`,sha256:'a'.repeat(64),size:128,contentType,width:1920,height:1080};
  return {...value,pathname:layerAssetPath(value)};
}
function fixture() {
  const project=createSeedProject(),lane=defaultPresentationLane('astrid');
  project.layerAssets=[asset(1,'image/png'),asset(2),asset(3)];
  lane.layers.background={enabled:true,mode:'image',default:id(1),allowed:[id(1),id(2)]};
  lane.backgroundPlayback=policy();project.lanes=[lane];
  return {project,lane};
}

test('policy accepts bounded timer and canonical event rules, immutable copies, image/video bases and same base',()=>{
  const {project,lane}=fixture();
  const original=policy(),checked=validateBackgroundPlayback(original,{assets:project.layerAssets,allowed:lane.layers.background.allowed,defaultAssetId:id(1)});
  original.rules[0].maxDurationMs=5000;assert.equal(checked.rules[0].maxDurationMs,10000);
  for(const eventId of BACKGROUND_EVENT_IDS) assert.doesNotThrow(()=>validateBackgroundPlayback({schemaVersion:1,rules:[{...rule(),trigger:{eventId}}]}));
  assert.deepEqual(backgroundRuleAssetIds({schemaVersion:1,rules:[rule(),{...rule(),id:'second'}]}),[id(2)]);
  assert.doesNotThrow(()=>validateBackgroundPlayback(policy(),{assets:project.layerAssets,allowed:lane.layers.background.allowed,defaultAssetId:id(2)}));
  assert.deepEqual(validateBackgroundPlayback({schemaVersion:1,rules:[]},{assets:[],allowed:[],defaultAssetId:null}),{schemaVersion:1,rules:[]});
});

test('policy refuses URLs, unbounded budgets, unknown events, ambiguous triggers, duplicates and accessor data',()=>{
  for(const patch of [{id:'../bad'},{assetId:'https://foreign.invalid/video.mp4'},
    {trigger:{eventId:'speech.blackjack'}},{trigger:{eventId:'speak.win',everyMs:5000}},
    {trigger:{everyMs:4999}},{trigger:{everyMs:300001}},{maxDurationMs:999},{maxDurationMs:60001},
    {cooldownMs:-1},{cooldownMs:300001},{maxPerMinute:0},{maxPerMinute:13},{maxPerMinute:1.5},
    {maxSecondsPerMinute:0},{maxSecondsPerMinute:61},{maxDurationMs:11000,maxSecondsPerMinute:10},
    {provider:'openclaw'}]) assert.throws(()=>validateBackgroundPlayback({schemaVersion:1,rules:[{...rule(),...patch}]}));
  assert.throws(()=>validateBackgroundPlayback({schemaVersion:1,rules:[rule(),rule()]}));
  assert.throws(()=>validateBackgroundPlayback({schemaVersion:1,rules:Array.from({length:17},(_,i)=>({...rule(),id:`rule-${i}`}))}));
  assert.throws(()=>validateBackgroundPlayback({schemaVersion:1,rules:new Array(1)}));
  let accessed=false;
  const value={schemaVersion:1,get rules(){accessed=true;return [];}};
  assert.throws(()=>validateBackgroundPlayback(value));assert.equal(accessed,false);
  const hidden=[rule()];Object.defineProperty(hidden,'0',{enumerable:false});
  assert.throws(()=>validateBackgroundPlayback({schemaVersion:1,rules:hidden}));
  const coercion={toString(){accessed=true;return 'valid-id';}};
  assert.throws(()=>validateBackgroundPlayback({schemaVersion:1,rules:[{...rule(),id:coercion}]}));assert.equal(accessed,false);
});

test('reference validation requires explicit background grants, a base, and video rule assets',()=>{
  const {project,lane}=fixture(),options={assets:project.layerAssets,allowed:lane.layers.background.allowed,defaultAssetId:id(1)};
  for(const patch of [{defaultAssetId:null},{defaultAssetId:id(3)},{allowed:[id(1)]},
    {assets:[asset(1,'image/png'),asset(2,'image/png')]},{assets:[asset(1,'image/png'),asset(2,'video/mp4','table')]}]) {
    assert.throws(()=>validateBackgroundPlayback(policy(),{...options,...patch}));
  }
  for(const mutate of [p=>p.lanes[0].layers.background.enabled=false,
    p=>p.lanes[0].layers.background.allowed=[id(1)],p=>p.layerAssets=p.layerAssets.filter(asset=>asset.id!==id(2)),
    p=>p.layerAssets[1]=asset(2,'image/png')]) {
    const draft=structuredClone(project);mutate(draft);assert.throws(()=>validateProject(draft));
  }
  assert.doesNotThrow(()=>validateProject(project));
});

test('publication freezes rules and asset hashes, transports them to the game, and grants only selected operator media',async()=>{
  const {project,lane}=fixture();
  const captured=cloudPresentationFixture({project,lanes:[lane]}),presentation=captured.presentation;
  const pack={operatorId:'north',revision:1,lanes:[lane.id],games:['blackjack'],tables:[],branding:withPackagePresentation({},presentation)};
  project.lanes[0].backgroundPlayback.rules[0].assetId=id(3);project.layerAssets[1].sha256='b'.repeat(64);
  assert.deepEqual(readPackagePresentation(pack),presentation);
  assert.deepEqual(presentation.assets.map(asset=>asset.id),[id(1),id(2)]);
  const admin={gameLane:lane.id,gameLanes:[{schemaVersion:1,id:lane.id,label:'Fixture',renderer:'portrait-video',dealer:'astrid',mediaCollection:'astrid-presentation'}]};
  const select=createGameEntrySelector({policy:{readSaved:async()=>({project:captured.project,administration:admin}),readGameConfiguration:async()=>admin},
    packages:{resolve:async slug=>slug==='north'?{operator:{id:'north'},package:pack}:null}});
  const {selection}=await select('?operator=north');
  assert.deepEqual(selection.composition.backgroundPlayback,policy());
  assert.match(selection.composition.assets.find(asset=>asset.id===id(2)).src,/^\/api\/presentation\/layers\/north\//);
  let reads=0;
  const serve=createPublishedLayerAssets({packages:{resolve:async slug=>slug==='north'?{operator:{id:'north'},package:pack}:null},privateMedia:async()=>{reads++;return new Response('verified');}});
  assert.equal((await serve(new Request(`https://example.invalid/api/presentation/layers/north/${id(2)}`))).status,200);
  for(const [slug,assetId] of [['south',id(2)],['north',id(3)]]) assert.equal((await serve(new Request(`https://example.invalid/api/presentation/layers/${slug}/${assetId}`))).status,404);
  assert.equal(reads,1);
  const corrupt=structuredClone(presentation);corrupt.lanes[0].backgroundPlayback.rules[0].assetId=id(3);
  assert.throws(()=>validatePresentationPackage(corrupt));
});

test('archiving a different lane preserves rule assets and archiving its owner prunes only unreferenced layers',()=>{
  const {project,lane}=fixture(),other=structuredClone(lane);other.id='other-room';delete other.backgroundPlayback;
  other.layers.background={enabled:true,mode:'video',default:id(3),allowed:[id(3)]};project.lanes.push(other);
  const {presentation}=cloudPresentationFixture({project,lanes:project.lanes});
  const survivor=withoutPresentationLanes(presentation,[other.id]);
  assert.deepEqual(survivor.lanes[0].backgroundPlayback,policy());assert.deepEqual(survivor.assets.map(asset=>asset.id),[id(1),id(2)]);
  const remaining=withoutPresentationLanes(presentation,[lane.id]);
  assert.deepEqual(remaining.assets.map(asset=>asset.id),[id(3)]);
  assert.equal(Object.hasOwn(remaining.lanes[0],'backgroundPlayback'),false);
});

test('v24 timer jitter and table playback: bounded jitter, table role assets, older shapes unchanged', async () => {
  const {validateLayerPlayback,defaultLayerRule,playbackUsesJitter,LAYER_PLAYBACK_ROLES}=await import('../packages/presentation/contracts/background-playback-policy.mjs');
  const {createBackgroundPlayback}=await import('../packages/presentation/runtime/background-playback.mjs');
  assert.deepEqual(LAYER_PLAYBACK_ROLES,['background','table']);
  const living=defaultLayerRule(id(2),'living');
  assert.deepEqual(living.trigger,{everyMs:195000,jitterMs:74000});assert.equal(living.maxPerMinute,1);
  assert.equal(playbackUsesJitter({schemaVersion:1,rules:[living]}),true);assert.equal(playbackUsesJitter(policy()),false);assert.equal(playbackUsesJitter(undefined),false);
  assert.deepEqual(validateBackgroundPlayback({schemaVersion:1,rules:[{...rule(),trigger:{everyMs:25000,jitterMs:0}}]}).rules[0].trigger,{everyMs:25000,jitterMs:0});
  for(const trigger of [{everyMs:25000,jitterMs:25000},{everyMs:25000,jitterMs:-1},{everyMs:25000,jitterMs:120001},{everyMs:25000,jitterMs:'7'},{eventId:'speak.win',jitterMs:1000},{everyMs:300000,jitterMs:120001}])
    assert.throws(()=>validateBackgroundPlayback({schemaVersion:1,rules:[{...rule(),trigger}]}),/Invalid background playback policy/,JSON.stringify(trigger));
  // Table rules resolve against table assets only; a background video is not a table clip.
  const table=asset(5,'video/mp4','table'),tableBase=asset(6,'image/png','table');
  const tableRule={...defaultLayerRule(id(5),'felt',{role:'table'})};
  assert.doesNotThrow(()=>validateLayerPlayback({schemaVersion:1,rules:[tableRule]},{role:'table',assets:[table,tableBase],allowed:[id(5),id(6)],defaultAssetId:id(6)}));
  assert.throws(()=>validateLayerPlayback({schemaVersion:1,rules:[tableRule]},{role:'table',assets:[asset(5),tableBase],allowed:[id(5),id(6)],defaultAssetId:id(6)}),/Invalid/);
  assert.throws(()=>validateLayerPlayback({schemaVersion:1,rules:[tableRule]},{role:'dealer'}),/Invalid/);
  // The project accepts tablePlayback on a lane only with an enabled table layer and table clips.
  const {project,lane}=fixture();
  project.layerAssets.push(table,tableBase);
  lane.layers.table={enabled:true,default:id(6),allowed:[id(6),id(5)]};lane.tablePlayback={schemaVersion:1,rules:[tableRule]};
  assert.doesNotThrow(()=>validateProject(project));
  const disabled=structuredClone(project);disabled.lanes[0].layers.table.enabled=false;
  assert.throws(()=>validateProject(disabled),/tablePlayback/);
  const foreign=structuredClone(project);foreign.lanes[0].tablePlayback.rules[0].assetId=id(2);
  assert.throws(()=>validateProject(foreign),/tablePlayback/);
  // The scheduler draws each start from everyMs ± jitterMs with the injected source; 0.5 is the mean.
  const starts=[];let draws=[1,0,0.5];
  function clock(){let at=0,n=0;const timers=new Map();return {now:()=>at,setTimeout:(fn,ms)=>{timers.set(++n,{fn,at:at+ms});return n;},clearTimeout:k=>timers.delete(k),
    advance(ms){const end=at+ms;for(;;){const next=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next){at=end;return;}timers.delete(next[0]);at=next[1].at;next[1].fn();}}};}
  const timer=clock();
  const player=createBackgroundPlayback({schemaVersion:1,rules:[{...living,maxDurationMs:1000,cooldownMs:0,maxPerMinute:12,maxSecondsPerMinute:60}]},{...timer,random:()=>draws.shift()??0.5,onStart:(r,token)=>{starts.push(timer.now());queueMicrotask(()=>{});}});
  player.start();
  timer.advance(195000+74000-1);assert.equal(starts.length,0);timer.advance(1);assert.deepEqual(starts,[269000]);
  timer.advance(195000-74000);assert.deepEqual(starts,[269000,269000+121000]);
  timer.advance(195000);assert.equal(starts.length,3);assert.equal(starts[2]-starts[1],195000);
  player.close();
});
