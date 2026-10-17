import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {labCompanionIdentity} from '../lib/companion-server.mjs';

test('Studio mounted companion cookie preserves exact existing identity namespace on future profile and chat requests',t => {
  const names = ['CROUPIER_LAB_BASE_PATH','NEXT_PUBLIC_LAB_BASE_PATH'];
  const saved = names.map(name => process.env[name]);
  t.after(() => names.forEach((name,index) => {if(saved[index] === undefined) delete process.env[name];else process.env[name] = saved[index];}));
  process.env.CROUPIER_LAB_BASE_PATH = '/studio';delete process.env.NEXT_PUBLIC_LAB_BASE_PATH;
  const settings = {remoteToken:'server-only-existing-secret'};
  const first = labCompanionIdentity(new Request('https://studio.example.invalid/studio/api/social/profile'),settings);
  assert.match(first.cookie,/; Path=\/studio\/api\/social; HttpOnly; SameSite=Strict; Max-Age=2592000; Secure$/);
  const cookie = first.cookie.split(';')[0],token = cookie.split('=')[1];
  assert.equal(first.identity,createHmac('sha256',settings.remoteToken).update(`croupier-lab-v1\0${token}`).digest('hex'));
  for (const path of ['profile','chat']) assert.deepEqual(labCompanionIdentity(new Request(`https://studio.example.invalid/studio/api/social/${path}`,{headers:{cookie}}),settings),{identity:first.identity,cookie:null});
  delete process.env.CROUPIER_LAB_BASE_PATH;
  assert.match(labCompanionIdentity(new Request('http://localhost:4188/api/social/profile'),settings).cookie,/; Path=\/api\/social;/);
});
