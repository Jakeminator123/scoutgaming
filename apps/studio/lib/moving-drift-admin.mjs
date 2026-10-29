import {createMovingDriftController} from '../../../services/game/moving-drift-controller.mjs';
import {createPostgresMovingDriftStore} from '../../../services/game/postgres-moving-drift.mjs';
import {driftError,movingDriftConfiguration} from '../../../packages/presentation/contracts/moving-drift.mjs';
import {publicMovingDriftStatus} from '../../../packages/presentation/contracts/moving-drift-admin.mjs';
import {validateStudioScope} from '../../../packages/studio-registry/server/document-contract.mjs';

const path='/studio/api/admin/moving-drift';
export {movingDriftConfiguration as movingDriftAdminConfiguration};

/**
 * Control state only. N1, same-origin/CSRF, fresh identity and the product mutation
 * lock belong to createStudioAdminApi. Calls also bind to the configured scope.
 * No provider/executor/observer/admission capability is exposed. The browser
 * cannot assert connected: a matching fresh executor lease/readback in SQL is required.
 */
function nativeStore({pool,boDb,environmentId,dealerId}) {
  if(!boDb) return createPostgresMovingDriftStore({pool,environmentId,dealerId});
  return createPostgresMovingDriftStore({environmentId,dealerId,transaction:work=>boDb.transaction(()=>work({
    async query(sql,values=[]) {
      if(sql.startsWith('SET LOCAL ')) {await boDb.exec(sql);return {rows:[]};}
      return {rows:await boDb.prepare(sql).all(...values)};
    },
  }))});
}
export function createMovingDriftAdminApi({pool,boDb,scope,env={},controllerFactory=createMovingDriftController,
  storeFactory=nativeStore}={}) {
  scope=validateStudioScope(scope);
  const controllers=new Map();
  try {
    const configuration=movingDriftConfiguration(env);
    if(!configuration) return Object.freeze({handlers:new Map(),gates:new Map(),configured:false});
    // Drift state is per dealer: one row slot and one-profile catalogue per dealer,
    // as in the game's executor. Each request names its dealer; it is never guessed.
    for(const profile of configuration.profiles) {
      const controller=controllerFactory({
        store:storeFactory({pool,boDb,environmentId:scope.environment,dealerId:profile.dealerId}),
        profiles:[profile],capabilities:{connected:true,requireExecutor:true},
      });
      if(typeof controller?.status!=='function'||typeof controller?.command!=='function') throw Error('invalid_controller');
      controllers.set(profile.dealerId,controller);
    }
  } catch {
    // Optional configuration/schema must not take unrelated Admin services down.
    // Empty registrations fail closed and are absent from availableActions.
    return Object.freeze({handlers:new Map(),gates:new Map(),configured:false});
  }
  const inScope=context=>context.scope.environment===scope.environment&&context.scope.workspaceId===scope.workspaceId;
  // GET names the dealer in `?dealerId=`, POST in the body. With one profile the
  // dealer may be omitted (unchanged behaviour); with several it is required.
  const target=(context,write)=>{
    const named=write?context.body?.dealerId:new URL(context.request.url).searchParams.get('dealerId');
    if(named===undefined||named===null) {
      if(controllers.size===1) return [...controllers.values()][0];
      throw driftError('drift_dealer_required',400);
    }
    if(typeof named!=='string'||!controllers.has(named)) throw driftError('drift_unknown_dealer',422);
    return controllers.get(named);
  };
  const run=async(context,write)=>{
    if(!inScope(context)) throw Object.assign(new Error('Access denied'),{statusCode:403});
    const controller=target(context,write);
    if(!write) return publicMovingDriftStatus(await controller.status());
    const {dealerId:_dealer,...command}=context.body;
    return publicMovingDriftStatus(await controller.command(command));
  };
  return Object.freeze({configured:true,
    handlers:new Map([['GET '+path,context=>run(context,false)],['POST '+path,context=>run(context,true)]]),
    gates:new Map([['moving-drift-control',inScope]]),
  });
}