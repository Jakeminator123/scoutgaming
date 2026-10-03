import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioGameAuthority,studioCommandSignature} from '../lab/lib/studio-game-authority.mjs';
const scope={environment:'fixture',workspaceId:'croupier'}, env={CROUPIER_PUBLIC_ORIGIN:'https://public.example.invalid',CROUPIER_BACKEND_ORIGIN:'https://render.example.invalid',CROUPIER_VERCEL_INGRESS_SECRET:'s'.repeat(40)};
const input={action:'apikeys/credit',body:{id:'key',playerId:'p',amount:10},actor:{user:'operator',role:'superadmin'},scope,
  request:new Request(`${env.CROUPIER_PUBLIC_ORIGIN}/studio/api/admin/apikeys/credit`,{headers:{cookie:'bo_jwt=existing'}})};
test('engine bridge uses bounded signed trusted transport and confirms exact Render scope',async()=>{
  let calls=0;
  const authority=createStudioGameAuthority({env,scope,now:()=>1_800_000_000_000,fetchImpl:async(url,options)=>{
    calls++; assert.equal(url,`${env.CROUPIER_BACKEND_ORIGIN}/api/studio-game/command`); assert.equal(options.redirect,'error');
    assert.equal(options.headers.cookie,'bo_jwt=existing'); assert.equal(options.headers.origin,env.CROUPIER_PUBLIC_ORIGIN);
    assert.equal(options.headers['x-croupier-studio-signature'],studioCommandSignature(env.CROUPIER_VERCEL_INGRESS_SECRET,options.headers['x-croupier-studio-timestamp'],options.body));
    const command=JSON.parse(options.body); assert.deepEqual(command.scope,scope); assert.deepEqual(command.actor,input.actor); assert.ok(command.commandId);
    return Response.json({ok:true,authority:'render',scope,balance:10});
  }});
  assert.equal((await authority.execute(input)).balance,10); assert.equal(calls,1);
});
test('uncertain mutation is never retried and errors disclose no connection details',async()=>{
  let calls=0; const authority=createStudioGameAuthority({env,scope,fetchImpl:async()=>{calls++;throw Error('PRIVATE DATABASE');}});
  await assert.rejects(authority.execute(input),error=>error.statusCode===503&&!error.message.includes('PRIVATE')); assert.equal(calls,1);
});
test('invalid configuration and untrusted inputs never reach Render',async()=>{
  for(const change of [{CROUPIER_BACKEND_ORIGIN:env.CROUPIER_PUBLIC_ORIGIN},{CROUPIER_PUBLIC_ORIGIN:'http://localhost'},{CROUPIER_VERCEL_INGRESS_SECRET:'short'}]) assert.throws(()=>createStudioGameAuthority({env:{...env,...change},scope}));
  let calls=0; const authority=createStudioGameAuthority({env,scope,fetchImpl:async()=>{calls++;}});
  for(const change of [{action:'wallet/reset'},{scope:{...scope,environment:'production'}},{request:new Request(env.CROUPIER_PUBLIC_ORIGIN)}, {body:{blob:'x'.repeat(16385)}}]) await assert.rejects(authority.execute({...input,...change}));
  assert.equal(calls,0);
});
test('wrong authority/scope, non-JSON, oversized and error responses cannot acknowledge a write',async()=>{
  for(const response of [Response.json({ok:true,authority:'vercel',scope}),Response.json({ok:true,authority:'render',scope:{...scope,environment:'production'}}),new Response('html'),new Response('x'.repeat(32769),{headers:{'content-type':'application/json'}}),Response.json({private:'never show'},{status:409})]) {
    const authority=createStudioGameAuthority({env,scope,fetchImpl:async()=>response});
    await assert.rejects(authority.execute(input),error=>[409,503].includes(error.statusCode));
  }
});
