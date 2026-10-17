import test from 'node:test';
import assert from 'node:assert/strict';
import {createPartnerLeaveGuard,partnerWorkspaceView} from './partner-navigation-guard.mjs';
import {partnerNavigation} from './partner-copy.mjs';

test('real partner navigation has four tasks with team visibility controlled by its permission',()=>{
  assert.deepEqual(partnerNavigation('sv',['team.read']).map(row=>row.label),['Översikt','Spelrum','Team & behörigheter','Integration']);
  assert.deepEqual(partnerNavigation('en',[]).map(row=>row.label),['Overview','Game rooms','Integration']);
  for(const view of ['theme','design','background','dealers','test','bj'])assert.equal(partnerWorkspaceView(view),'bj');
  for(const view of ['players','tx','reports'])assert.equal(partnerWorkspaceView(view),'api');
});
test('dirty document and session navigation cannot discard edits without confirmation',()=>{
  let dirty=true,allow=false,prompts=0;
  const guard=createPartnerLeaveGuard({isDirty:()=>dirty,confirmLeave:()=>{prompts++;return allow;}});
  const event=()=>({prevented:false,preventDefault(){this.prevented=true;}});
  const first=event();guard.beforeUnload(first);assert.equal(first.prevented,true);assert.equal(first.returnValue,'');
  assert.equal(guard.requestLeave(),false);const cancelled=event();guard.beforeUnload(cancelled);assert.equal(cancelled.prevented,true);
  allow=true;assert.equal(guard.requestLeave(),true);const confirmed=event();guard.beforeUnload(confirmed);assert.equal(confirmed.prevented,false);
  guard.reset();const failedLogout=event();guard.beforeUnload(failedLogout);assert.equal(failedLogout.prevented,true);
  dirty=false;assert.equal(guard.requestLeave(),true);const saved=event();guard.beforeUnload(saved);assert.equal(saved.prevented,false);assert.equal(prompts,2);
});
