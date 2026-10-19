import { mkdtemp, readFile, writeFile, mkdir, rm, symlink, realpath } from 'node:fs/promises';
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
const privateManifest = { provider:'vercel-blob',sha256:hash('fixture manifest'),size:4096,contentType:'application/json',
  pathname:`croupier/media/dealers/dragan/runtime/moving-bank/11111111-1111-4111-8111-111111111111/${hash('fixture manifest')}.json` };
const base = () => ({NODE_ENV:'production',PORT:'10000',CROUPIER_DATABASE:'postgres',
  CROUPIER_GAME_DATABASE_URL:fixtureConnection.href,
  CROUPIER_STUDIO_NEON_POLICY:'1',CROUPIER_STUDIO_ENVIRONMENT_ID:'production',CROUPIER_STUDIO_WORKSPACE_ID:'croupier',
  CROUPIER_MEDIA_STORAGE:'blob',BLOB_READ_WRITE_TOKEN:'fixture-private-blob',
  PUBLIC_URL:'https://game.example.test',BO_URL:'https://bo.example.test',LAB_PUBLIC_URL:'https://lab.example.test',RENDER_EXTERNAL_URL:'https://fixture-game.onrender.com',
  CROUPIER_GAME_ORIGIN:'https://game.example.test',BETTALOTTO_PARTNER_BASE_URL:'https://game.example.test',
  CROUPIER_STREAM_LANE:'lissabon-stream-lane',OPENCLAW_PRODUCT_SPEECH_URL:'https://speech.example.test',OPENCLAW_PRODUCT_SPEECH_TOKEN:'fixture-product-speech',
  CROUPIER_GENERATED_SPEECH:'1',CROUPIER_CLOUD_GENERATED_SPEECH:'1',CROUPIER_GENERATED_SPEECH_STREAMING:'1',
  CROUPIER_DEALER_SPEECH_PROFILES:'1',CROUPIER_SPEECH_STREAM_WORKER_SECRET:'fixture-worker-'.repeat(4),
  CROUPIER_SPEECH_STREAM_TICKET_SECRET:'fixture-astrid-ticket-'.repeat(4),CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD:'1',
  CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD:'5',CARTESIA_API_KEY:'fixture-cartesia',RUNPOD_API_KEY:'fixture-legacy-runpod',
  CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID:'legacy-endpoint'});
const driftProfile={id:'baseline',label:'Basprofil',endpointId:'movingfixture',releaseDigest:hash('owned fixture source'),bankHash:hash('fixture archive')};
const moving = () => ({CROUPIER_MOVING_SPEECH_ENABLED:'1',CROUPIER_MOVING_SPEECH_BANK_RECORD:JSON.stringify(privateManifest),
  CROUPIER_MOVING_SPEECH_WORKER_ORIGIN:'https://fixture-game.onrender.com',
  CROUPIER_MOVING_SPEECH_ENDPOINT_ID:'movingfixture',CROUPIER_MOVING_SPEECH_RUNPOD_API_KEY:'fixture-owned-runpod',
  CROUPIER_MOVING_SPEECH_IMAGE:`ghcr.io/jakeminator123/moving-gpu-worker@sha256:${hash('owned fixture image')}`,
  CROUPIER_MOVING_SPEECH_RELEASE_SHA256:hash('owned fixture source'),CROUPIER_MOVING_SPEECH_TICKET_SECRET:'fixture-moving-ticket-'.repeat(4),
  CROUPIER_STUDIO_MOVING_DRIFT_API:'1',CROUPIER_STUDIO_MOVING_DRIFT_PROFILES:JSON.stringify([driftProfile])});
const children = env => childSpecifications(validateCloudConfig(env),env,{labInternalSecret:'fixture-lab-only-'.repeat(4)});

test('moving configuration is explicit and passes its private values to Web only; Astrid stays unchanged',()=>{
  const legacy=children(base()),env={...base(),...moving()},configured=children(env);
  for(const [key,value] of Object.entries(moving())){
    assert.equal(configured.web.env[key],value);assert.equal(configured.lab.env[key],undefined);
  }
  assert.deepEqual(configured.lab,legacy.lab);
  const withoutMoving=Object.fromEntries(Object.entries(configured.web.env).filter(([key])=>!key.startsWith('CROUPIER_MOVING_')&&!['CROUPIER_STUDIO_MOVING_DRIFT_API','CROUPIER_STUDIO_MOVING_DRIFT_PROFILES'].includes(key)));
  assert.deepEqual(withoutMoving,legacy.web.env);
});

