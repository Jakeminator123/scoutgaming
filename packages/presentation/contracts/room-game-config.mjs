const object = value => value && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const fail = () => { throw Object.assign(new Error('studio_invalid_room_game_config'), {code:'studio_invalid_room_game_config',statusCode:422}); };
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value) && !['__proto__','constructor','prototype'].includes(value);
export const ROOM_GAME_TIMERS = Object.freeze({betMs:20000,actionMs:15000});
export const ROOM_LIMIT_PRESETS = Object.freeze({
  casual:Object.freeze({min:1,max:500,sideMax:50,chips:Object.freeze([1,5,10,25,50,100]),refill:500}),
  prive:Object.freeze({min:5,max:2000,sideMax:200,chips:Object.freeze([5,10,25,50,100,500]),refill:1000}),
  high:Object.freeze({min:100,max:25000,sideMax:1000,chips:Object.freeze([100,500,1000,5000,10000,25000]),refill:50000}),
});
export function validateRoomGameConfig(value) {
  if(!exact(value,['language','limitPreset']) || !['en','sv'].includes(value.language) || !Object.hasOwn(ROOM_LIMIT_PRESETS,value.limitPreset))fail();
  return {...value};
}
export function validateRoomGameDrafts(value, rooms) {
  if(!Array.isArray(value)||value.length>1000)fail();
  const seen=new Set();
  // Archived rooms may retain their drafts for restoration. The publication writer rechecks live ownership.
  return value.map(row=>{
    if(!exact(row,['roomId','operatorId','revision','basePackageRevision','gameConfig'])||!id(row.roomId)||!id(row.operatorId)
      ||typeof row.revision!=='string'||!/^room-config-[a-f0-9-]{36}$/.test(row.revision)
      ||!Number.isSafeInteger(row.basePackageRevision)||row.basePackageRevision<1||seen.has(row.roomId)
      ||rooms?.some(room=>room.id===row.roomId&&(room.operatorId!==row.operatorId||room.schemaVersion!==2||(room.game??'blackjack')!=='blackjack')))fail();
    seen.add(row.roomId);return {...row,gameConfig:validateRoomGameConfig(row.gameConfig)};
  });
}
// This is supplied by the verified frozen-media adapter, never by an Admin request.
// Absence is a publication blocker, not permission to use fixture timing or another language.
export function validateRoomGameMaterial(value, {language,dealerId}={}) {
  if(!exact(value,['revision','dealerId','language','leadMs','cardMs','media'])||!id(value.revision)||value.dealerId!==dealerId||value.language!==language
    ||!Number.isSafeInteger(value.leadMs)||value.leadMs<0||value.leadMs>60000||!Number.isSafeInteger(value.cardMs)||value.cardMs<1||value.cardMs>60000
    ||!Array.isArray(value.media)||!value.media.length||value.media.length>256)fail();
  const seen=new Set();
  for(const row of value.media) {
    if(!exact(row,['id','sha256'])||!id(row.id)||!/^[a-f0-9]{64}$/.test(row.sha256)||seen.has(row.id))fail();seen.add(row.id);
  }
  return structuredClone(value);
}
