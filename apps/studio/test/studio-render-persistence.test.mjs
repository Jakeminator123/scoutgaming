import { fixtureDatabaseUrl } from '../../../test/fixtures/database-url.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioRenderPersistence,assertRenderStudioWritable} from '../lib/studio-render-persistence.mjs';
import {createSeedProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {createSocialPolicy} from './fixtures/social-store.mjs';
import {createStudioRepository} from '../../../packages/studio-registry/server/document-repository.mjs';
import {createStudioMemoryPool} from '../../../test/fixtures/studio-memory-pool.mjs';
import {createNeonProjectStore} from '../lib/neon-project-store.mjs';

const scope = Object.freeze({environment:'test',workspaceId:'studio-test'});
const env = {CROUPIER_STUDIO_NEON_POLICY:'1',CROUPIER_DATABASE:'postgres',CROUPIER_GAME_DATABASE_URL:fixtureDatabaseUrl('postgresql://game.neon.tech/game?sslmode=require', 'u')};
async function fixture() {
  const pool = createStudioMemoryPool(),repository = createStudioRepository({pool,scope});
  await repository.initializeDocument('project',{value:createSeedProject(),actor:'migration'});
  await repository.initializeDocument('social-policy',{value:createSocialPolicy(),actor:'migration'});
  const calls = [], source = 'explicit product SQL';let closed = 0;
  const connectionPool = {end:async () => closed++};
  const options = {env,poolFactory:async connection => {calls.push(['pool',connection]);return connectionPool;},
    readText:async (path,encoding) => {calls.push(['source',path,encoding]);return source;},
    storeFactory:() => ({pool:connectionPool,db:{assertInstalled:async body => {assert.deepEqual(body,{source});calls.push(['schema']);}}}),
    schemaCheck:async ({pool:actual,directory}) => {assert.equal(actual,connectionPool);calls.push(['studio-schema',directory]);return {applied:[{version:'001'},{version:'002'}],toApply:[]};},
    policyFactory:async ({storage,schemaCheck}) => {
      await storage.db.assertInstalled();await schemaCheck({pool:storage.pool});
      return {scope,repository,policy:{projectStore:() => createNeonProjectStore({repository,scope})}};
    },
    mediaFactory:() => ({videoRegistry:async () => ({videos:[],source:'neon'}),legacyControls:async project => ({revision:project.revision})}),
  };
  return {options,calls,pool,repository,closed:() => closed};
}
test('protected Render reads same committed project/social revisions, with no write actor or fallback',async () => {
  const {options,calls,pool,repository,closed} = await fixture(),reader = await createStudioRenderPersistence(options);
  const project = await reader.projectStore.load(),social = await reader.socialStore.load(),before = pool.snapshot();
  assert.equal(reader.configurationSource,'neon/croupier_studio');
  assert.equal(project.revision,(await repository.readDocument('project')).revision);
  assert.equal(social.revision,(await repository.readDocument('social-policy')).revision);
  assert.equal((await reader.videoRegistry()).source,'neon');
  for (const store of [reader.projectStore,reader.socialStore]) await assert.rejects(store.save({},'forged'),error => error.statusCode === 410);
  assert.deepEqual(pool.snapshot(),before);assert.equal(closed(),0);
  assert.deepEqual(calls.map(call => call[0]),['pool','source','schema','studio-schema']);
  pool.failNext('read-document',new Error('DB unavailable'));
  await assert.rejects(reader.projectStore.load(),error => error.statusCode === 503);
  assert.deepEqual(pool.snapshot(),before);
});
test('disabled gate fails closed without initializing storage; invalid DB/schema cannot choose old disk state',async () => {
  let connects = 0;
  await assert.rejects(createStudioRenderPersistence({env:{},poolFactory:()=> {connects++;throw new Error('must not connect');}}),error => error.statusCode === 503);
  assert.equal(connects,0);
  assert.throws(() => assertRenderStudioWritable({}),error => error.statusCode === 410);
  assert.throws(() => assertRenderStudioWritable(env),error => error.statusCode === 410);
  for (const changed of [{CROUPIER_DATABASE:'sqlite'},{CROUPIER_GAME_DATABASE_URL:'postgresql://u:p@other.example/game?sslmode=require'},
    {CROUPIER_ZONES_DATABASE_URL:env.CROUPIER_GAME_DATABASE_URL}]) {
    await assert.rejects(createStudioRenderPersistence({env:{...env,...changed},poolFactory:()=> {throw new Error('must not connect');}}),error => error.statusCode === 503);
  }
  const {options,closed} = await fixture();
  await assert.rejects(createStudioRenderPersistence({...options,policyFactory:async () => {throw new Error('private schema');}}),error => error.statusCode === 503 && !error.message.includes('private'));
  assert.equal(closed(),1);
});
