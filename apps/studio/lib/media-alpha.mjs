// Inspect authenticated original bytes, never a filename or caller's alpha flag.
// WebM proves an alpha track/payload, not the visual quality of the matte.
const fail=()=>{throw Object.assign(Error('Alfa kunde inte verifieras. Använd en frilagd PNG eller VP9-WebM med alfaspår.'),{code:'studio_media_alpha_required',statusCode:422});};
function elements(bytes,start,end,visit,depth=0) {
  if(depth>10)fail();
  for(let at=start;at<end;) {
    const first=bytes[at];if(!first)fail();
    let idLength=1;while(idLength<=4&&!(first&(128>>(idLength-1))))idLength++;
    if(idLength>4||at+idLength>=end)fail();
    let id=0;for(let n=0;n<idLength;n++)id=id*256+bytes[at++];
    const marker=bytes[at];let length=1;while(length<=8&&!(marker&(128>>(length-1))))length++;
    if(length>8||at+length>end)fail();
    let size=marker&((128>>(length-1))-1),unknown=size===((128>>(length-1))-1);at++;
    for(let n=1;n<length;n++){unknown=unknown&&bytes[at]===255;size=size*256+bytes[at++];}
    const stop=unknown?end:at+size;if(!Number.isSafeInteger(stop)||stop>end)fail();
    visit(id,at,stop,depth);at=stop;
  }
}
export function inspectWebmAlpha(bytes) {
  let codec=false,alpha=false,payload=false;
  const parents=new Set([0x18538067,0x1654ae6b,0xae,0xe0,0x1f43b675,0xa0,0x75a1,0xa6]);
  const visit=(id,start,end,depth)=>{
    if(id===0x86&&bytes.toString('ascii',start,end)==='V_VP9')codec=true;
    if(id===0x53c0&&end-start===1&&bytes[start]===1)alpha=true;
    if(id===0xa5&&end-start>8)payload=true;
    if(parents.has(id))elements(bytes,start,end,visit,depth+1);
  };
  try{elements(bytes,0,bytes.length,visit);}catch{fail();}
  if(!codec||!alpha||!payload)fail();
  return {alpha:'track-and-payload',codec:'vp9'};
}
export async function assertMediaAlpha(bytes,contentType) {
  if(contentType==='video/webm')return inspectWebmAlpha(bytes);
  if(contentType==='image/png') {
    try {
      const sharp=(await import('sharp')).default;
      const input=sharp(bytes,{limitInputPixels:32_000_000});const meta=await input.metadata();
      if(!meta.hasAlpha)fail();const stats=await input.stats(),a=stats.channels.at(-1);
      if(a.min===255||a.max===0)fail();
      return {alpha:'decoded-pixels',width:meta.width,height:meta.height};
    }catch{fail();}
  }
  fail();
}
