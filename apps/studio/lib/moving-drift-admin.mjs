import {createMovingDriftController} from '../../../services/game/moving-drift-controller.mjs';
import {createPostgresMovingDriftStore} from '../../../services/game/postgres-moving-drift.mjs';
import {driftError} from '../../../packages/presentation/contracts/moving-drift.mjs';
import {publicMovingDriftStatus} from '../../../packages/presentation/contracts/moving-drift-admin.mjs';
import {validateStudioScope} from '../../../packages/studio-registry/server/document-contract.mjs';

const path='/studio/api/admin/moving-drift';
const profileKeys=['id','label','endpointId','releaseDigest','bankHash'];

/** Explicit server configuration only. Importing or configuring never connects. */
export function movingDriftAdminConfiguration(env={}) {
  if(env.CROUPIER_STUDIO_MOVING_DRIFT_API!=='1') return null;
  const raw=env.CROUPIER_STUDIO_MOVING_DRIFT_PROFILES;
  if(typeof raw!=='string'||Buffer.byteLength(raw)>8192) throw driftError('drift_invalid_configuration',422);
  let profiles;
  try { profiles=JSON.parse(raw); } catch { throw driftError('drift_invalid_configuration',422); }
  if(!Array.isArray(profiles)||!profiles.length||profiles.length>8||profiles.some(profile=>
    !profile||typeof profile!=='object'||Array.isArray(profile)
      ||Object.keys(profile).length!==profileKeys.length||profileKeys.some(key=>!Object.hasOwn(profile,key)))) {
    throw driftError('drift_invalid_configuration',422);
  }
  return Object.freeze({profiles:structuredClone(profiles)});
}

/**
 * Control state only. N1, same-origin/CSRF, fresh identity and the product mutation
 * lock belong to createStudioAdminApi. Calls also bind to the configured scope.
 * No provider/executor/observer/admission capability is exposed.
 * Configuration cannot declare a live runtime: connected is always false here.
 */
function nativeStore({pool,boDb,environmentId}) {
  if(!boDb) return createPostgresMovingDriftStore({pool,environmentId});
  return createPostgresMovingDriftStore({environmentId,transaction:work=>boDb.transaction(()=>work({
    async query(sql,values=[]) {
      if(sql.startsWith('SET LOCAL ')) {await boDb.exec(sql);return {rows:[]};}
      return {rows:await boDb.prepare(sql).all(...values)};
    },
  }))});
}
export function createMovingDriftAdminApi({pool,boDb,scope,env={},controllerFactory=createMovingDriftController,
  storeFactory=nativeStore}={}) {
  scope=validateStudioScope(scope);
  let controller;
  try {
    const configuration=movingDriftAdminConfiguration(env);
    if(!configuration) return Object.freeze({handlers:new Map(),gates:new Map(),configured:false});
    controller=controllerFactory({
      store:storeFactory({pool,boDb,environmentId:scope.environment}),
      profiles:configuration.profiles,capabilities:{connected:false},
    });
    if(typeof controller?.status!=='function'||typeof controller?.command!=='function') throw Error('invalid_controller');
  } catch {
    // Optional configuration/schema must not take unrelated Admin services down.
    // Empty registrations fail closed and are absent from availableActions.
    return Object.freeze({handlers:new Map(),gates:new Map(),configured:false});
  }
  const inScope=context=>context.scope.environment===scope.environment&&context.scope.workspaceId===scope.workspaceId;
  const run=async(context,write)=>{
    if(!inScope(context)) throw Object.assign(new Error('Access denied'),{statusCode:403});
    return publicMovingDriftStatus(write?await controller.command(context.body):await controller.status());
  };
  return Object.freeze({configured:true,
    handlers:new Map([['GET '+path,context=>run(context,false)],['POST '+path,context=>run(context,true)]]),
    gates:new Map([['moving-drift-control',inScope]]),
  });
}