test('moving drift forwards the validated baseline to the game child without unrelated environment',()=>{
  const env={...base(),...moving(),UNRELATED_PROVIDER_SECRET:'must-not-leak',CROUPIER_STUDIO_MOVING_DRIFT_OTHER:'must-not-leak'};
  const config=validateCloudConfig(env);
  // Forward the validated snapshot even if the caller subsequently edits its input.
  env.CROUPIER_STUDIO_MOVING_DRIFT_PROFILES='[]';
  const specs=childSpecifications(config,env,{labInternalSecret:'fixture-lab-only-'.repeat(4)});
  assert.deepEqual(movingDriftConfiguration(specs.web.env),{profiles:[driftProfile]});
  assert.equal(specs.web.env.CROUPIER_MOVING_SPEECH_ENABLED,'1');
  for(const name of ['CROUPIER_STUDIO_MOVING_DRIFT_API','CROUPIER_STUDIO_MOVING_DRIFT_PROFILES'])assert.equal(specs.lab.env[name],undefined);
  for(const name of ['UNRELATED_PROVIDER_SECRET','CROUPIER_STUDIO_MOVING_DRIFT_OTHER']){
    assert.equal(specs.web.env[name],undefined);assert.equal(specs.lab.env[name],undefined);
  }
});

test('moving drift rejects missing, malformed or mismatched catalogues before starting children',()=>{
  for(const change of [
    {CROUPIER_STUDIO_MOVING_DRIFT_API:undefined},{CROUPIER_STUDIO_MOVING_DRIFT_API:'0'},{CROUPIER_STUDIO_MOVING_DRIFT_API:'true'},
    ...[undefined,'','invalid','[]',JSON.stringify([driftProfile,{...driftProfile,id:'other'}]),
      JSON.stringify([{...driftProfile,endpointId:'another001'}]),JSON.stringify([{...driftProfile,releaseDigest:hash('different release')}]),
      JSON.stringify([{...driftProfile,apiKey:'must-not-leak'}])].map(raw=>({CROUPIER_STUDIO_MOVING_DRIFT_PROFILES:raw})),
  ])assert.throws(()=>validateCloudConfig({...base(),...moving(),...change}),
    error=>/CROUPIER_STUDIO_MOVING_DRIFT/.test(error.message)&&!error.message.includes('must-not-leak'));
});

test('unset and disabled moving flags forward no staged credentials and preserve legacy children',()=>{
  const legacy=children(base());
  for(const flag of [undefined,'','0']){
    const env={...base(),...moving(),CROUPIER_MOVING_SPEECH_ENABLED:flag,CROUPIER_MOVING_SPEECH_BANK_RECORD:'not parsed while disabled'};
    assert.equal(validateCloudConfig(env).movingSpeech,null);assert.deepEqual(children(env),legacy);
  }
  for(const flag of ['true','yes','2'])assert.throws(()=>children({...base(),...moving(),CROUPIER_MOVING_SPEECH_ENABLED:flag}),/CROUPIER_MOVING_SPEECH_ENABLED/);
});

test('moving activation requires registered profiles, Neon and private Blob without enabling them implicitly',()=>{
  const env={...base(),...moving()};
  for(const change of [{CROUPIER_DEALER_SPEECH_PROFILES:'0'},{CROUPIER_STUDIO_NEON_POLICY:'0'},
    {CROUPIER_MEDIA_STORAGE:'disk'},{BLOB_READ_WRITE_TOKEN:''},{CROUPIER_DATABASE:'sqlite'},
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
  assert.equal(specs.web.env.PUBLIC_URL,env.PUBLIC_URL);assert.equal(specs.lab.env.CROUPIER_MOVING_SPEECH_WORKER_ORIGIN,undefined);
});

test('bank configuration accepts only hash-bound private JSON manifests up to128KiB',()=>{
  const env={...base(),...moving()},key='CROUPIER_MOVING_SPEECH_BANK_RECORD';
  for(const bad of ['null','{}','not-json',JSON.stringify({...privateManifest,size:131073}),
    JSON.stringify({...privateManifest,sha256:hash('different')}),JSON.stringify({...privateManifest,url:'https://public.example.test/bank'}),
    JSON.stringify({...privateManifest,contentType:'video/mp4'}),JSON.stringify({...privateManifest,pathname:privateManifest.pathname.replace('/moving-bank/','/other/')}),
    ' '.repeat(131073)])assert.throws(()=>validateCloudConfig({...env,[key]:bad}),/CROUPIER_MOVING_SPEECH_BANK_RECORD/);
  assert.ok(validateCloudConfig({...env,[key]:JSON.stringify({...privateManifest,size:131072})}).movingSpeech);
});

test('moving provider identity is immutable and ticket secrets cannot reuse Astrid or provider credentials',()=>{
  const env={...base(),...moving()};
  for(const [key,bad] of [
    ['ENDPOINT_ID','../legacy'],['ENDPOINT_ID',''],['RUNPOD_API_KEY','contains whitespace'],
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
  // Copy the real boot-config source closure and the Lab dependencies that
  // Render already installs. Frontend and speech dependencies stay absent.
  await copySource('ops/cloud/config.mjs');
  await symlink(await realpath(join(sourceRoot, 'apps/studio/node_modules')), join(root, 'apps/studio/node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const isolated = await import(pathToFileURL(join(root, 'ops/cloud/config.mjs')).href);
  const env = base();
  assert.deepEqual(isolated.validateCloudConfig(env, {repository:root}), validateCloudConfig(env, {repository:root}));
});
