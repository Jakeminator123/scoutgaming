// Browser-safe vocabulary for "Skapa bakgrund med AI", shared by the route,
// the Admin dialog and every publication path. Only these fixed codes and
// labels reach the browser.
import {registeredFilmedProfile} from '../../../packages/presentation/contracts/filmed-profiles/registry.mjs';
import {defaultCompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';
export const AI_IMAGE_ERROR_CODES = Object.freeze(['ai_image_disabled','ai_image_misconfigured','ai_image_unavailable','ai_image_limit_reached','ai_image_budget_exhausted','ai_image_rejected','ai_image_invalid_request']);
export const AI_IMAGE_ROLES = Object.freeze(['background','table']);
export const AI_IMAGE_PROMPT_LENGTH = Object.freeze({min:3,max:600});
// Three WebP proposals of at most 700 KiB keep the answer under 3 MB, well
// inside Vercel's 4.5 MB response limit.
export const AI_IMAGE_MAX_PROPOSALS = 3;
export const AI_IMAGE_PROPOSAL_MAX_BYTES = 700*1024;
// Inspirationsbild: the dialog shrinks it to at most 1536 px and under 2 MB;
// the server checks type, bytes and dimensions again. It is never stored.
export const AI_IMAGE_REFERENCE_TYPES = Object.freeze(['image/png','image/jpeg','image/webp']);
export const AI_IMAGE_REFERENCE_MAX_BYTES = 2*1024*1024;
export const AI_IMAGE_REFERENCE_MAX_EDGE = 1536;
export const AI_IMAGE_REFERENCE_FILE_MAX_BYTES = 8*1024*1024;
// The scene's desktop format; phones show its centre strip.
export const AI_BACKGROUND_SIZE = Object.freeze({width:1920,height:1080});
// Camera contract for every AI background (Jakob 2026-10-29): the image is a
// backdrop plate shot from the dealer camera, whatever the theme. A room seen
// from above or as a montage works as an illustration but not behind a table
// graphic, which then floats. The theme (preset, staff text, inspiration photo)
// sets materials, colours and peripheral props only, never these values.
// Shares of the image height (0 = top), measured against production's Privé
// backdrop and the default scene template's table (compositor/geometry.js).
export const AI_BACKGROUND_CAMERA = Object.freeze({
  // A level camera at the dealer's eye height puts the vanishing point, and so
  // the horizon, near the middle of the frame. The Privé backdrop's floor
  // lines converge there; 45-50 % keeps the floor receding, not seen from above.
  horizon:Object.freeze({min:.45,max:.5}),
  // Where the back wall meets the floor in the outer columns. The default table
  // graphic (desktop x 656-1264, top at y 43) ends its outer rail at y 644 at
  // the column edges and y 724 at the front: 60-67 %. The Privé backdrop shows
  // floor from about 55-60 % at the image edges. At 60 % the junction hides
  // behind the rail's ends, and the floor is visible from there to the bottom
  // edge, so the table graphic stands on it.
  floorLine:.6,
  // Sconces and lamps at the dealer's head and shoulder height: the Privé
  // backdrop's wall lights span 7-28 % of the height, beside the dealer.
  lights:Object.freeze({min:.1,max:.35}),
});
// Presets match the generic backgrounds. "Fri" sends only the staff text.
export const AI_IMAGE_PRESETS = Object.freeze([
  Object.freeze({id:'dark-studio',label:'Mörk studio'}),
  Object.freeze({id:'warm-lounge',label:'Varm lounge'}),
  Object.freeze({id:'light-studio',label:'Ljus studio'}),
  Object.freeze({id:'casino',label:'Casino'}),
  Object.freeze({id:'free',label:'Fri'}),
]);

// SHA-256 (FIPS 180-4) without Web Crypto, so the same synchronous hash runs in
// the browser's render path and on the server.
const K=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
export function sha256Hex(text) {
  const data=new TextEncoder().encode(String(text)),length=Math.ceil((data.length+9)/64)*64,bytes=new Uint8Array(length);
  bytes.set(data);bytes[data.length]=0x80;
  const bits=data.length*8,view=new DataView(bytes.buffer);
  view.setUint32(length-8,Math.floor(bits/2**32));view.setUint32(length-4,bits>>>0);
  const h=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]),w=new Uint32Array(64);
  const rotr=(x,n)=>(x>>>n)|(x<<(32-n));
  for (let offset=0;offset<length;offset+=64) {
    for (let i=0;i<16;i++) w[i]=view.getUint32(offset+i*4);
    for (let i=16;i<64;i++) {
      const s0=rotr(w[i-15],7)^rotr(w[i-15],18)^(w[i-15]>>>3),s1=rotr(w[i-2],17)^rotr(w[i-2],19)^(w[i-2]>>>10);
      w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;
    }
    let [a,b,c,d,e,f,g,k]=h;
    for (let i=0;i<64;i++) {
      const t1=(k+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+K[i]+w[i])>>>0;
      const t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
      k=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    [a,b,c,d,e,f,g,k].forEach((value,i)=>{h[i]=(h[i]+value)>>>0;});
  }
  return [...h].map(value=>value.toString(16).padStart(8,'0')).join('');
}

