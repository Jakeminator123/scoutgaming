import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioLoginClient, StudioLoginUiError, studioLoginReturnTo, studioLoginDestination, studioPasswordToken } from '../lib/studio-login-client.mjs';
test('exact partner room survives login while foreign paths and arbitrary query fields remain blocked',()=>{
  const target='/partner/north-casino/rooms?room=vip-room';
  for(const prefix of ['','/studio'])assert.equal(studioLoginReturnTo(prefix+target),target);
  for(const authBase of ['/api/auth','/studio/api/auth'])assert.equal(studioLoginDestination(target,authBase),target);
  for(const value of ['/partner/north-casino/rooms?room=vip-room&room=main-room','/partner/north-casino/rooms?room=vip-room&token=x',
    '/partner/north-casino/rooms?room=','/partner/north-casino/rooms?room=https://outside.invalid','/partner/north-casino/rooms?room=../main-room',
    '/partner/login/rooms?room=vip-room','//outside.invalid/partner/north-casino/rooms?room=vip-room'])
    assert.equal(studioLoginReturnTo(value),'/admin',value);
});

test('native login returnTo preserves current Studio views or one-use BO handoff without a cross-host cookie handoff', () => {
  for (const value of ['/studio','/studio/administration','/studio/openclaw','/studio/operator-chat',
    '/studio/tree','/studio/activity','/studio/guide','/studio/zones','/studio/videos','/studio/events','/studio/probe']) {
    assert.equal(studioLoginReturnTo(value),value);
    assert.equal(studioLoginDestination(value,'/studio/api/auth'),value);
    assert.equal(studioLoginDestination(value,'/api/auth'),value.slice('/studio'.length) || '/');
  }
  for (const kind of ['game','lab']) {
    const value = `/api/bo/${kind}-login?state=${'a'.repeat(64)}`;
    assert.equal(studioLoginReturnTo(value),value);
    assert.equal(studioLoginDestination(value,'/api/auth'),'/', 'standalone login cannot forward a host-only cookie');
    assert.equal(studioLoginDestination(value,'/studio/api/auth'),value);
  }
  for (const value of ['/studio/administration?secret=x','/studio/','//attacker.test','https://attacker.test','/game','/blackjack','/api/bo/game-login',
    '/studio/login','/studio/set-password','/partner/set-password','/studio/partner/set-password','/studio/operator-chat?next=https://attacker.test','/studio/openclaw#private',
    '/studio/tree/child','/studio/tree/','/studio/Tree','/studio/%74ree','/studio\\tree','/studio//tree','/tree',
    `/api/bo/game-login?state=${'a'.repeat(63)}`,`/api/bo/lab-login?state=${'A'.repeat(64)}`,
    `/api/bo/game-login?state=${'a'.repeat(64)}&token=secret`,'/api/bo/users?state='+ 'a'.repeat(64),null,[],{}]) assert.equal(studioLoginReturnTo(value),'/admin');
  assert.equal(studioLoginDestination('/studio','/api/auth'),'/');
  assert.equal(studioLoginDestination('/studio/administration','/api/auth'),'/administration');
  assert.equal(studioLoginDestination('/studio/administration','/studio/api/auth'),'/studio/administration');
});
test('password bearer is scalar bounded base64url and never normalized from arbitrary values', () => {
  for (const value of ['a'.repeat(32),'a'.repeat(43)]) assert.equal(studioPasswordToken(value),value);
  for (const value of ['a'.repeat(31),'a'.repeat(129),'Bearer abc','%20','a.b.c',null,['a'.repeat(32)],{}]) assert.equal(studioPasswordToken(value),null);
});
test('new surface login returns preserve only admitted document paths for mounted and standalone Lab', () => {
  for (const path of ['/control', '/control/voice', '/control/studio', '/control/admin', '/control/ops', '/control/preview', '/control/lanes', '/partner', '/partner/demo-north/overview', '/partner/demo-south/team']) {
    for (const input of [path, '/studio' + path]) {
      assert.equal(studioLoginReturnTo(input), path);
      assert.equal(studioLoginDestination(input, '/studio/api/auth'), path);
      assert.equal(studioLoginDestination(input, '/api/auth'), path);
    }
  }
  for (const path of ['/partner/api/admin', '/control/api/admin', '/partner/demo-north/voice', '/partner/demo-north/overview?token=x',
    '/partner/demo-north/overview#private', '/partner/demo-north/overview/child', '/control/login', '/studio/partner//team', '/studio/control/%76oice']) {
    assert.equal(studioLoginReturnTo(path), '/admin', path);
    assert.equal(studioLoginDestination(path, '/api/auth'), '/admin', path);
  }
});
test('client has no render request and sends native auth action only as same-origin no-store JSON', async () => {
  const writes = [], client = createStudioLoginClient({authBase:'/studio/api/auth',fetchImpl:async(...args)=>{writes.push(args);return Response.json({ok:true,secret:'SERVER_SECRET'});}});
  assert.equal(writes.length,0);
  assert.deepEqual(await client.request('login',{user:'operator',pass:'private-password',returnTo:'/studio'}),{ok:true});
  assert.equal(writes[0][0],'/studio/api/auth/login'); assert.equal(writes[0][1].credentials,'same-origin');
  assert.equal(writes[0][1].cache,'no-store'); assert.equal(writes[0][1].redirect,'error');
  assert.equal(JSON.parse(writes[0][1].body).pass,'private-password');
});
test('client rejects unknown bases/actions and sanitizes all server/network failures', async () => {
  for (const authBase of ['https://attacker.test/api/auth','//attacker.test/api/auth','/studio/api/auth/']) assert.throws(()=>createStudioLoginClient({authBase}),error=>error.status===400);
  const client = createStudioLoginClient({fetchImpl:async()=>{throw Error('PRIVATE DATABASE URL');}});
  await assert.rejects(client.request('login',{}),error=>error.status===503 && !error.message.includes('PRIVATE'));
  await assert.rejects(client.request('constructor',{}),error=>error.status===400);
  for (const status of [400,401,403,429,503]) {
    const denied = createStudioLoginClient({fetchImpl:async()=>Response.json({error:'PRIVATE MAIL KEY'},{status})});
    await assert.rejects(denied.request('reset-request',{user:'operator'}),error=>error.status===status && !error.message.includes('PRIVATE'));
  }
  const malformed = createStudioLoginClient({fetchImpl:async()=>Response.json({ok:false})});
  await assert.rejects(malformed.request('logout',{}),error=>error.status===503);
});

