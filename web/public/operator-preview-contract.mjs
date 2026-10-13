import {isGameLaneId,isOperatorSlug} from './game-lanes.mjs';
import {isDealerId} from './dealer-identity.mjs';
import {validateCompositionSettings} from './composition-settings.mjs';
import {validateDealerFraming} from './dealer-framing.mjs';

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
    exact(media,['src','contentType'],['compositing','framing']);
    if(!['video/mp4','video/webm'].includes(media.contentType)||typeof media.src!=='string')fail();
    const id=media.src.split('/').at(-1);
    if(media.src!==previewMediaPath(context,'dealer',id))fail();
    if(media.compositing!==undefined)compositing(media.compositing);
    if(media.framing!==undefined)validateDealerFraming(media.framing);
  }
  for(const [key,role] of [['tables','table'],['backgrounds','background']]) {
    const rows=value.media[key];
    if(!Array.isArray(rows)||Object.getPrototypeOf(rows)!==Array.prototype||rows.length>32
      ||Object.getOwnPropertySymbols(rows).length||Object.getOwnPropertyNames(rows).length!==rows.length+1
      ||Object.keys(rows).length!==rows.length||!value.independentLayers&&rows.length)fail();
    const ids=new Set();
    for(let i=0;i<rows.length;i++) {
      if(!Object.hasOwn(Object.getOwnPropertyDescriptor(rows,i)??{},'value'))fail();
      const row=rows[i];exact(row,['id','label','src','contentType']);label(row.label,80);
      if(ids.has(row.id)||!types.has(row.contentType)
        ||row.src!==previewMediaPath(context,role,row.id))fail();
      ids.add(row.id);
    }
  }
  return structuredClone(value);
}
