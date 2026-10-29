import test from 'node:test';
import assert from 'node:assert/strict';
import {socialEndpoint} from '../lib/social-server.mjs';

test('Render social capability status creates speech ownership without reading or initializing policy or companion state',async () => {
  const options = {store:{load:async () => {throw new Error('must not read policy');}},
    settings:{remoteUrl:'https://director.example.invalid',remoteToken:'configured',companionEnabled:true},voiceSettings:{key:'configured'},
    speechStatus:() => ({configured:true}),fetchImpl:()=> {throw new Error('must not call provider');}};
  const response = await socialEndpoint(new Request('http://localhost:4187/api/social/status',{headers:{host:'localhost:4187'}}),options);
  assert.equal(response.status,200);
  // The standalone voice preview is always off (Neon and native Admin are fixed), even with a key.
  assert.deepEqual(await response.json(),{configured:true,voiceConfigured:false,generatedSpeech:{configured:true},companionEnabled:true});
  assert.match(response.headers.get('set-cookie'),/^lab_speech_session=[a-f0-9-]+; Path=\/; HttpOnly; SameSite=Strict;/);
  const rejected = await socialEndpoint(new Request('http://localhost:4187/api/social/status',{headers:{host:'localhost:4187',origin:'https://evil.invalid'}}),options);
  assert.equal(rejected.status,403);
});
