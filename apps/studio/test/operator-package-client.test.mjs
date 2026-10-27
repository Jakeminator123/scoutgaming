import test from 'node:test';
import assert from 'node:assert/strict';
import {markPackagesStale, packageEditor, packageSelectionDirty, publishOperatorPackage, rebasePackageEditors, togglePackageLane, verifiedPackageRevision, PACKAGE_RECEIPT_MISMATCH, PACKAGE_UNCONFIRMED} from '../lib/operator-package-client.mjs';

const north=()=>({id:'north',slug:'north',name:'North',status:'active',publishedPackage:{revision:4,lanes:['mobile-phone']}});
const snapshotOperator=(extra={})=>({id:'north',slug:'north',name:'North',status:'active',packageRevision:4,lanes:['mobile-phone'],archivedAt:null,...extra});

test('an unknown assignment needs readback, a known one seeds the published lanes as baseline',()=>{
  assert.equal(packageEditor(undefined).needsRefresh,true);assert.equal(packageEditor({id:'x'}).needsRefresh,true);
  const editor=packageEditor(north());
  assert.deepEqual(editor,{chosen:['mobile-phone'],baseline:['mobile-phone'],revision:4,message:'',error:'',needsRefresh:false});
  assert.equal(packageEditor({...north(),publishedPackage:null}).revision,null);
  assert.equal(packageSelectionDirty(editor),false);
  const changed=togglePackageLane({...editor,message:'old',error:'old'},'evening',true);
  assert.deepEqual(changed.chosen,['mobile-phone','evening']);assert.equal(changed.message,'');assert.equal(changed.error,'');
  assert.equal(packageSelectionDirty(changed),true);
  assert.deepEqual(togglePackageLane(changed,'mobile-phone',false).chosen,['evening']);
  assert.deepEqual(togglePackageLane(changed,'evening',true).chosen,['mobile-phone','evening'],'no duplicates');
});

test('a snapshot rebases draft additions and removals, never rolls back and keeps only a current receipt',()=>{
  const draft={...packageEditor(north()),chosen:['evening'],message:'Version 4'};
  const next=rebasePackageEditors({north:draft},[snapshotOperator({packageRevision:5,lanes:['mobile-phone','vip']})]);
  assert.deepEqual(next.north.chosen,['vip','evening'],'removal of mobile-phone and addition of evening survive');
  assert.deepEqual(next.north.baseline,['mobile-phone','vip']);assert.equal(next.north.revision,5);
  assert.equal(next.north.message,'','a receipt for an older revision is not this publication');assert.equal(next.north.needsRefresh,false);
  const same=rebasePackageEditors({north:draft},[snapshotOperator()]);
  assert.equal(same.north.message,'Version 4');
  const older=rebasePackageEditors({north:{...draft,revision:6}},[snapshotOperator({packageRevision:5})]);
  assert.equal(older.north.revision,6,'an older snapshot cannot roll the editor back');
  const fresh=rebasePackageEditors({},[snapshotOperator({id:'south',packageRevision:null,lanes:[]})]);
  assert.deepEqual(fresh.south,{chosen:[],baseline:[],revision:null,message:'',error:'',needsRefresh:false});
  assert.deepEqual(markPackagesStale({north:draft}).north.needsRefresh,true);
});

test('only the exact receipt for this company, these lanes and the next revision is accepted',()=>{
  const expected={operatorId:'north',lanes:['evening','mobile-phone'],revision:4};
  const receipt=()=>({ok:true,operatorId:'north',packageRevision:5,package_revision:5,lanes:['mobile-phone','evening']});
  assert.equal(verifiedPackageRevision(receipt(),expected),5);
  assert.equal(verifiedPackageRevision(receipt(),{...expected,revision:null}),null,'a new package expects revision 1');
  assert.equal(verifiedPackageRevision({ok:true,operatorId:'new',packageRevision:1,lanes:['a']},{operatorId:'new',lanes:['a'],revision:null}),1);
  for(const change of [row=>({...row,ok:false}),row=>({...row,operatorId:'south'}),row=>({...row,lanes:['mobile-phone']}),row=>({...row,lanes:['evening','evening']}),
    row=>({...row,packageRevision:4,package_revision:4}),row=>({...row,packageRevision:999,package_revision:999}),row=>({...row,packageRevision:'5',package_revision:'5'}),row=>({...row,package_revision:6}),()=>null])
    assert.equal(verifiedPackageRevision(change(receipt()),expected),null);
});

