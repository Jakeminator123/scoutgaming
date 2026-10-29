import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { validateCloudConfig, childSpecifications } from '../ops/cloud/config.mjs';
import { movingDriftConfiguration } from '../packages/presentation/contracts/moving-drift.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
// Never use real connections: generate an inert credential once per fixture.
const fixtureConnection=new URL('postgresql://game.neon.tech/game?sslmode=require');
fixtureConnection.username='fixture';fixtureConnection.password=randomUUID();
const manifestFor = dealerId => ({ provider:'vercel-blob',sha256:hash('fixture manifest '+dealerId),size:4096,contentType:'application/json',
  pathname:`croupier/media/dealers/${dealerId}/runtime/moving-bank/11111111-1111-4111-8111-111111111111/${hash('fixture manifest '+dealerId)}.json` });
const privateManifest = manifestFor('dragan'), paowManifest = manifestFor('paow');
const base = () => ({NODE_ENV:'production',PORT:'10000',  CROUPIER_GAME_DATABASE_URL:fixtureConnection.href,
  CROUPIER_STUDIO_NEON_POLICY:'1',CROUPIER_STUDIO_ENVIRONMENT_ID:'production',CROUPIER_STUDIO_WORKSPACE_ID:'croupier',
  CROUPIER_MEDIA_STORAGE:'blob',BLOB_READ_WRITE_TOKEN:'fixture-private-blob',
  PUBLIC_URL:'https://game.example.test',BO_URL:'https://bo.example.test',LAB_PUBLIC_URL:'https://lab.example.test',RENDER_EXTERNAL_URL:'https://fixture-game.onrender.com',
  CROUPIER_GAME_ORIGIN:'https://game.example.test',BETTALOTTO_PARTNER_BASE_URL:'https://game.example.test',
  OPENCLAW_PRODUCT_SPEECH_URL:'https://speech.example.test',OPENCLAW_PRODUCT_SPEECH_TOKEN:'fixture-product-speech',
  CROUPIER_GENERATED_SPEECH:'1',CROUPIER_CLOUD_GENERATED_SPEECH:'1',CROUPIER_GENERATED_SPEECH_STREAMING:'1',
  CROUPIER_DEALER_SPEECH_PROFILES:'1',CROUPIER_SPEECH_STREAM_WORKER_SECRET:'fixture-worker-'.repeat(4),
  CROUPIER_SPEECH_STREAM_TICKET_SECRET:'fixture-astrid-ticket-'.repeat(4),CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD:'1',
  CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD:'5',CARTESIA_API_KEY:'fixture-cartesia',RUNPOD_API_KEY:'fixture-legacy-runpod',
  CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID:'legacy-endpoint'});
const driftProfile={id:'baseline',label:'Basprofil',dealerId:'dragan',endpointId:'movingfixture',releaseDigest:hash('owned fixture source'),bankHash:hash('fixture archive')};
const paowProfile={id:'paow',label:'Paow',dealerId:'paow',endpointId:'movingpaow01',releaseDigest:hash('owned fixture source'),bankHash:hash('paow archive')};
const moving = () => ({CROUPIER_MOVING_SPEECH_ENABLED:'1',CROUPIER_MOVING_SPEECH_BANK_RECORDS:JSON.stringify({dragan:privateManifest}),
  CROUPIER_MOVING_SPEECH_WORKER_ORIGIN:'https://fixture-game.onrender.com',
  CROUPIER_MOVING_SPEECH_RUNPOD_API_KEY:'fixture-owned-runpod',
  CROUPIER_MOVING_SPEECH_IMAGE:`ghcr.io/jakeminator123/moving-gpu-worker@sha256:${hash('owned fixture image')}`,
  CROUPIER_MOVING_SPEECH_RELEASE_SHA256:hash('owned fixture source'),CROUPIER_MOVING_SPEECH_TICKET_SECRET:'fixture-moving-ticket-'.repeat(4),
  CROUPIER_STUDIO_MOVING_DRIFT_API:'1',CROUPIER_STUDIO_MOVING_DRIFT_PROFILES:JSON.stringify([driftProfile])});
