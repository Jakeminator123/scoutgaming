// Portable, explicit authoring contract. Never selects media from inventory.
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const fail = () => { throw Object.assign(Error('studio_roulette_idle_invalid'), {code:'studio_roulette_idle_invalid', statusCode:422}); };
function exact(value, required, optional=[]) {
  if (!value || typeof value!=='object' || Array.isArray(value)
    || ![Object.prototype,null].includes(Object.getPrototypeOf(value))
    || Object.getOwnPropertySymbols(value).length || Object.getOwnPropertyNames(value).length!==Object.keys(value).length
    || required.some(key=>!Object.hasOwn(value,key)) || Object.keys(value).some(key=>![...required,...optional].includes(key))) fail();
  for (const key of Object.keys(value)) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value')) fail();
}
function list(value,max) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value)!==Array.prototype || value.length>max
    || Object.getOwnPropertySymbols(value).length || Object.getOwnPropertyNames(value).length!==value.length+1
    || Object.keys(value).length!==value.length) fail();
  for(let i=0;i<value.length;i++) if(!Object.hasOwn(Object.getOwnPropertyDescriptor(value,i)??{},'value')) fail();
  return value;
}
export function validateRouletteForegroundPolygons(value) {
  list(value,4);
  if(!value.length) fail();
  return value.map(polygon=>{
    list(polygon,12); if(polygon.length<3) fail();
    const points=polygon.map(point=>{list(point,2);if(point.length!==2||point.some(n=>!Number.isFinite(n)||n<0||n>1))fail();return [...point];});
    if(new Set(points.map(point=>point.join(','))).size!==points.length) fail();
    const area=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
    if(Math.abs(area)<1e-8) fail();
    return points;
  });
}
export function validateRouletteIdleBinding(value) {
  exact(value,['videoId'],['variantVideoIds','foregroundPolygons']);
  if(typeof value.videoId!=='string'||!uuid.test(value.videoId)) fail();
  if(Object.hasOwn(value,'variantVideoIds')) {
    list(value.variantVideoIds,3);
    if(value.variantVideoIds.some(id=>typeof id!=='string'||!uuid.test(id)||id===value.videoId)
      ||new Set(value.variantVideoIds).size!==value.variantVideoIds.length) fail();
  }
  if(Object.hasOwn(value,'foregroundPolygons')) validateRouletteForegroundPolygons(value.foregroundPolygons);
  return structuredClone(value);
}
export function assertRouletteIdleRecord(record,dealerId,action='breathing') {
  const metadata=record?.classification;
  if(record?.contentType!=='video/webm'||metadata?.dealerId!==dealerId||metadata.game!=='roulette'
    ||metadata.eventId!=='roulette.idle'||metadata.situation!==action||metadata.action!==action
    ||metadata.kind!=='idle'||metadata.mediaType!==undefined||metadata.archived===true
    ||(metadata.playback??'once')!=='once'||metadata.compositing?.mode!=='alpha') fail();
  return record;
}
export function validateFrozenRouletteIdle(value,dealerId,validateRecord) {
  exact(value,['base','variants'],['foregroundPolygons']); list(value.variants,3);
  const base=assertRouletteIdleRecord(validateRecord(value.base),dealerId);
  const variants=value.variants.map(record=>assertRouletteIdleRecord(validateRecord(record),dealerId,'glasses-clean'));
  if(new Set([base.id,...variants.map(record=>record.id)]).size!==variants.length+1) fail();
  // A single foreground profile cannot safely describe different transforms.
  const framing=record=>JSON.stringify(record.classification.framing?Object.entries(record.classification.framing).sort():null);
  if(variants.some(record=>framing(record)!==framing(base))) fail();
  const foregroundPolygons=Object.hasOwn(value,'foregroundPolygons')?validateRouletteForegroundPolygons(value.foregroundPolygons):undefined;
  if(foregroundPolygons&&!base.classification.framing) fail();
  return {base,variants,...(foregroundPolygons?{foregroundPolygons}:{})};
}
