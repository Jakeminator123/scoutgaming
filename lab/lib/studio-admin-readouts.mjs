import {SHOE_RULES} from '../../web/shoe-game.mjs';
import {EMAIL_TEMPLATES} from '../../web/email-templates.mjs';
import {validateStudioScope,canonicalStudioJson} from '../../packages/studio-registry/server/document-contract.mjs';
import {isStudioRole} from './studio-access-policy.mjs';

const fail=()=>{throw Object.assign(Error('studio_admin_readout_unavailable'),{statusCode:503});};
// Read only projections of persisted Render state. Card order, hole cards,
// player identities and balances never enter the response or the Vercel process.
export function createStudioAdminReadouts({db,scope,now=()=>new Date().toISOString()}={}) {
  scope=validateStudioScope(scope);
  const handlers=new Map();
  const register=(action,read)=>handlers.set(`GET /studio/api/admin/${action}`,async context=>{
    if(canonicalStudioJson(validateStudioScope(context.scope))!==canonicalStudioJson(scope)
      || !isStudioRole(context.actor?.role) || typeof context.actor?.user!=='string' || !context.actor.user.trim()) {
      throw Object.assign(Error('studio_admin_request_rejected'),{statusCode:403});
    }
    return read();
  });
  register('emails',()=>({templates:structuredClone(EMAIL_TEMPLATES),previewOnly:true}));
  register('shoes',async()=>{
    if(!db?.prepare)fail();
    const rows=await db.prepare(`SELECT COUNT(*) OVER () AS total,
      jsonb_typeof(state::jsonb) AS state_type,
      jsonb_typeof(state::jsonb->'shoe') AS shoe_type,
      jsonb_typeof(state::jsonb->'round') AS round_type,
      jsonb_typeof(state::jsonb->'paid') AS paid_type,
      state::jsonb->>'version' AS version,
      state::jsonb->'shoe'->>'id' AS shoe_id,
      state::jsonb->'shoe'->>'dealt' AS dealt,
      jsonb_array_length(state::jsonb->'shoe'->'cards') AS remaining,
      state::jsonb->'shoe'->>'cutReached' AS cut_reached,
      state::jsonb->'round'->>'phase' AS phase,
      state::jsonb->>'paid' AS paid
      FROM blackjack_tables ORDER BY player_id LIMIT 500`).all();
    let shoes=0,activeRounds=0,cutReached=0;
    for(const row of rows) {
      if(!/^\d+$/.test(String(row.total)) || Number(row.total)<rows.length || row.state_type!=='object'
        || !['object','null'].includes(row.shoe_type) || !['object','null'].includes(row.round_type)
        || row.paid_type!=='boolean' || !/^\d+$/.test(row.version??'') || !Number.isSafeInteger(Number(row.version)))fail();
      if((row.shoe_type==='object')!==(row.shoe_id!==null) || (row.round_type==='object')!==(row.phase!==null))fail();
      if(row.shoe_id!==null) {
        const dealt=Number(row.dealt),remaining=Number(row.remaining);
        if(typeof row.shoe_id!=='string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(row.shoe_id)
          || row.dealt===null || row.remaining===null || !Number.isSafeInteger(dealt) || !Number.isSafeInteger(remaining)
          || dealt<SHOE_RULES.burn || remaining<0 || dealt+remaining!==SHOE_RULES.total
          || !['true','false'].includes(row.cut_reached) || (row.cut_reached==='true')!==(dealt>=SHOE_RULES.cutAfter))fail();
        shoes++;if(row.cut_reached==='true')cutReached++;
      } else if(row.dealt!==null || row.remaining!==null || row.cut_reached!==null)fail();
      if(!['true','false'].includes(row.paid) || row.phase!==null && !['insurance','decisions','settled'].includes(row.phase))fail();
      if(row.phase!==null && row.paid==='false')activeRounds++;
    }
    const total=rows.length?Number(rows[0].total):0;
    if(!Number.isSafeInteger(total) || rows.some(row=>Number(row.total)!==total))fail();
    return {rules:{...SHOE_RULES},tableCount:total,sampledTables:rows.length,partial:total>rows.length,
      shoes,activeRounds,cutReached,observedAt:now(),source:'render-persisted-state',certificationVerified:false};
  });
  return {handlers};
}
