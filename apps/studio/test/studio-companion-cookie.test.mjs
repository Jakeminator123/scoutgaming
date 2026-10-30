import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {labCompanionIdentity} from '../lib/companion-server.mjs';

test('Studio mounted companion cookie preserves exact existing identity namespace on future profile and chat requests',t => {
  const saved = process.env.NEXT_PUBLIC_LAB_BASE_PATH;
  t.after(() => {if(saved === undefined) delete process.env.NEXT_PUBLIC_LAB_BASE_PATH;else process.env.NEXT_PUBLIC_LAB_BASE_PATH = saved;});
  delete process.env.NEXT_PUBLIC_LAB_BASE_PATH;
  const settings = {remoteToken:'server-only-existing-secret'};
  const first = labCompanionIdentity(new Request('https://studio.example.invalid/studio/api/social/profile'),settings);
  assert.match(first.cookie,/; Path=\/studio\/api\/social; HttpOnly; SameSite=Strict; Max-Age=2592000; Secure$/);
  const cookie = first.cookie.split(';')[0],token = cookie.split('=')[1];
  assert.equal(first.identity,createHmac('sha256',settings.remoteToken).update(`croupier-lab-v1\0${token}`).digest('hex'));
  for (const path of ['profile','chat']) assert.deepEqual(labCompanionIdentity(new Request(`https://studio.example.invalid/studio/api/social/${path}`,{headers:{cookie}}),settings),{identity:first.identity,cookie:null});
  // basePath /studio is fixed, so the cookie path never depends on the request or a build variable.
  assert.match(labCompanionIdentity(new Request('http://localhost:4188/api/social/profile'),settings).cookie,/; Path=\/studio\/api\/social; HttpOnly;/);
});