// Only the dealer and table placement decide where a table graphic sits under
// the filmed landings; other composition fields (card geometry, game UI) do not.
export function aiPlacementHash(composition) {
  const parts=['mobile','desktop'].flatMap(layout=>{
    const {dealer,table}=composition[layout];
    return [dealer.scale,dealer.x,dealer.y,table.width,table.x,table.y];
  });
  if (parts.some(value=>!Number.isFinite(value))) throw Error('invalid_composition');
  return sha256Hex('scoutgaming-ai-table-placement/1:'+parts.join(',')).slice(0,8);
}

const clean=value=>String(value??'').replace(/[\u0000-\u001f\u007f-\u009f<>]/gu,' ').replace(/\s+/g,' ').trim();
const shorten=(text,max)=>text.length>max?text.slice(0,max-1).trimEnd()+'…':text;
const TABLE_FIT=/^AI · .+ · ([a-z0-9-]{1,40}) · ([a-f0-9]{8})$/;
// The material label: "AI · <short prompt>" for a background and
// "AI · <short prompt> · <dealer> · <placement hash>" for a table graphic,
// within the layer contract's 80 characters and without control characters or <>.
export function aiImageLabel(prompt,fit=null) {
  const text=clean(prompt)||'bild';
  if (!fit) return 'AI · '+shorten(text,60);
  if (!/^[a-z0-9-]{1,40}$/.test(fit.dealerId??'')||!/^[a-f0-9]{8}$/.test(fit.placement??'')) throw Error('invalid_ai_table_fit');
  const suffix=` · ${fit.dealerId} · ${fit.placement}`;
  return 'AI · '+shorten(text,80-5-suffix.length)+suffix;
}
// Reads the dealer and placement back from an AI table graphic's label.
export function aiTableLabelFit(label) {
  const match=typeof label==='string'?TABLE_FIT.exec(label):null;
  return match?{dealerId:match[1],placement:match[2]}:null;
}

// The fit guard, shared by the scene template's table choice, the client's
// publication and the server's publication paths. An AI table graphic (label
// "AI · … · <dealer> · <placement>") fits only a template whose dealers all
// land where that dealer lands, with the same dealer and table placement.
// Any other material, also a renamed AI graphic, is not affected.
export const AI_TABLE_MISFIT_CODE='ai_table_misfit';
const REDRAW='Rita om bordet för den här scenmallen eller välj ett annat bord.';
export const AI_TABLE_MISFIT=Object.freeze({
  ai_table_other_dealer:'Bordsgrafiken är ritad för en annan dealer än scenmallens. '+REDRAW,
  ai_table_other_placement:'Bordsgrafiken är ritad för en annan placering än scenmallens. '+REDRAW,
});
const landings=id=>{const profile=registeredFilmedProfile(id);return profile?JSON.stringify([profile.positions,profile.card]):null;};
export function aiTableFitsTemplate(asset,lane) {
  const fit=asset?.role==='table'?aiTableLabelFit(asset.label):null;
  if (!fit) return {ok:true};
  const drawn=landings(fit.dealerId),dealers=Array.isArray(lane?.dealers)?lane.dealers:[];
  if (!drawn||!dealers.length||dealers.some(id=>landings(id)!==drawn)) return {ok:false,code:'ai_table_other_dealer',reason:AI_TABLE_MISFIT.ai_table_other_dealer};
  let placement=null;
  try { placement=aiPlacementHash(lane.composition??defaultCompositionSettings()); } catch { /* An unreadable placement never fits. */ }
  if (placement!==fit.placement) return {ok:false,code:'ai_table_other_placement',reason:AI_TABLE_MISFIT.ai_table_other_placement};
  return {ok:true};
}
// Every AI table graphic a template shows (its default and allowed tables)
// that does not fit it. Works on a project ({lanes, layerAssets}) and on a
// frozen package presentation ({lanes, assets}).
export function aiTableMisfits(lanes,assets) {
  const misfits=[];
  for (const lane of Array.isArray(lanes)?lanes:[]) {
    const table=lane?.layers?.table;
    if (!table||table.enabled===false) continue;
    for (const id of new Set([...(Array.isArray(table.allowed)?table.allowed:[]),...(table.default?[table.default]:[])])) {
      const asset=(Array.isArray(assets)?assets:[]).find(row=>row?.id===id),fit=aiTableFitsTemplate(asset,lane);
      if (!fit.ok) misfits.push({compositionId:lane.id,assetId:id,label:asset.label,code:fit.code,reason:fit.reason});
    }
  }
  return misfits;
}
export function aiTableMisfitMessage(misfit) {
  const reason=AI_TABLE_MISFIT[misfit?.code]??AI_TABLE_MISFIT[misfit?.reason]??'Ett AI-ritat bord passar inte scenmallen. '+REDRAW;
  return (typeof misfit?.label==='string'&&misfit.label?misfit.label+': ':'')+reason;
}
