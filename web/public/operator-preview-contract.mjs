import {isGameLaneId,isOperatorSlug} from './game-lanes.mjs';
import {isDealerId} from './dealer-identity.mjs';
import {validateCompositionSettings} from './composition-settings.mjs';
import {validateDealerFraming} from './dealer-framing.mjs';
import {validateRouletteForegroundPolygons} from './roulette-idle-contract.mjs';
import {validateRouletteStartProfile} from './roulette-start-contract.mjs';
import {materialById} from './material-catalog.mjs';

const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const types=new Set(['image/png','image/jpeg','image/webp','video/mp4','video/webm']);
const fail=()=>{throw Error('Invalid operator preview');};
function exact(value,keys,optional=[]) {
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))
    ||Object.getOwnPropertySymbols(value).length||Object.getOwnPropertyNames(value).length!==Object.keys(value).length
    ||keys.some(key=>!Object.hasOwn(value,key))||Object.keys(value).some(key=>![...keys,...optional].includes(key)))fail();
  for(const key of Object.keys(value))if(!Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'))fail();
}
function label(value,max=120) {
  if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f\u007f-\u009f]/u.test(value))fail();
}
export function previewMediaPath({operatorSlug,roomId,packageRevision,dealerId},kind,id) {
  if(!isOperatorSlug(operatorSlug)||!isGameLaneId(roomId)||!isDealerId(dealerId)
    ||!Number.isSafeInteger(packageRevision)||packageRevision<1||!['dealer','table','background'].includes(kind)||!UUID.test(id))fail();
  return '/api/operators/'+operatorSlug+'/rooms/'+roomId+'/preview/media/'+packageRevision+'/'+dealerId+'/'+kind+'/'+id;
}
function compositing(value) {
  if(value?.mode==='alpha'){exact(value,['mode']);return;}
  exact(value,['mode','threshold','softness','despill']);
  if(value.mode!=='green-screen'||value.softness<=0||['threshold','softness','despill'].some(key=>!Number.isFinite(value[key])||value[key]<0||value[key]>1))fail();
}
/** Explicit public-only schema. Never accepts raw storage records or arbitrary remote URLs. */
export function validatePublicOperatorPreview(value,expected={}) {
  exact(value,['schemaVersion','operatorSlug','roomId','packageRevision','dealer','independentLayers','settings','media']);
  exact(value.dealer,['id','label']);exact(value.media,['dealer','tables','backgrounds']);
  const context={operatorSlug:value.operatorSlug,roomId:value.roomId,packageRevision:value.packageRevision,dealerId:value.dealer.id};
  previewMediaPath(context,'dealer','00000000-0000-4000-8000-000000000001');
  if(value.schemaVersion!==1||typeof value.independentLayers!=='boolean'
    ||Object.entries(expected).some(([key,entry])=>!Object.hasOwn(context,key)||context[key]!==entry))fail();
  label(value.dealer.label);
  if(value.settings!==null)validateCompositionSettings(value.settings);
  if(value.independentLayers!==(value.settings!==null))fail();
  if(value.media.dealer!==null) {
    const media=value.media.dealer;
    exact(media,['src','contentType'],['compositing','framing','variants','foregroundPolygons','wheelStart']);
    function clip(row) {
      if(!['video/mp4','video/webm'].includes(row.contentType)||typeof row.src!=='string')fail();
      const id=row.src.split('/').at(-1);
      if(row.src!==previewMediaPath(context,'dealer',id))fail();
      if(row.compositing!==undefined)compositing(row.compositing);
      if(row.framing!==undefined)validateDealerFraming(row.framing);
    }
    clip(media);
    if(Object.hasOwn(media,'variants')) {
      const rows=media.variants;
      if(!Array.isArray(rows)||Object.getPrototypeOf(rows)!==Array.prototype||rows.length>3
        ||Object.getOwnPropertySymbols(rows).length||Object.getOwnPropertyNames(rows).length!==rows.length+1
        ||Object.keys(rows).length!==rows.length)fail();
      const sources=new Set([media.src]);
      for(let i=0;i<rows.length;i++) {
        if(!Object.hasOwn(Object.getOwnPropertyDescriptor(rows,i)??{},'value'))fail();
        const row=rows[i];exact(row,['src','contentType'],['compositing','framing']);clip(row);
        if(sources.has(row.src)||row.contentType!=='video/webm'||row.compositing?.mode!=='alpha')fail();sources.add(row.src);
        const frame=value=>value?JSON.stringify(Object.entries(value).sort()):'null';
        if(frame(row.framing)!==frame(media.framing))fail();
      }
      if(media.contentType!=='video/webm'||media.compositing?.mode!=='alpha')fail();
    }
    if(Object.hasOwn(media,'foregroundPolygons')) {
      validateRouletteForegroundPolygons(media.foregroundPolygons);
      if(!media.framing||media.contentType!=='video/webm'||media.compositing?.mode!=='alpha')fail();
    }
    if(Object.hasOwn(media,'wheelStart')) {
      const row=media.wheelStart;
      exact(row,['src','contentType','compositing','framing','tableDesignId','durationMs','wheelImpulseMs','ballReleaseMs'],['foregroundPolygons']);
      clip(row);
      const {src,contentType,compositing:mode,framing,...profile}=row;
      validateRouletteStartProfile(profile);
      if(!value.independentLayers||contentType!=='video/webm'||mode.mode!=='alpha'
        ||media.contentType!=='video/webm'||media.compositing?.mode!=='alpha'
        ||[media.src,...(media.variants??[]).map(variant=>variant.src)].includes(src))fail();
    }
  }
  for(const [key,role] of [['tables','table'],['backgrounds','background']]) {
    const rows=value.media[key];
    if(!Array.isArray(rows)||Object.getPrototypeOf(rows)!==Array.prototype||rows.length>32
      ||Object.getOwnPropertySymbols(rows).length||Object.getOwnPropertyNames(rows).length!==rows.length+1
      ||Object.keys(rows).length!==rows.length||!value.independentLayers&&rows.length)fail();
    const ids=new Set();
    for(let i=0;i<rows.length;i++) {
      if(!Object.hasOwn(Object.getOwnPropertyDescriptor(rows,i)??{},'value'))fail();
      const row=rows[i];exact(row,['id','label','src','contentType'],role==='table'?['designId']:[]);label(row.label,80);
      if(Object.hasOwn(row,'designId')&&materialById(row.designId)?.role!=='table')fail();
      if(ids.has(row.id)||!types.has(row.contentType)
        ||row.src!==previewMediaPath(context,role,row.id))fail();
      ids.add(row.id);
    }
  }
  if(value.media.dealer?.wheelStart&&!value.media.tables.some(row=>row.designId===value.media.dealer.wheelStart.tableDesignId))fail();
  return structuredClone(value);
}
