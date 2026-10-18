import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioLabSessionCheck} from '../services/game/studio-lab-session.mjs';
const publicOrigin='https://public.example.invalid',labOrigin=publicOrigin;
const req=changes=>({method:'GET',url:'/api/auth/lab/check',headers:{host:'public.example.invalid',cookie:'bo_jwt=existing'},socket:{remoteAddress:'127.0.0.1'},...changes});
test('protected engine bridge validates native identity every call and restricts the Studio role floor',async()=>{
  let role='admin',calls=0;const check=createStudioLabSessionCheck({publicOrigin,labOrigin,authorize:async request=>{
    calls++;assert.equal(request.headers.get('cookie'),'bo_jwt=existing');return {role};}});
  assert.equal((await check(req())).status,200);role='reader';assert.equal((await check(req())).status,401);role='player';assert.equal((await check(req())).status,401);assert.equal(calls,3);
});
test('nonloopback/Host/origin/method/path failures do not authorize; expired session and DB failures are distinct',async()=>{
  let calls=0;const check=createStudioLabSessionCheck({publicOrigin,labOrigin,authorize:async()=>{calls++;return {role:'superadmin'};}});
  for(const change of [{method:'POST'},{url:'/api/auth/lab/check?secret=1'},{socket:{remoteAddress:'203.0.113.1'}},{headers:{host:'evil.invalid'}},{headers:{host:'public.example.invalid',origin:'https://evil.invalid'}}]) assert.equal((await check(req(change))).status,401);
  assert.equal(calls,0);
  for(const [statusCode,expected] of [[401,401],[503,503]]) {
    const failed=createStudioLabSessionCheck({publicOrigin,labOrigin,authorize:async()=>{throw Object.assign(Error('PRIVATE'),{statusCode});}});
    const response=await failed(req());assert.equal(response.status,expected);assert.equal(await response.text(),'');
  }
});