const children = env => childSpecifications(validateCloudConfig(env),env);

test('database path and stream lane are fixed in code; panel values are ignored, never forwarded',()=>{
  const web=children(base()).web.env;
  assert.equal(web.CROUPIER_STREAM_LANE,'lissabon-stream-lane');
  assert.equal(web.CROUPIER_DATABASE,undefined);
  for(const stale of [{CROUPIER_DATABASE:'sqlite'},{CROUPIER_STREAM_LANE:'other'}]){
    const env={...base(),...stale};
    assert.equal(children(env).web.env.CROUPIER_STREAM_LANE,'lissabon-stream-lane');
    assert.equal(children(env).web.env.CROUPIER_DATABASE,undefined);
  }
});

test('moving configuration is explicit and passes its private values to Web only; Astrid stays unchanged',()=>{
  const legacy=children(base()),env={...base(),...moving()},configured=children(env);
  for(const [key,value] of Object.entries(moving())){
    assert.equal(configured.web.env[key],value);
  }
  assert.deepEqual(Object.keys(configured), ['web']);
  const withoutMoving=Object.fromEntries(Object.entries(configured.web.env).filter(([key])=>!key.startsWith('CROUPIER_MOVING_')&&!['CROUPIER_STUDIO_MOVING_DRIFT_API','CROUPIER_STUDIO_MOVING_DRIFT_PROFILES'].includes(key)));
  assert.deepEqual(withoutMoving,legacy.web.env);
});

test('moving drift forwards the validated baseline to the game child without unrelated environment',()=>{
  const env={...base(),...moving(),UNRELATED_PROVIDER_SECRET:'must-not-leak',CROUPIER_STUDIO_MOVING_DRIFT_OTHER:'must-not-leak'};
  const config=validateCloudConfig(env);
  // Forward the validated snapshot even if the caller subsequently edits its input.
  env.CROUPIER_STUDIO_MOVING_DRIFT_PROFILES='[]';
  const specs=childSpecifications(config,env);
  assert.deepEqual(movingDriftConfiguration(specs.web.env),{profiles:[driftProfile]});
  assert.equal(specs.web.env.CROUPIER_MOVING_SPEECH_ENABLED,'1');
  for(const name of ['UNRELATED_PROVIDER_SECRET','CROUPIER_STUDIO_MOVING_DRIFT_OTHER']){
    assert.equal(specs.web.env[name],undefined);
  }
});

test('moving drift rejects missing, malformed or mismatched catalogues before starting children',()=>{
  for(const change of [
    {CROUPIER_STUDIO_MOVING_DRIFT_API:undefined},{CROUPIER_STUDIO_MOVING_DRIFT_API:'0'},{CROUPIER_STUDIO_MOVING_DRIFT_API:'true'},
    ...[undefined,'','invalid','[]',JSON.stringify([driftProfile,{...driftProfile,id:'other'}]),
      JSON.stringify([{...driftProfile,endpointId:'../legacy'}]),JSON.stringify([{...driftProfile,endpointId:'Moving-Fixture'}]),
      JSON.stringify([{...driftProfile,releaseDigest:hash('different release')}]),JSON.stringify([{...driftProfile,dealerId:undefined}]),
      JSON.stringify([{...driftProfile,apiKey:'must-not-leak'}])].map(raw=>({CROUPIER_STUDIO_MOVING_DRIFT_PROFILES:raw})),
  ])assert.throws(()=>validateCloudConfig({...base(),...moving(),...change}),
    error=>/CROUPIER_STUDIO_MOVING_DRIFT/.test(error.message)&&!error.message.includes('must-not-leak'));
});

test('unset and disabled moving flags forward no staged credentials and preserve legacy children',()=>{
  const legacy=children(base());
  for(const flag of [undefined,'','0']){
    const env={...base(),...moving(),CROUPIER_MOVING_SPEECH_ENABLED:flag,CROUPIER_MOVING_SPEECH_BANK_RECORDS:'not parsed while disabled'};
    assert.equal(validateCloudConfig(env).movingSpeech,null);assert.deepEqual(children(env),legacy);
  }
  for(const flag of ['true','yes','2'])assert.throws(()=>children({...base(),...moving(),CROUPIER_MOVING_SPEECH_ENABLED:flag}),/CROUPIER_MOVING_SPEECH_ENABLED/);
});

