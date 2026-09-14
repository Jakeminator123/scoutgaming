// Isolated review predecoder. Original MP4 is linked by receipt; raw Annex-B
// bytes are independently hashed before any decoder receives them.
export async function loadNativeFrameSource({indexURL,expectedMP4SHA,crop,signal,timeoutMs=5000},deps={}){
 const fetcher=deps.fetch??globalThis.fetch,Decoder=deps.VideoDecoder??globalThis.VideoDecoder,Chunk=deps.EncodedVideoChunk??globalThis.EncodedVideoChunk,cryptoAPI=deps.crypto??globalThis.crypto;
 const controller=new AbortController(),frames=[],started=performance.now();let decoder,terminal=false,timer,rejectFailure;
 const failure=new Promise((_,reject)=>{rejectFailure=reject;});failure.catch(()=>{});
 const cleanup=()=>{if(decoder&&decoder.state!=='closed')decoder.close();for(const f of frames)f?.close();frames.length=0;};
 const fail=error=>{if(terminal)return;terminal=true;controller.abort();cleanup();rejectFailure(error instanceof Error?error:Error(String(error)));};
 const aborted=()=>fail(Error('Native frame preparation cancelled'));
 signal?.addEventListener('abort',aborted,{once:true});timer=setTimeout(()=>fail(Error('Native frame preparation timeout')),Math.min(5000,Math.max(1,timeoutMs)));
 async function checked(p){const result=await Promise.race([p,failure]);if(terminal)throw Error('Native frame preparation terminated');return result;}
 async function json(url){const r=await checked(fetcher(url,{signal:controller.signal}));if(!r.ok)throw Error('Native frame index unavailable');return checked(r.json());}
 try{
  if(signal?.aborted)aborted();
  if(!Decoder||!Chunk||!cryptoAPI?.subtle)throw Error('Native frame decoding unavailable');
  const index=await json(indexURL),clip=index.clips?.['dealer/upcard/first'];
  if(index.version!==1||!/^avc1\.[0-9a-f]{6}$/i.test(index.codec)||!expectedMP4SHA||index.sourceMP4SHA256!==expectedMP4SHA||!/^[0-9a-f]{64}$/.test(index.streamSHA256))throw Error('Native frame provenance mismatch');
  if(!Array.isArray(crop)||crop.length!==4||!crop.every(Number.isInteger)||crop[0]<0||crop[1]<0||crop[2]<=0||crop[3]<=0||crop[0]+crop[2]>1920||crop[1]+crop[3]>1080||index.width!==crop[2]||index.height!==crop[3]*3)throw Error('Native frame crop mismatch');
  if(!clip||clip.file!=='actor.h264'||clip.fps!==60||clip.frameCount!==85||clip.frames?.length!==85)throw Error('Native frame index must contain exact 85-frame 60fps clip');
  const url=new URL(clip.file,new URL(indexURL,globalThis.location?.href??'http://localhost/')).href;
  const response=await checked(fetcher(url,{signal:controller.signal}));if(!response.ok)throw Error('Native frame stream unavailable');
  const bytes=new Uint8Array(await checked(response.arrayBuffer()));
  const digest=Array.from(new Uint8Array(await checked(cryptoAPI.subtle.digest('SHA-256',bytes))),x=>x.toString(16).padStart(2,'0')).join('');
  if(digest!==index.streamSHA256)throw Error('Native stream SHA mismatch');
  let end=0;clip.frames.forEach((range,i)=>{if(!Array.isArray(range)||range.length!==2||!range.every(Number.isSafeInteger)||range[0]!==end||range[1]<=0||range[0]+range[1]>bytes.length)throw Error('Invalid native frame byte range');end+=range[1];validateAccessUnit(bytes.subarray(...[range[0],end]),i);});if(end!==bytes.length)throw Error('Unindexed native stream bytes');
  const config={codec:index.codec,codedWidth:index.width,codedHeight:index.height,optimizeForLatency:true};
  const support=await checked(Decoder.isConfigSupported(config));if(!support.supported)throw Error('Native decoder configuration unsupported');
  decoder=new Decoder({output(frame){if(terminal){frame.close();return;}const i=frames.length;if(i>=85||frame.timestamp!==Math.round(i*1e6/60)||frame.displayWidth!==index.width||frame.displayHeight!==index.height){frame.close();fail(Error('Decoded frame timestamp/dimension mismatch'));return;}frames.push(frame);},error:fail});
  decoder.configure(config);
  for(let i=0;i<85;i++){if(terminal)throw Error('Native decode interrupted');const [offset,size]=clip.frames[i];decoder.decode(new Chunk({type:i===0?'key':'delta',timestamp:Math.round(i*1e6/60),duration:Math.round((i+1)*1e6/60)-Math.round(i*1e6/60),data:bytes.subarray(offset,offset+size)}));}
  await checked(decoder.flush());if(frames.length!==85)throw Error('Native decode frame count mismatch');decoder.close();
  clearTimeout(timer);signal?.removeEventListener('abort',aborted);
  const receipt=Object.freeze({sourceMP4SHA256:expectedMP4SHA,streamSHA256:digest,frameCount:85,fps:60,width:index.width,height:index.height,bFrames:0,timestamps:frames.map(f=>f.timestamp),preparationMs:performance.now()-started,decoderClosed:true});
  let disposed=false;return {frames:Object.freeze([...frames]),receipt,dispose(){if(!disposed){disposed=true;terminal=true;cleanup();}return {disposed:true,framesClosed:85};}};
 }catch(error){fail(error);throw error;}finally{clearTimeout(timer);signal?.removeEventListener('abort',aborted);}
}
// AVC slice_type is the second unsigned Exp-Golomb field. Refuse reordered B
// pictures explicitly; AUD-only count validation cannot establish B0.
export function validateAccessUnit(bytes,index){
 const starts=[];for(let i=0;i+3<bytes.length;i++){let n=0;if(bytes[i]===0&&bytes[i+1]===0){if(bytes[i+2]===1)n=3;else if(bytes[i+2]===0&&bytes[i+3]===1)n=4;}if(n){starts.push([i,i+n]);i+=n-1;}}
 let slices=0,idr=false;if(!starts.length||starts[0][0]!==0||(bytes[starts[0][1]]&31)!==9)throw Error('Native AU missing AUD');
 starts.forEach(([_,start],j)=>{const type=bytes[start]&31;if(type!==1&&type!==5)return;slices++;idr ||= type===5;const rbsp=[];let zeros=0;for(let k=start+1;k<(starts[j+1]?.[0]??bytes.length);k++){const b=bytes[k];if(zeros>=2&&b===3){zeros=0;continue;}rbsp.push(b);zeros=b===0?zeros+1:0;}let bit=0;const read=()=>{if(bit>=rbsp.length*8)throw Error('Truncated AVC slice');return(rbsp[bit>>3]>>(7-(bit++&7)))&1;};const ue=()=>{let z=0;while(!read()){if(++z>30)throw Error('Invalid AVC slice');}let v=0;for(let k=0;k<z;k++)v=v*2+read();return 2**z-1+v;};ue();if(ue()%5===1)throw Error('B-frame native source rejected');});
 if(!slices||(index===0&&!idr)||(index>0&&idr))throw Error('Unexpected native keyframe structure');
}
