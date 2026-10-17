// PostgreSQL implementation; explicit schema is installed before service initialization.
import { randomUUID } from 'node:crypto';
import { probePolicy } from '../../packages/presentation/contracts/probe-policy.mjs';
import { requestProductProbe } from '../../open-claw/lab/src/product-probe.mjs';
import { probeFixtures } from '../../lab/lib/probe-fixtures.mjs';
import { PROBE_MODELS } from '../../packages/presentation/contracts/probe-policy.mjs';

export function createProbeRuntime({ store, memory, projectStore, settingsProvider, serviceProvider,
  decide = requestProductProbe, now = Date.now, chatBusy = () => false } = {}) {
  const pending = new Map();
  const settling = new Map();
  function track(scope){let resolve;const promise=new Promise(done=>{resolve=done;});settling.set(key(scope),promise);return ()=>{if(settling.get(key(scope))===promise)settling.delete(key(scope));resolve();};}
  const trials = new Map();
  const key = scope => JSON.stringify([scope.playerId,scope.dealerId]);
  const fail = code => { throw Object.assign(new Error(code),{code,statusCode:409}); };
  const load = async () => { const project = await projectStore.load(); return { policy: probePolicy(project), revision: project.revision }; };
  const cancel = async (scope, reason='player_activity') => { pending.get(key(scope))?.abort(reason); trials.delete(key(scope)); (await store.activity(scope)); return settling.get(key(scope))??Promise.resolve(); };
  const quiet = state => !state.round && !chatBusy(state.playerId);
  return {
    cancel, config: load,
    async inspect(scope) { const {policy,revision}=await load(); return {...(await store.inspect(scope,policy)),policy,revision}; },
    async presence(scope, body, owner) {
      const config = await load();
      const trial=trials.get(key(scope));
      if (body.activity || !body.flags?.present || body.flags?.typing || !body.flags?.sound || !body.flags?.enabled || !body.flags?.quiet
        || (trial && (trial.revision!==config.revision || trial.created<now()-360000))) {
        pending.get(key(scope))?.abort('presence_changed');trials.delete(key(scope));
      }
      (await store.observe(scope,{...config,owner,tab:body.tab,flags:body.flags,activity:body.activity===true}));
      return {...(await store.inspect(scope,config.policy)),...config};
    },
    async forget(scope, factId) { pending.get(key(scope))?.abort('memory_forgotten'); trials.delete(key(scope)); (await store.forget(scope,factId)); },
    async test(scope, body, {owner,readOwner,readState,signal}) {
      const fixture=(await probeFixtures(now()).find(row=>row.id===body.caseId));
      if(!fixture || !PROBE_MODELS.some(row=>row.id===body.model) || typeof body.requestId!=='string' || !(await /^[a-zA-Z0-9-]{1,100}$/.test(body.requestId)))(await fail('invalid_probe_test'));
      if(pending.has(key(scope)))(await fail('probe_busy'));
      const config=await load();
      if(config.policy.mode==='off')return {reason:'off'};
      const controller=new AbortController();pending.set(key(scope),controller);const settled=track(scope);
      const combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
      const trial={ticket:body.requestId,owner,tab:body.tab,revision:config.revision,memoryRevision:(await memory.profile(scope)).revision,created:now(),state:'reserved'};
      trials.set(key(scope),trial);
      const fresh=async()=>{
        if(combined.aborted || trials.get(key(scope))!==trial || (await readOwner())!==owner || !quiet((await readState())) || !(await store.isPresent(scope,owner,body.tab))
          || (await load()).revision!==trial.revision || (await memory.profile(scope)).revision!==trial.memoryRevision)(await fail('stale_probe'));
      };
      try {
        await fresh();
        const result=await decide({version:1,requestId:body.requestId,purpose:'probe',model:body.model,reasoning:'gateway-default',context:fixture.context},settingsProvider(),{signal:combined});
        await fresh();
        if(!result.choice.speak){trials.delete(key(scope));return {reason:result.choice.reason,choice:result.choice,metrics:result.metrics};}
        const service=serviceProvider();if(!service)(await fail('probe_voice_unavailable'));
        const stages=[],started=performance.now();
        const speechPackage=await service.generate({requestId:body.requestId,text:result.choice.text,dealerId:'astrid',owner,signal:combined,beforeCostly:fresh,
          onProgress:(stage,metrics)=>stages.push({stage,elapsedMs:Math.round(performance.now()-started),...(metrics?{metrics}:{})})});
        await fresh();trial.state='generated';
        return {ticket:trial.ticket,reason:'generated',synthetic:true,choice:result.choice,policyRevision:config.revision,metrics:{...result.metrics,stages},
          decision:{kind:'generatedText',requestId:body.requestId,dealerId:'astrid',sessionRevision:body.sessionRevision,roundRevision:body.roundRevision,
            exactText:result.choice.text,visualMode:'generated-lipsync-preview',speechPackage,provider:'responded'}};
      }catch(error){trials.delete(key(scope));throw error;}
      finally{if(pending.get(key(scope))===controller)pending.delete(key(scope));settled();}
    },
    async run(scope, body, { owner, readOwner, readState, signal }) {
      if (scope.dealerId !== 'astrid') (await fail('probe_astrid_only'));
      if(trials.has(key(scope)) || pending.has(key(scope)))return {reason:'busy'};
      const config = await load();
      const reserved = (await store.reserve(scope,{...config,requestId:body.requestId,owner,tab:body.tab,quiet:quiet((await readState()))}));
      if (!reserved.ticket) return reserved;
      const controller = new AbortController(); pending.set(key(scope),controller);const settled=track(scope);
      const combined = signal ? AbortSignal.any([signal,controller.signal]) : controller.signal;
      const started = performance.now(); const stages=[];
      const fresh = async () => {
        const current = await load();
        if (combined.aborted || (await readOwner())!==owner || !(await store.current(scope,{...current,ticket:reserved.ticket,owner,tab:body.tab,quiet:quiet((await readState()))}))
          || (await memory.profile(scope)).revision!==reserved.memoryRevision) (await fail('stale_probe'));
      };
      try {
        await fresh();
        const result = await decide({version:1,requestId:body.requestId,purpose:'probe',model:config.policy.model,reasoning:config.policy.reasoning,
          context:{now:now(),displayName:(await readState()).displayName,language:'en',history:(await memory.profile(scope)).history,
            memories:reserved.memories,recentTopics:reserved.recentTopics,nameAllowed:reserved.nameAllowed,quiet:true}},settingsProvider(),{signal:combined});
        await fresh();
        const state=(await store.generated(scope,reserved.ticket,result.choice));
        if(state!=='generated')return {ticket:reserved.ticket,reason:state,choice:result.choice,metrics:result.metrics};
        const service=serviceProvider(); if(!service)(await fail('probe_voice_unavailable'));
        await fresh();
        const speechPackage=await service.generate({requestId:body.requestId,text:result.choice.text,dealerId:'astrid',owner,signal:combined,beforeCostly:fresh,
          onProgress:(stage,metrics)=>stages.push({stage,elapsedMs:Math.round(performance.now()-started),...(metrics?{metrics}:{})})});
        await fresh();
        return {ticket:reserved.ticket,reason:'generated',choice:result.choice,policyRevision:config.revision,metrics:{...result.metrics,stages,totalMs:Math.round(performance.now()-started)},
          decision:{kind:'generatedText',requestId:body.requestId,dealerId:'astrid',sessionRevision:body.sessionRevision,roundRevision:body.roundRevision,
            exactText:result.choice.text,visualMode:'generated-lipsync-preview',speechPackage,provider:'responded'}};
      } catch(error) {
        (await store.finish(scope,reserved.ticket,combined.aborted||error.code==='stale_probe'?'cancelled':'failed'));
        throw error;
      } finally {if(pending.get(key(scope))===controller)pending.delete(key(scope));settled();}
    },
    async receipt(scope, body, {owner,readOwner,readState}) {
      if(body.synthetic){
        const trial=trials.get(key(scope));
        if(!trial || trial.ticket!==body.ticket || trial.owner!==owner || trial.tab!==body.tab)(await fail('stale_probe'));
        if(['cancelled','failed'].includes(body.state)){trials.delete(key(scope));return {accepted:true};}
        if((await readOwner())!==owner || !quiet((await readState())) || !(await store.isPresent(scope,owner,body.tab)) || trial.created<now()-360000
          || trial.revision!==(await load()).revision || trial.memoryRevision!==(await memory.profile(scope)).revision)(await fail('stale_probe'));
        if(body.state==='playing' && ['generated','playing'].includes(trial.state))trial.state='playing';
        else if(body.state==='played' && trial.state==='playing')trials.delete(key(scope));
        else (await fail('invalid_probe_receipt'));
        return {accepted:true,synthetic:true};
      }
      if(['cancelled','failed'].includes(body.state)){(await store.finish(scope,body.ticket,body.state));return {accepted:true};}
      const config=await load();
      if((await readOwner())!==owner||!(await store.current(scope,{...config,ticket:body.ticket,owner,tab:body.tab,quiet:quiet((await readState()))}))) {
        (await store.finish(scope,body.ticket,'cancelled'));(await fail('stale_probe'));
      }
      return {accepted:(await store.finish(scope,body.ticket,body.state))};
    },
    async rememberMessage(scope, requestId, text, generation) {
      generation ??= await store.generation(scope);
      const config=await load();
      if(!config.policy.memoryEnabled || config.policy.mode==='off')return;
      if((await store.message(scope,requestId,text,generation))===false)return;
      const job=(await store.extraction(scope,config.policy));if(!job)return;
      // User-only extraction is outside the response's critical path. Generation
      // and epoch are rechecked on commit, including a concurrent Forget.
      let sources=job.sources;
      while(sources.reduce((sum,row)=>sum+row.text.length,0)>8000)sources=sources.slice(1);
      try {
        const result=await decide({version:1,requestId:randomUUID(),purpose:'extract',model:config.policy.model,reasoning:config.policy.reasoning,
          context:{now:now(),sources}},settingsProvider());
        const latest=await load();
        if(latest.revision===config.revision&&latest.policy.memoryEnabled)(await store.saveExtraction(scope,job,result.facts,latest.policy));
      } catch { /* No facts are safer than an uncertain or failed extraction. */ }
    },
    async completedRound(scope, evidence, generation) { generation ??= await store.generation(scope); const {policy}=await load();(await store.completedRound(scope,evidence,policy,generation)); },
  };
}