test('moving activation requires registered profiles, Neon and private Blob without enabling them implicitly',()=>{
  const env={...base(),...moving()};
  for(const change of [{CROUPIER_DEALER_SPEECH_PROFILES:'0'},{CROUPIER_STUDIO_NEON_POLICY:'0'},
    {CROUPIER_MEDIA_STORAGE:'disk'},{BLOB_READ_WRITE_TOKEN:''},
    {CROUPIER_GENERATED_SPEECH_STREAMING:'0'},
    {CROUPIER_GAME_DATABASE_URL:fixtureConnection.href.replace('game.neon.tech','other.example.test')}])
    assert.throws(()=>validateCloudConfig({...env,...change}));
});

test('worker origin is explicit, exact HTTPS and belongs to this Render deployment only',()=>{
  const env={...base(),...moving()};
  for(const bad of [undefined,'','http://fixture-game.onrender.com','https://fixture-game.onrender.com/',
    'https://fixture-game.onrender.com/path','https://fixture-game.onrender.com?token=x',
    'https://user@fixture-game.onrender.com','https://fixture-game.onrender.com:443','https://other.onrender.com',env.PUBLIC_URL])
    assert.throws(()=>validateCloudConfig({...env,CROUPIER_MOVING_SPEECH_WORKER_ORIGIN:bad}),/CROUPIER_MOVING_SPEECH_WORKER_ORIGIN/);
  for(const bad of [undefined,'http://fixture-game.onrender.com','https://other.onrender.com'])
    assert.throws(()=>validateCloudConfig({...env,RENDER_EXTERNAL_URL:bad}));
  const specs=children(env);
  assert.equal(specs.web.env.CROUPIER_MOVING_SPEECH_WORKER_ORIGIN,env.RENDER_EXTERNAL_URL);
  assert.equal(specs.web.env.PUBLIC_URL,env.PUBLIC_URL);
});

test('bank map accepts only one hash-bound private JSON manifest per dealer up to128KiB',()=>{
  const env={...base(),...moving()},key='CROUPIER_MOVING_SPEECH_BANK_RECORDS',bank=record=>JSON.stringify({dragan:record});
  for(const bad of ['null','{}','[]','"dragan"','not-json',JSON.stringify([privateManifest]),JSON.stringify(privateManifest),
    JSON.stringify({Dragan:privateManifest}),JSON.stringify({'../dragan':privateManifest}),JSON.stringify({dragan:null}),
    JSON.stringify(Object.fromEntries(Array.from({length:9},(_,i)=>['dealer-'+i,manifestFor('dealer-'+i)]))),
    bank({...privateManifest,size:131073}),bank({...privateManifest,sha256:hash('different')}),bank({...privateManifest,url:'https://public.example.test/bank'}),
    bank({...privateManifest,contentType:'video/mp4'}),bank({...privateManifest,pathname:privateManifest.pathname.replace('/moving-bank/','/other/')}),
    ' '.repeat(131073)])assert.throws(()=>validateCloudConfig({...env,[key]:bad}),error=>error.message===`Invalid or missing ${key}.`);
  assert.ok(validateCloudConfig({...env,[key]:bank({...privateManifest,size:131072})}).movingSpeech);
  // The retired single-dealer variable is never read in place of the map.
  assert.throws(()=>validateCloudConfig({...env,CROUPIER_MOVING_SPEECH_BANK_RECORD:JSON.stringify(privateManifest),[key]:undefined}),/CROUPIER_MOVING_SPEECH_BANK_RECORDS/);
});

const twoDealers = () => ({...moving(),CROUPIER_MOVING_SPEECH_BANK_RECORDS:JSON.stringify({dragan:privateManifest,paow:paowManifest}),
  CROUPIER_STUDIO_MOVING_DRIFT_PROFILES:JSON.stringify([driftProfile,paowProfile])});