test('publishing sends the displayed revision as CAS and maps failures without dropping the selection',async()=>{
  const calls=[];
  const fetchImpl=async(url,options)=>{calls.push({url,body:JSON.parse(options.body),credentials:options.credentials});return Response.json({ok:true,operatorId:'north',packageRevision:5,lanes:['mobile-phone','evening']});};
  const input={endpoint:'/studio/api/admin/operator-package',operatorId:'north',lanes:['mobile-phone','evening'],revision:4,fetchImpl};
  assert.deepEqual(await publishOperatorPackage(input),{ok:true,revision:5});
  assert.deepEqual(calls[0].body,{operatorId:'north',lanes:['mobile-phone','evening'],expectedPackageRevision:4});assert.equal(calls[0].credentials,'same-origin');
  assert.deepEqual(await publishOperatorPackage({...input,revision:null,fetchImpl:async()=>Response.json({ok:true,operatorId:'north',packageRevision:1,lanes:['mobile-phone','evening']})}),{ok:true,revision:1});
  const conflict=await publishOperatorPackage({...input,fetchImpl:async()=>Response.json({error:'studio_conflict'},{status:409})});
  assert.equal(conflict.ok,false);assert.equal(conflict.needsRefresh,true);assert.match(conflict.error,/Paketet kunde inte uppdateras/);
  const invalid=await publishOperatorPackage({...input,fetchImpl:async()=>Response.json({error:'studio_presentation_required'},{status:422})});
  assert.equal(invalid.needsRefresh,false);assert.match(invalid.error,/Kontrollera lagerfiler/);
  const runtime=await publishOperatorPackage({...input,fetchImpl:async()=>Response.json({code:'studio_presentation_runtime_update_required'},{status:503})});
  assert.match(runtime.error,/Spelmotorn behöver uppdateras/);
  const storage=await publishOperatorPackage({...input,fetchImpl:async()=>Response.json({error:'studio_native_unavailable',code:'studio_storage_unavailable'},{status:503})});
  assert.equal(storage.error,'Publiceringen gick inte igenom: studio_storage_unavailable');
  const admin=await publishOperatorPackage({...input,fetchImpl:async()=>Response.json({error:'Action unavailable',code:'studio_storage_unavailable'},{status:503})});
  assert.equal(admin.error,'Publiceringen gick inte igenom: studio_storage_unavailable');
  const opaque=await publishOperatorPackage({...input,fetchImpl:async()=>Response.json({error:'studio_native_unavailable'},{status:503})});
  assert.equal(opaque.error,'Publiceringen gick inte igenom.');
  const unsafe=await publishOperatorPackage({...input,fetchImpl:async()=>Response.json({code:'<script>'},{status:503})});
  assert.equal(unsafe.error,'Publiceringen gick inte igenom.');
  const foreign=await publishOperatorPackage({...input,fetchImpl:async()=>Response.json({ok:true,operatorId:'south',packageRevision:5,lanes:['mobile-phone','evening']})});
  assert.deepEqual(foreign,{ok:false,needsRefresh:true,error:PACKAGE_RECEIPT_MISMATCH});
  const network=await publishOperatorPackage({...input,fetchImpl:async()=>{throw new Error('offline');}});
  assert.deepEqual(network,{ok:false,needsRefresh:true,error:PACKAGE_UNCONFIRMED});
});
