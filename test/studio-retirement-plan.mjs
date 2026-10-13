import test from 'node:test';
import assert from 'node:assert/strict';
import { addDealer, createEmptyProject, defaultPresentationLane, validateProject } from '../lab/lib/studio-model.mjs';
import { layerAssetPath } from '../web/layer-asset-contract.mjs';
import { planStudioRetirement, transformStudioRetirement, retirementSnapshotHash } from '../tools/studio-retirement-plan.mjs';

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const hash = 'a'.repeat(64), clone = structuredClone;
const candidate = 'paow', keep = 'astrid', mediaId = uuid(1);
function media(dealerId = candidate, id = mediaId) {
  const record = {id, sha256:hash, size:32, contentType:'video/mp4',
    pathname:`croupier/media/dealers/${dealerId}/review/uploads/${id}/${hash}.mp4`,
    classification:{dealerId,eventId:'idle.ready',kind:'idle',role:'alternative',situation:'',label:'Clip',notes:''}};
  return {id, revision:'media-1', record};
}
const mediaFile = row => ({pathname:row.record.pathname,sha256:row.record.sha256,size:row.record.size,present:true,owners:[{kind:'media',id:row.id}]});
function layer(role, n, game) {
  const asset = {schemaVersion:1,id:uuid(n),role,label:`${role} ${n}`,sha256:hash,size:32,contentType:'image/png',width:100,height:100};
  if (game) asset.game = game;
  asset.pathname = layerAssetPath(asset); return asset;
}
const packageValue = branding => ({lanes:[],games:['blackjack'],tables:[],branding});
const forgeAnchor = pose => ({pathname:`croupier/forge/paow/${pose}.png`,sha256:hash,size:32,contentType:'image/png',width:100,height:100});
function addForgeAnchors(state) {
  const vila=forgeAnchor('vila'), redo=forgeAnchor('redo');
  state.forge.profiles=[{dealerId:candidate,revision:1,profile:{anchors:{vila,redo}}}];
  for (const anchor of [vila,redo]) state.files.push({pathname:anchor.pathname,sha256:anchor.sha256,size:anchor.size,present:true,owners:[{kind:'forgeProfile',id:candidate}]});
  return {vila,redo};
}
function snapshot() {
  let project = addDealer(addDealer(createEmptyProject(),keep,'Astrid'),candidate,'PAOW');
  const lane = defaultPresentationLane(candidate); lane.id='paow-only';
  project.lanes = [lane];
  project.lines.find(row => row.dealerId === candidate && row.eventId === 'idle.ready').variants[0].videoGenerationId=mediaId;
  project.clipLabels = {[mediaId]:'Clip'};
  validateProject(project);
  const row = media();
  return {schemaVersion:1,scope:{environment:'test',workspaceId:'offline-retirement'},
    coverage:Object.fromEntries(['documents','media','operators','packages','history','forge','references','files'].map(key => [key,true])),
    documents:{project:{revision:project.revision,value:project},administration:{revision:'admin-1',value:{rooms:[],gameLanes:[],gameLane:null}}},
    media:[row],operators:[],packages:[],history:[],forge:{profiles:[],jobs:[]},references:[],files:[mediaFile(row)]};
}
const selection = () => ({remove:{dealerIds:[candidate]},protect:{dealerIds:[keep,'dragan','anna-jonsson'],games:['roulette'],allBackgrounds:true}});
const run = (state, selected=selection()) => { const plan=planStudioRetirement(state,selected); return {plan,result:()=>transformStudioRetirement(state,plan,{expectedToken:plan.token})}; };
const codes = plan => plan.blockers.map(row => row.code);

 test('permanent retirement produces exact removals without mutating input or creating trash', () => {
  const state=snapshot(), before=clone(state), {plan,result}=run(state);
  assert.equal(plan.ready,true,JSON.stringify(plan.blockers));
  assert.deepEqual(plan.remove.dealerIds,['paow']); assert.deepEqual(plan.remove.mediaIds,[mediaId]);
  assert.deepEqual(plan.remove.compositionIds,['paow-only']);
  const after=result().snapshot;
  assert.deepEqual(after.documents.project.value.dealers.map(row=>row.id),['astrid']);
  assert.equal(after.documents.project.value.lines.some(row=>row.dealerId===candidate),false);
  assert.equal(after.media.length,0); assert.equal(after.files.length,0);
  assert.equal(after.documents.project.value.dealerTrash,undefined);
  assert.deepEqual(after.documents.project.value.assets,before.documents.project.value.assets);
  assert.equal(result().deleteFiles[0].pathname,state.files[0].pathname);
  assert.deepEqual(state,before); assert.equal(after.documents.project.revision,before.documents.project.revision);
 });
 test('hash and plan are deterministic under JSON key reordering', () => {
  const state=snapshot(), reversed=Object.fromEntries(Object.entries(state).reverse());
  assert.equal(retirementSnapshotHash(state),retirementSnapshotHash(reversed));
  assert.deepEqual(planStudioRetirement(state,selection()),planStudioRetirement(reversed,selection()));
 });
 test('CAS detects revision, same-revision content, new historical rows, file owners and scope changes', () => {
  const original=snapshot(), plan=planStudioRetirement(original,selection());
  for (const change of [
    s=>{s.media[0].revision='media-2';},
    s=>{s.documents.project.value.dealers[0].label='Changed';},
    s=>{s.history.push({id:'history-new',kind:'project',revision:'old-1',value:{dealerId:'paow'}});},
    s=>{s.files[0].owners.push({kind:'external',id:'other-workspace'});},
    s=>{s.scope.workspaceId='other';},
  ]) { const stale=clone(original); change(stale); assert.throws(()=>transformStudioRetirement(stale,plan,{expectedToken:plan.token}),{code:'retirement_conflict'}); }
 });
 test('tampered plan or missing expected token cannot be transformed', () => {
  const state=snapshot(), plan=planStudioRetirement(state,selection()), changed=clone(plan);
  changed.remove.mediaIds=[];
  assert.throws(()=>transformStudioRetirement(state,changed,{expectedToken:plan.token}),{code:'retirement_conflict'});
  assert.throws(()=>transformStudioRetirement(state,plan),{code:'retirement_conflict'});
 });
 test('every inventory coverage boundary is mandatory, including empty tables', () => {
  for (const key of Object.keys(snapshot().coverage)) {
    const state=snapshot(); delete state.coverage[key]; const {plan,result}=run(state);
    assert.equal(plan.ready,false); assert.ok(plan.blockers.some(row=>row.code==='coverage_incomplete'&&row.subject===key));
    assert.throws(result,{code:'retirement_blocked'});
  }
 });
 test('shared mobile-phone composition keeps protected dealers, geometry and background/table choices', () => {
  const state=snapshot(), lane=defaultPresentationLane(keep);
  lane.dealers.push(candidate); lane.layers.dealer.allowed.push(candidate); lane.label='Shared';
  state.documents.project.value.lanes.push(lane);
  const before=clone(lane), {plan,result}=run(state);
  assert.equal(plan.ready,true,JSON.stringify(plan.blockers)); assert.deepEqual(plan.inventory.sharedCompositions[0].retainedDealerIds,[keep]);
  const kept=result().snapshot.documents.project.value.lanes[0];
  assert.equal(kept.id,'mobile-phone'); assert.deepEqual(kept.layers.background,before.layers.background); assert.deepEqual(kept.layers.table,before.layers.table);
  assert.deepEqual(kept.layers.dealer,{...before.layers.dealer,allowed:[keep]});
 });
 test('shared composition selected for deletion is protected, never cascaded', () => {
  const state=snapshot(), lane=defaultPresentationLane(keep); lane.dealers.push(candidate); lane.layers.dealer.allowed.push(candidate);
  state.documents.project.value.lanes.push(lane); const choice=selection(); choice.remove.compositionIds=['mobile-phone'];
  assert.ok(codes(run(state,choice).plan).includes('protected_resource'));
 });
 test('removing a shared default requires an exact surviving replacement', () => {
  const state=snapshot(), lane=defaultPresentationLane(candidate); lane.id='shared'; lane.dealers.push(keep); lane.layers.dealer.allowed.push(keep);
  state.documents.project.value.lanes.push(lane);
  assert.ok(codes(run(state).plan).includes('dealer_default_required'));
  const choice=selection(); choice.replacements={dealerDefaults:{shared:keep}};
  const {plan,result}=run(state,choice); assert.equal(plan.ready,true,JSON.stringify(plan.blockers));
  assert.equal(result().snapshot.documents.project.value.lanes[0].layers.dealer.default,keep);
 });
 test('candidate-owned media used by a retained dealer blocks instead of detaching speech', () => {
  const state=snapshot(); state.documents.project.value.lines.find(row=>row.dealerId===keep&&row.eventId==='idle.ready').variants[0].videoGenerationId=mediaId;
  assert.ok(codes(run(state).plan).includes('retained_reference'));
 });
 test('an exact label or a composition name containing a dealer ID is not ownership', () => {
  const state=snapshot(), lane=defaultPresentationLane(keep); lane.id='johns-johanna'; lane.label='paow';
  state.documents.project.value.lanes.push(lane);
  const {plan,result}=run(state); assert.equal(plan.ready,true,JSON.stringify(plan.blockers));
  assert.equal(result().snapshot.documents.project.value.lanes[0].id,'johns-johanna');
 });
 test('all operator rooms and all frozen package revisions are enumerated separately', () => {
  const state=snapshot(); state.operators=[{id:'nordic-bet',status:'active'},{id:'keep-company',status:'active'}];
  state.documents.administration.value.rooms=[{id:'old-room',operatorId:'nordic-bet',dealer:candidate},{id:'new-room',operatorId:'keep-company',dealer:keep}];
  state.packages=[{key:'nordic-bet@1',operatorId:'nordic-bet',revision:1,current:false,value:packageValue({dealer:candidate})},{key:'nordic-bet@2',operatorId:'nordic-bet',revision:2,current:true,value:packageValue({dealer:candidate})},{key:'keep-company@1',operatorId:'keep-company',revision:1,current:true,value:packageValue({dealer:keep})}];
  const choice=selection(); choice.remove.operatorIds=['nordic-bet']; const {plan,result}=run(state,choice);
  assert.equal(plan.ready,true,JSON.stringify(plan.blockers)); assert.deepEqual(plan.remove.packageKeys,['nordic-bet@1','nordic-bet@2']);
  assert.deepEqual(plan.inventory.packages.map(row=>row.current),[false,true]);
  assert.deepEqual(result().snapshot.packages,[state.packages[2]]); assert.deepEqual(result().snapshot.documents.administration.value.rooms,[state.documents.administration.value.rooms[1]]);
 });
 test('retained frozen publication and document history block until exact whole rows are selected', () => {
  const state=snapshot(); state.operators=[{id:'company'}];
  state.packages=[{key:'company@1',operatorId:'company',revision:1,current:false,value:packageValue({dealer:candidate})}];
  const historic=clone(state.documents.project.value);
  historic.dealers=historic.dealers.filter(row=>row.id===candidate); historic.lines=historic.lines.filter(row=>row.dealerId===candidate);
  state.history=[{id:'history-1',kind:'project',revision:'historic-1',value:historic}];
  assert.equal(run(state).plan.ready,false);
  const choice=selection(); choice.remove.packageKeys=['company@1']; choice.remove.historyIds=['history-1'];
  const {plan,result}=run(state,choice); assert.equal(plan.ready,true,JSON.stringify(plan.blockers));
  assert.deepEqual(result().snapshot.history,[]); assert.deepEqual(plan.inventory.history,[{id:'history-1',kind:'project',revision:'historic-1'}]);
 });
 test('serialized SQL package columns are decoded before checking frozen references', () => {
  const state=snapshot(), value={lanes:['paow-only'],games:['blackjack'],tables:[],branding:{_scoutPresentation:{media:[{id:mediaId}],dealers:[{id:candidate}]}}};
  state.packages=[{key:'company@1',operatorId:'company',revision:1,current:false,value:Object.fromEntries(Object.entries(value).map(([key,item])=>[key,JSON.stringify(item)]))}];
  const plan=run(state).plan;
  for (const id of [candidate,mediaId,'paow-only']) assert.ok(plan.blockers.some(row=>row.code==='retained_reference'&&row.details.includes(id)));
  const decoded=clone(state); decoded.packages[0].value=value;
  assert.deepEqual(plan,run(decoded).plan,'the same decoded publication has the same CAS plan');
 });
 test('missing, malformed, double-encoded and wrongly typed package columns fail closed', () => {
  const base=packageValue({});
  for (const value of [
    {branding:{}}, {...base,branding:'{'}, {...base,branding:JSON.stringify('{}')},
    ...['lanes','games','tables'].map(key=>({...base,[key]:'{}'})), {...base,branding:'[]'},
    {...base,unknownJson:'{"dealerId":"paow"}'}, {...base,branding:{_scoutPresentation:'{"dealerId":"paow"}'}},
  ]) {
    const state=snapshot(); state.packages=[{key:'company@1',operatorId:'company',revision:1,current:false,value}];
    assert.throws(()=>run(state),{code:'retirement_invalid_snapshot'});
  }
 });
 test('selected shared history containing protected Astrid or Anna is never removed whole', () => {
  for (const dealerId of [keep,'anna-jonsson']) {
    const state=snapshot(), historic=dealerId===keep?clone(state.documents.project.value):addDealer(clone(state.documents.project.value),dealerId,'Anna');
    state.history=[{id:'shared-history',kind:'project',revision:'historic-1',value:historic}];
    const choice=selection(); choice.remove.historyIds=['shared-history']; const {plan,result}=run(state,choice);
    assert.ok(plan.blockers.some(row=>row.code==='protected_history'&&row.subject==='shared-history'&&row.details.includes(dealerId)));
    assert.throws(result,{code:'retirement_blocked'});
  }
 });
 test('explicit protected material identities and paths also protect historical-only references', () => {
  const cases=[['mediaIds',uuid(50),'videoGenerationId'],['layerAssetIds',uuid(51),'backgroundId'],['animationAssetIds','saved-animation','animationAssetId'],['filePathnames','croupier/protected/original.png','pathname']];
  for (const [field,id,key] of cases) {
    const state=snapshot(); state.history=[{id:'material-history',kind:'project',revision:'historic-1',value:{dealerId:candidate,[key]:id}}];
    const choice=selection(); choice.remove.historyIds=['material-history']; choice.protect[field]=[id];
    assert.ok(run(state,choice).plan.blockers.some(row=>row.code==='protected_history'&&row.details.includes(id)));
  }
 });
 test('all-background protection includes assets that exist only in a historical project', () => {
  const state=snapshot(), background=layer('background',70);
  state.history=[{id:'background-history',kind:'project',revision:'historic-1',value:{dealerId:candidate,layerAssets:[background]}}];
  const choice=selection(); choice.remove.historyIds=['background-history'];
  assert.ok(run(state,choice).plan.blockers.some(row=>row.code==='protected_history'&&row.details.includes(background.id)));
 });
 test('a historical display label matching a protected dealer is not ownership', () => {
  const state=snapshot(); state.history=[{id:'candidate-history',kind:'project',revision:'historic-1',value:{dealerId:candidate,label:keep}}];
  const choice=selection(); choice.remove.historyIds=['candidate-history'];
  assert.equal(run(state,choice).plan.ready,true);
 });
 test('media tombstones are not confused with physical objects or lost from candidate enumeration', () => {
  const state=snapshot(), old=media(candidate,uuid(2));
  old.record.classification.archived=true; old.record.deletion={state:'deleted',requestedAt:'2026-10-01T00:00:00.000Z',completedAt:'2026-10-02T00:00:00.000Z'};
  state.media.push(old); const {plan,result}=run(state);
  assert.equal(plan.ready,true,JSON.stringify(plan.blockers)); assert.equal(plan.inventory.media.length,2); assert.equal(plan.inventory.media[1].state,'deleted');
  assert.equal(result().deleteFiles.length,1);
 });
 test('pending media deletion blocks a competing retirement', () => {
  const state=snapshot(); state.media[0].record.classification.archived=true;
  state.media[0].record.deletion={state:'pending',requestedAt:'2026-10-01T00:00:00.000Z'};
  assert.ok(codes(run(state).plan).includes('media_deletion_pending'));
 });
 test('equal hashes with distinct paths never delete a protected dealer file', () => {
  const state=snapshot(), other=media(keep,uuid(2)); state.media.push(other); state.files.push(mediaFile(other));
  const {plan,result}=run(state); assert.equal(plan.ready,true);
  assert.deepEqual(result().deleteFiles.map(row=>row.pathname),[state.files[0].pathname]);
  assert.deepEqual(result().snapshot.media,[other]); assert.deepEqual(result().snapshot.files,[state.files[1]]);
 });
 test('physical ownership shared outside this workspace retains the object', () => {
  const state=snapshot(); state.files[0].owners.push({kind:'external',id:'retained-workspace'});
  const {plan,result}=run(state); assert.equal(plan.ready,true,JSON.stringify(plan.blockers));
  assert.equal(plan.inventory.retainedSharedFiles.length,1); assert.deepEqual(result().deleteFiles,[]);
  assert.deepEqual(result().snapshot.files[0].owners,[{kind:'external',id:'retained-workspace'}]);
  const explicit=selection(); explicit.remove.filePathnames=[state.files[0].pathname];
  assert.ok(codes(run(state,explicit).plan).includes('shared_file'));
 });
 test('missing object ownership, unknown owners and hash drift cannot produce a ready plan', () => {
  for (const change of [s=>{s.files=[];},s=>{s.files[0].owners=[];},s=>{s.files[0].owners=[{kind:'media',id:'missing'}];},s=>{s.files[0].sha256='b'.repeat(64);}]) {
    const state=snapshot(); change(state); assert.equal(run(state).plan.ready,false);
  }
 });
 test('Forge profiles, terminal jobs and their two anchors are separately inventoried', () => {
  const state=snapshot(); addForgeAnchors(state);
  state.forge.jobs=[{jobId:'job-1',dealerId:candidate,status:'cancelled',result:null}];
  const {plan,result}=run(state); assert.equal(plan.ready,true,JSON.stringify(plan.blockers));
  assert.deepEqual(plan.remove.forgeJobIds,['job-1']); assert.deepEqual(plan.remove.forgeProfileIds,[candidate]);
  assert.equal(result().deleteFiles.length,3); assert.deepEqual(result().snapshot.forge,{profiles:[],jobs:[]});
 });
 test('complete coverage cannot replace Forge anchor file, owner and integrity evidence', () => {
  for (const [code,change] of [
    ['file_evidence_missing',s=>{s.files=s.files.filter(row=>row.pathname!==forgeAnchor('vila').pathname);}],
    ['file_owner_missing',s=>{s.files[1].owners=[{kind:'dealer',id:candidate}];}],
    ['file_integrity_mismatch',s=>{s.files[1].sha256='b'.repeat(64);}],
    ['file_integrity_mismatch',s=>{s.files[1].size++;}],
  ]) {
    const state=snapshot(); addForgeAnchors(state); change(state); const {plan,result}=run(state);
    assert.equal(state.coverage.files,true); assert.ok(codes(plan).includes(code)); assert.throws(result,{code:'retirement_blocked'});
  }
 });
 test('a completed Forge pose job must independently own its result anchor', () => {
  const state=snapshot(), anchor=forgeAnchor('unused-pose');
  state.forge.jobs=[{jobId:'pose-job',dealerId:candidate,status:'succeeded',result:{anchor,adopted:false}}];
  assert.ok(codes(run(state).plan).includes('file_evidence_missing'));
  state.files.push({pathname:anchor.pathname,sha256:anchor.sha256,size:anchor.size,present:true,owners:[{kind:'dealer',id:candidate}]});
  assert.ok(codes(run(state).plan).includes('file_owner_missing'));
  state.files.at(-1).owners=[{kind:'forgeJob',id:'pose-job'}];
  assert.equal(run(state).plan.ready,true);
 });
 test('malformed or encoded Forge anchors cannot masquerade as complete inventory', () => {
  for (const change of [
    s=>{s.forge.profiles[0].profile.anchors.vila.pathname='../other.png';},
    s=>{delete s.forge.profiles[0].profile.anchors.vila.sha256;},
    s=>{s.forge.profiles[0].profile.anchors='unread';},
    s=>{delete s.forge.profiles[0].profile.anchors;},
    s=>{s.forge.jobs=[{jobId:'pose-job',dealerId:candidate,status:'succeeded',result:JSON.stringify({anchor:forgeAnchor('vila')})}];},
  ]) {
    const state=snapshot(); addForgeAnchors(state); change(state);
    assert.throws(()=>run(state),{code:'retirement_invalid_snapshot'});
  }
 });
 test('generated, running, unknown and committing Forge jobs cannot be silently dropped', () => {
  for (const status of ['generated','running','submit_unknown','committing']) {
    const state=snapshot(); state.forge.jobs=[{jobId:'job-1',dealerId:candidate,status}];
    assert.ok(codes(run(state).plan).includes('forge_job_not_terminal'));
  }
 });
 test('backgrounds, protected dealers and explicitly registered roulette table assets cannot be retired', () => {
  const state=snapshot(), background=layer('background',10), table=layer('table',11,'roulette');
  state.documents.project.value.layerAssets=[background,table];
  for (const asset of [background,table]) state.files.push({pathname:asset.pathname,sha256:asset.sha256,size:asset.size,present:true,owners:[{kind:'layerAsset',id:asset.id}]});
  const choice=selection(); choice.remove.layerAssetIds=[background.id,table.id]; choice.remove.dealerIds.push(keep);
  const {plan}=run(state,choice);
  assert.equal(plan.ready,false); assert.equal(plan.blockers.filter(row=>row.code==='protected_resource').length>=3,true);
 });
 test('an old table is never inferred from name, and an exact selected table requires explicit default removal', () => {
  const state=snapshot(), table=layer('table',10,'blackjack'), lane=defaultPresentationLane(keep); lane.label='Old Johanna table';
  state.documents.project.value.layerAssets=[table]; lane.layers.table={enabled:true,default:table.id,allowed:[table.id]}; state.documents.project.value.lanes.push(lane);
  state.files.push({pathname:table.pathname,sha256:table.sha256,size:table.size,present:true,owners:[{kind:'layerAsset',id:table.id}]});
  assert.deepEqual(run(state).plan.remove.layerAssetIds,[]);
  const choice=selection(); choice.remove.layerAssetIds=[table.id]; assert.ok(codes(run(state,choice).plan).includes('layer_default_required'));
  choice.replacements={layerDefaults:{'mobile-phone':{table:null}}}; const {plan,result}=run(state,choice);
  assert.equal(plan.ready,true,JSON.stringify(plan.blockers)); assert.deepEqual(result().snapshot.documents.project.value.lanes[0].layers.table,{enabled:true,default:null,allowed:[]});
 });
 test('generic retained consumers are not erased by an operator cascade', () => {
  const state=snapshot(); state.operators=[{id:'company'}]; state.references=[{id:'membership-1',kind:'membership',value:{operatorId:'company',userId:'keep-user'}}];
  const choice=selection(); choice.remove.operatorIds=['company'];
  const {plan}=run(state,choice); assert.ok(plan.blockers.some(row=>row.code==='retained_reference'&&row.details.includes('company')));
 });
 test('unknown IDs, duplicate rows, unsafe paths and unsupported selection fields fail closed', () => {
  const choice=selection(); choice.remove.dealerIds=['paow-typo']; assert.ok(codes(run(snapshot(),choice).plan).includes('selected_resource_missing'));
  const dup=snapshot(); dup.media.push(clone(dup.media[0])); assert.throws(()=>run(dup),{code:'retirement_invalid_snapshot'});
  const unsafe=snapshot(); unsafe.files[0].pathname='../shared.mp4'; assert.throws(()=>run(unsafe),{code:'retirement_invalid_snapshot'});
  assert.throws(()=>run(snapshot(),{remove:{dealerNames:['PAOW']}}),{code:'retirement_invalid_selection'});
 });
 test('an unresolved decision is CAS-bound and blocks the dealer and its owned media', () => {
  const state=snapshot(); state.holds=[{code:'conflict-paow',field:'dealerIds',id:candidate}];
  assert.ok(codes(run(state).plan).includes('conflict-paow'));
  const explicit={remove:{mediaIds:[mediaId]},protect:{dealerIds:[keep]}};
  assert.ok(codes(run(state,explicit).plan).includes('conflict-paow'));
  assert.equal(planStudioRetirement(state,{remove:{},protect:{dealerIds:[candidate,keep]}}).ready,true);
 });