test('two dealers each get a verified bank and drift profile; Dragan alone is unchanged',()=>{
  const draganOnly=children({...base(),...moving()}).web.env,both=children({...base(),...twoDealers()}).web.env;
  assert.deepEqual(JSON.parse(draganOnly.CROUPIER_MOVING_SPEECH_BANK_RECORDS),{dragan:privateManifest});
  assert.deepEqual(JSON.parse(both.CROUPIER_MOVING_SPEECH_BANK_RECORDS),{dragan:privateManifest,paow:paowManifest});
  assert.deepEqual(movingDriftConfiguration(both).profiles,[driftProfile,paowProfile]);
  // Endpoints come from each dealer's profile; no single endpoint or retired bank variable reaches the game.
  for(const env of [draganOnly,both])for(const name of ['CROUPIER_MOVING_SPEECH_ENDPOINT_ID','CROUPIER_MOVING_SPEECH_BANK_RECORD'])
    assert.equal(Object.hasOwn(env,name),false,name);
  const {CROUPIER_MOVING_SPEECH_BANK_RECORDS:_a,CROUPIER_STUDIO_MOVING_DRIFT_PROFILES:_b,...rest}=both;
  const {CROUPIER_MOVING_SPEECH_BANK_RECORDS:_c,CROUPIER_STUDIO_MOVING_DRIFT_PROFILES:_d,...single}=draganOnly;
  assert.deepEqual(rest,single);
});

// docs/PAOW-BANK-KORNING.md step 7: preview carries Paow alone; its profile's bankHash is the archive hash and its
// releaseDigest is the image's release, so Dragan's production values are never copied to preview.
test('preview with Paow alone: own bank and endpoint pass; a foreign release or Dragan bank is refused',()=>{
  const paowOnly={...base(),...moving(),CROUPIER_MOVING_SPEECH_BANK_RECORDS:JSON.stringify({paow:paowManifest}),
    CROUPIER_STUDIO_MOVING_DRIFT_PROFILES:JSON.stringify([paowProfile])};
  const web=children(paowOnly).web.env;
  assert.deepEqual(JSON.parse(web.CROUPIER_MOVING_SPEECH_BANK_RECORDS),{paow:paowManifest});
  assert.deepEqual(movingDriftConfiguration(web).profiles,[paowProfile]);
  assert.throws(()=>validateCloudConfig({...paowOnly,CROUPIER_MOVING_SPEECH_RELEASE_SHA256:hash('other release')}),/DRIFT_API\/PROFILES/);
  assert.throws(()=>validateCloudConfig({...paowOnly,CROUPIER_MOVING_SPEECH_BANK_RECORDS:JSON.stringify({paow:privateManifest})}),/bank of another dealer for paow/);
});

test('bank and profile refusals name the dealer: wrong dealer, profile without a bank, bank without a profile',()=>{
  const env={...base(),...twoDealers()},banks='CROUPIER_MOVING_SPEECH_BANK_RECORDS',profiles='CROUPIER_STUDIO_MOVING_DRIFT_PROFILES';
  const refuse=(change,pattern)=>assert.throws(()=>validateCloudConfig({...env,...change}),
    error=>pattern.test(error.message)&&!error.message.includes('fixture-owned-runpod'),pattern.source);
  refuse({[banks]:JSON.stringify({dragan:privateManifest,paow:privateManifest})},/BANK_RECORDS \(bank of another dealer for paow\)/);
  refuse({[banks]:JSON.stringify({dragan:paowManifest})},/BANK_RECORDS \(bank of another dealer for dragan\)/);
  refuse({[banks]:JSON.stringify({dragan:privateManifest})},/DRIFT_PROFILES \(profile without a bank for paow\)/);
  refuse({[profiles]:JSON.stringify([driftProfile])},/BANK_RECORDS \(bank without a drift profile for paow\)/);
  refuse({[profiles]:JSON.stringify([driftProfile,{...paowProfile,dealerId:'astrid'}])},/DRIFT_PROFILES \(profile without a bank for astrid\)/);
  // One endpoint, profile ID and dealer per profile: a shared endpoint would let one dealer's Off drain the other.
  for(const shared of [{...paowProfile,endpointId:driftProfile.endpointId},{...paowProfile,id:driftProfile.id},{...paowProfile,dealerId:'dragan'}])
    refuse({[profiles]:JSON.stringify([driftProfile,shared])},/CROUPIER_STUDIO_MOVING_DRIFT_API\/PROFILES/);
  refuse({[profiles]:JSON.stringify([driftProfile,{...paowProfile,releaseDigest:hash('other release')}])},/CROUPIER_STUDIO_MOVING_DRIFT_API\/PROFILES/);
});

