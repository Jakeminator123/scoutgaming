import {studioRoots} from './studio-roots.mjs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readSettings } from './director-settings.mjs';
import { decideProductProbe, validateProbeChoice } from '../../../packages/director/product-probe.mjs';
import { validateProbePolicy, PROBE_MODELS } from '../../../packages/presentation/contracts/probe-policy.mjs';
import { probeFixtures } from '../../../packages/presentation/contracts/probe-fixtures.mjs';
import { remoteRequest } from '../../../packages/presentation/server/director-transport.mjs';
import { StudioError } from './project-store.mjs';
import { assertLocalRequest, readLocalJson, jsonResponse, errorResponse } from './http-guard.mjs';

const LAB_DIR=studioRoots().appRoot;

export async function probeEndpoint(request) {
  try {
    assertLocalRequest(request);
    if(request.method==='GET')return jsonResponse({fixtures:probeFixtures(),models:PROBE_MODELS});
    const body=await readLocalJson(request);
    let policy;
    try { policy=validateProbePolicy(body.policy); } catch { throw new StudioError("Ogiltig Probe-policy.",400); }
    if(policy.mode==='off')return jsonResponse({reason:'off',choice:null,metrics:{modelMs:0},usedMemories:[]});
    const fixture=probeFixtures().find(row=>row.id===body.caseId);
    if(!fixture)throw new StudioError('Välj en känd syntetisk spelarkontext.');
    if(body.forgotten!==undefined&&(!Array.isArray(body.forgotten)||body.forgotten.some(id=>typeof id!=='string')))throw new StudioError('Ogiltigt minnesval.');
    fixture.context.memories=policy.memoryEnabled?fixture.context.memories.filter(row=>!body.forgotten?.includes(row.id) && row.createdAt>fixture.context.now-policy.memoryDays*86400000).slice(0,policy.maxFacts):[];
    const settings=readSettings({envFiles:[resolve(LAB_DIR,'../../.env'),resolve(LAB_DIR,'.env.local')]});
    const input={version:1,requestId:randomUUID(),purpose:'probe',model:policy.model,reasoning:policy.reasoning,context:fixture.context};
    let result;
    try { result=settings.remoteUrl ? await remoteRequest('/api/studio/probe',input,settings,fetch,32000) : await decideProductProbe(input,settings); }
    catch(error){if(error.message?.includes('studio-protokollet'))throw new StudioError('Render saknar Probe-stödet. Driftsätt den uppdaterade Director-tjänsten; ingen ny API-nyckel behövs.',503);throw error;}
    result.choice=validateProbeChoice(result.choice,input);
    return jsonResponse({...result,reason:result.choice.speak?'generated':result.choice.reason,
      usedMemories:fixture.context.memories.filter(row=>result.choice.memoryIds.includes(row.id)),fixtureId:fixture.id,scope:'synthetic-text-only'});
  }catch(error){return errorResponse(error);}
}