test('Studio permission denial explains the admin boundary without echoing server data',()=>{
  assert.match(new StudioLoginUiError(403).message,/administratörsbehörighet/);
});

test('dealer workspace returns preserve only bounded view, category and shared context after login', () => {
  const value='/control/clips?dealer=paow&operator=north&table=room-one&composition=scene-one&event=speak.other&view=clips&category=speech&situation=goodluck';
  assert.equal(studioLoginReturnTo(value),value);
  for (const query of ['view=unknown','category=secret','situation=https://evil.test','view=clips&view=idle','view=clips&token=secret']) assert.equal(studioLoginReturnTo('/control/clips?'+query),'/admin');
});

test('missing or rejected N1 return targets fall back to Admin on both supported mounts', () => {
  for (const value of [undefined, null, '', '//outside.invalid/admin', '/studio/login']) {
    assert.equal(studioLoginReturnTo(value), '/admin');
    for (const authBase of ['/studio/api/auth', '/api/auth']) assert.equal(studioLoginDestination(value, authBase), '/admin');
  }
});

test('operator menus retain exactly one room or company selector through either N1 auth base',()=>{
  for(const view of ['','/team','/rooms','/integration','/table-design']){
    for(const query of ['room=vip-room','scope=company']){
      const target='/partner/north-casino'+view+'?'+query;
      for(const prefix of ['','/studio'])assert.equal(studioLoginReturnTo(prefix+target),target);
      for(const authBase of ['/api/auth','/studio/api/auth'])assert.equal(studioLoginDestination(target,authBase),target);
    }
  }
  for(const query of ['scope=','scope=Company','scope=unknown','scope=%63ompany','%73cope=company',
    'scope=company&scope=company','scope=company&room=','scope=company&room=foreign-room',
    'room=vip-room&scope=company','room=vip-room&room=vip-room','room=%76ip-room','scope=company&extra=x']){
    const target='/partner/north-casino/team?'+query;
    assert.equal(studioLoginReturnTo(target),'/admin',target);
    assert.equal(studioLoginDestination(target,'/api/auth'),'/admin',target);
  }
});