test('start.mjs --check accepts Dragan alone and Dragan with a second dealer, and refuses a profile without a bank',async t=>{
  const {main}=await import('../ops/cloud/start.mjs');
  // Bootstrap credentials make the read-only preflight skip its database read; nothing starts.
  const bootstrap={CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER:'fixture-admin',CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD:'fixture-password-'.repeat(2)};
  const logs=[];t.mock.method(console,'log',line=>logs.push(line));
  for(const env of [{...base(),...moving(),...bootstrap},{...base(),...twoDealers(),...bootstrap}])assert.equal(await main(['--check'],env),0);
  assert.equal(logs.length,2);assert.match(logs[0],/^Cloud configuration valid\./);
  await assert.rejects(main(['--check'],{...base(),...twoDealers(),...bootstrap,CROUPIER_MOVING_SPEECH_BANK_RECORDS:JSON.stringify({dragan:privateManifest})}),
    /profile without a bank for paow/);
});

test('moving provider identity is immutable and ticket secrets cannot reuse Astrid or provider credentials',()=>{
  const env={...base(),...moving()};
  for(const [key,bad] of [
    ['RUNPOD_API_KEY','contains whitespace'],
    ['IMAGE','ghcr.io/jakeminator123/moving-gpu-worker:latest'],['IMAGE',`ghcr.io/elsewhere/moving-gpu-worker@sha256:${hash('image')}`],
    ['RELEASE_SHA256','latest'],['TICKET_SECRET','short'],['TICKET_SECRET',env.CROUPIER_SPEECH_STREAM_WORKER_SECRET],
    ['TICKET_SECRET',env.CROUPIER_SPEECH_STREAM_TICKET_SECRET],['TICKET_SECRET','fixture-moving-key-'.repeat(4)],
  ]){
    const change=key==='TICKET_SECRET'&&bad.startsWith('fixture-moving-key-')?{CROUPIER_MOVING_SPEECH_RUNPOD_API_KEY:bad}:{};
    assert.throws(()=>validateCloudConfig({...env,...change,['CROUPIER_MOVING_SPEECH_'+key]:bad}),new RegExp('CROUPIER_MOVING_SPEECH_'+key));
  }
});

test('Render config loads from source without frontend or speech dependency installations', async t => {
  const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
  const root = await mkdtemp(join(tmpdir(), 'croupier-render-config-'));
  t.after(() => rm(root, {recursive:true, force:true}));
  const copied = new Set();
  async function copySource(path) {
    if (copied.has(path)) return;
    copied.add(path);
    const source = await readFile(join(sourceRoot, path), 'utf8');
    const target = join(root, path);
    await mkdir(dirname(target), {recursive:true});
    await writeFile(target, source);
    if (!path.endsWith('.mjs')) return;
    for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
      const dependency = relative(sourceRoot, resolve(sourceRoot, dirname(path), match[1]));
      assert.ok(!isAbsolute(dependency) && !dependency.startsWith('..'));
      await copySource(dependency);
    }
  }
  // Copy the real boot-config source closure. The game-only image
  // (ops/cloud/Dockerfile.game) installs no Studio, frontend or speech
  // dependencies, so the closure must stay outside apps/ and load without node_modules.
  await copySource('ops/cloud/config.mjs');
  assert.deepEqual([...copied].filter(path => path.startsWith('apps/')), []);
  const isolated = await import(pathToFileURL(join(root, 'ops/cloud/config.mjs')).href);
  const env = base();
  assert.deepEqual(isolated.validateCloudConfig(env, {repository:root}), validateCloudConfig(env, {repository:root}));
});

