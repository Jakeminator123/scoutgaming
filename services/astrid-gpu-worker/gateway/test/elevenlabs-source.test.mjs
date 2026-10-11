import test from 'node:test';
import assert from 'node:assert/strict';
import { createElevenLabsSource } from '../elevenlabs-source.mjs';

const config = { apiKey: 'test-only', voiceId: 'voice-one', modelId: 'eleven_multilingual_v2' };
async function collect(source, extra = {}) {
  const chunks = [];
  for await (const pcm of source({ text: 'Hej Jakob.', ...extra })) chunks.push(pcm);
  return Buffer.concat(chunks);
}
test('ElevenLabs sources retain separate immutable voice/model routing and raw PCM contract', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => { calls.push({url, ...options}); return new Response(new Uint8Array(48)); };
  await Promise.all([
    collect(createElevenLabsSource(config, {fetchImpl})),
    collect(createElevenLabsSource({...config,voiceId:'voice-two',modelId:'eleven_v3'}, {fetchImpl})),
  ]);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(x => JSON.parse(x.body).model_id), ['eleven_multilingual_v2','eleven_v3']);
  for (const [index, call] of calls.entries()) {
    assert.equal(call.url, `https://api.elevenlabs.io/v1/text-to-speech/voice-${index ? 'two' : 'one'}/stream?output_format=pcm_24000`);
    assert.equal(call.method, 'POST'); assert.equal(call.redirect, 'error');
    assert.equal(call.headers['xi-api-key'], config.apiKey);
    assert.equal(call.headers.authorization, undefined);
    assert.equal(JSON.parse(call.body).text, 'Hej Jakob.');
  }
});
test('ElevenLabs stops before cost on stale owner; provider errors are private and never retried', async () => {
  let calls = 0;
  const source = createElevenLabsSource(config, {fetchImpl: async () => { calls++; return new Response('private-provider-body', {status:403}); }});
  await assert.rejects(collect(source, {beforeCostly: () => { throw Error('stale'); }}), /TTS stream failed/);
  assert.equal(calls, 0);
  await assert.rejects(collect(source), /^Error: TTS stream failed$/);
  assert.equal(calls, 1);
});
test('ElevenLabs preserves odd transport chunks and rejects incomplete PCM samples', async () => {
  const response = chunks => new Response(new ReadableStream({start(c) { for (const chunk of chunks) c.enqueue(chunk); c.close(); }}));
  const source = chunks => createElevenLabsSource(config,{fetchImpl:async()=>response(chunks)});
  assert.equal((await collect(source([new Uint8Array(23),new Uint8Array(25)]))).length, 48);
  await assert.rejects(collect(source([new Uint8Array(49)])), /TTS stream failed/);
});
test('ElevenLabs rejects path or header injection without network work', () => {
  for (const override of [{voiceId:'../astrid'}, {modelId:'bad\nmodel'}, {apiKey:'key\r\nheader'}]) {
    assert.throws(() => createElevenLabsSource({...config,...override}), /Invalid TTS configuration/);
  }
});
test('explicit clone tuning stays immutable; v3 uses text language without changing the requested model',async()=>{
  const calls=[],settings={stability:0.5,similarity_boost:0.85,use_speaker_boost:true};
  const fetchImpl=async(url,options)=>{calls.push(JSON.parse(options.body));return new Response(new Uint8Array(48));};
  const source=createElevenLabsSource({...config,modelId:'eleven_v3',language:'sv',settings},{fetchImpl});
  settings.stability=0;await collect(source);
  assert.equal(calls[0].model_id,'eleven_v3');assert.equal(calls[0].voice_settings.stability,0.5);assert.equal(calls[0].language_code,undefined);
  await collect(createElevenLabsSource({...config,language:'en',settings:{stability:0.38,similarity_boost:0.8,style:0.3,use_speaker_boost:true}},{fetchImpl}));
  assert.equal(calls[1].model_id,'eleven_multilingual_v2');assert.equal(calls[1].language_code,undefined);assert.equal(calls[1].voice_settings.style,0.3);
  for(const invalid of [{settings:{stability:2}},{settings:{use_speaker_boost:'yes'}},{settings:{secret:'no'}},{language:'sv\n'}])assert.throws(()=>createElevenLabsSource({...config,...invalid}));
});