test('today\'s production shape still starts: moving off, retired single-bank names present, profile without dealerId',async t=>{
  const {main}=await import('../ops/cloud/start.mjs');
  const bootstrap={CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER:'fixture-admin',CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD:'fixture-password-'.repeat(2)};
  const {dealerId:_dealer,...legacyProfile}=driftProfile;
  const {CROUPIER_MOVING_SPEECH_BANK_RECORDS:_map,...rest}=moving();
  // Render croupier-v3 on 28 October 2026: flag 0, old bank and endpoint names, no bank map, Vercel-style profile.
  const today={...base(),...rest,...bootstrap,CROUPIER_MOVING_SPEECH_ENABLED:'0',
    CROUPIER_MOVING_SPEECH_BANK_RECORD:JSON.stringify(privateManifest),CROUPIER_MOVING_SPEECH_ENDPOINT_ID:'movingfixture',
    CROUPIER_STUDIO_MOVING_DRIFT_PROFILES:JSON.stringify([legacyProfile])};
  const {CROUPIER_MOVING_SPEECH_ENABLED:_flag,...unset}=today;
  const logs=[];t.mock.method(console,'log',line=>logs.push(line));
  for(const env of [today,unset,{...today,CROUPIER_MOVING_SPEECH_ENABLED:''},{...base(),...bootstrap,CROUPIER_MOVING_SPEECH_ENABLED:'0'}]){
    assert.equal(await main(['--check'],env),0);
    const child=children(env).web.env;
    assert.deepEqual(Object.keys(child).filter(name=>/MOVING/.test(name)),[],'the game child receives no moving keys');
  }
  assert.equal(logs.length,4);
  // Turning moving speech on with that shape is refused until the map and dealerId are set.
  await assert.rejects(main(['--check'],{...today,CROUPIER_MOVING_SPEECH_ENABLED:'1'}),/Invalid or missing CROUPIER_MOVING_SPEECH_BANK_RECORDS\./);
  await assert.rejects(main(['--check'],{...today,CROUPIER_MOVING_SPEECH_ENABLED:'1',CROUPIER_MOVING_SPEECH_BANK_RECORDS:JSON.stringify({dragan:privateManifest})}),
    /CROUPIER_STUDIO_MOVING_DRIFT_API\/PROFILES/);
});

test('streamed still-image speech is optional as a group: none means off, one of three still fails',()=>{
  const still=['CARTESIA_API_KEY','RUNPOD_API_KEY','CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID'];
  const without=Object.fromEntries(Object.entries({...base(),...moving()}).filter(([key])=>!still.includes(key)));
  const config=validateCloudConfig(without);
  assert.equal(config.speechProvider,null); assert.equal(config.streaming,true); assert.ok(config.movingSpeech);
  const web=childSpecifications(config,without).web.env;
  for(const key of still)assert.equal(web[key],undefined);
  assert.equal(web.CROUPIER_MOVING_SPEECH_ENABLED,'1');
  assert.deepEqual(validateCloudConfig(base()).speechProvider,{cartesiaKey:'fixture-cartesia',runpodKey:'fixture-legacy-runpod',runpodEndpointId:'legacy-endpoint'});
  for(const key of still){
    assert.throws(()=>validateCloudConfig({...without,[key]:base()[key]}),/CARTESIA_API_KEY\/RUNPOD_API_KEY\/CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID/,key);
  }
  // Non-streamed generated speech has no moving path and still needs the provider.
  const fullfile={...without,CROUPIER_GENERATED_SPEECH_STREAMING:'0',CROUPIER_DEALER_SPEECH_PROFILES:'0',CROUPIER_MOVING_SPEECH_ENABLED:'0',CROUPIER_SPEECH_FULLFILE_RESERVE_USD:'1'};
  assert.throws(()=>validateCloudConfig(fullfile),/CARTESIA_API_KEY\/RUNPOD_API_KEY\/CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID/);
});
