import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename,resolve} from 'node:path';
import {clipCompositing} from './public/presentation-composition.mjs';
import {normalizeDealerSpeechProfile,validateDealerSpeechReference} from './public/dealer-speech-profile.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const MAX_VIDEO=256*1024*1024,MAX_IMAGE=8*1024*1024;
export function dealerSpeechProfileRevision(profile){
  return hash(JSON.stringify(normalizeDealerSpeechProfile(profile)));
}
function run(executable,args,{signal,maxBytes=1024*1024}={}){
  return new Promise((resolve,reject)=>{
    let output=[],size=0,settled=false;
    const child=spawn(executable,args,{stdio:['ignore','pipe','ignore'],windowsHide:true,signal});
    const timer=setTimeout(()=>{child.kill();finish(Error('speech_reference_decode_timeout'));},30000);
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
    child.on('error',()=>finish(Error('speech_reference_decoder_unavailable')));
    child.stdout.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){child.kill();finish(Error('speech_reference_decode_limit'));}else output.push(chunk);});
    child.on('close',code=>finish(code===0?null:Error('speech_reference_decode_failed'),Buffer.concat(output)));
  });
}
function validatePng(bytes){
  if(bytes.length<45||bytes.length>MAX_IMAGE||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    ||bytes.toString('ascii',12,16)!=='IHDR'||bytes.readUInt32BE(16)!==1080||bytes.readUInt32BE(20)!==1920
    ||bytes[24]!==8||![2,6].includes(bytes[25]))fail('speech_reference_image_invalid');
  let offset=8,ended=false;
  while(offset+12<=bytes.length){
    const size=bytes.readUInt32BE(offset),kind=bytes.toString('ascii',offset+4,offset+8);
    if(size>MAX_IMAGE||offset+12+size>bytes.length)fail('speech_reference_image_invalid');
    offset+=size+12;
    if(kind==='IEND'){ended=size===0&&offset===bytes.length;break;}
  }
  if(!ended)fail('speech_reference_image_invalid');
}
async function readBounded(response,expectedBytes,signal){
  if(response?.status!==200||!response.body||!/^video\/(mp4|webm|quicktime)(?:;|$)/i.test(response.headers.get('content-type')??''))fail('speech_reference_source_unavailable');
  const length=response.headers.get('content-length');
  if(length!==null&&Number(length)!==expectedBytes)fail('speech_reference_source_changed');
  const reader=response.body.getReader(),chunks=[];let size=0;
  const abort=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});
  try{
    for(;;){if(signal.aborted)fail('speech_reference_cancelled');const {value,done}=await reader.read();if(done)break;
      size+=value.byteLength;if(size>expectedBytes||size>MAX_VIDEO)fail('speech_reference_source_limit');chunks.push(Buffer.from(value));}
    if(signal.aborted)fail('speech_reference_cancelled');
    if(size!==expectedBytes)fail('speech_reference_source_changed');
    return Buffer.concat(chunks,size);
  }finally{signal.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});}
}
/** Sources come only from the authoritative private registry, never a supplied URL.
 * Cache entries contain derived PNGs, not readiness or visual-approval claims. */
export function createDealerSpeechReferenceService({readVideoRegistry,readVideoResponse,ffmpegPath='ffmpeg',ffprobePath='ffprobe',runProcess=run}={}){
  if(typeof readVideoRegistry!=='function'||typeof readVideoResponse!=='function')fail('speech_reference_configuration');
  let busy=false;const cache=new Map();
  return Object.freeze({async prepare({dealerId,profile,profileRevision,beforeCostlyStep,signal}={}){
    if(!/^[a-z][a-z0-9-]{0,63}$/.test(dealerId??'')||typeof beforeCostlyStep!=='function')fail('speech_reference_configuration');
    const normalized=normalizeDealerSpeechProfile(profile),revision=dealerSpeechProfileRevision(normalized);
    if(normalized.state!=='enabled'||normalized.reference?.kind!=='video-frame'||profileRevision!==undefined&&profileRevision!==revision)fail('speech_reference_profile_invalid');
    const controller=new AbortController(),stop=()=>controller.abort();
    signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)stop();
    const timer=setTimeout(stop,90000);let directory,ownsWork=false;
    const guard=async()=>{if(controller.signal.aborted)fail('speech_reference_cancelled');await beforeCostlyStep();if(controller.signal.aborted)fail('speech_reference_cancelled');};
    const readSource=async()=>{await guard();const registry=await readVideoRegistry();
      const matches=registry?.videos?.filter(row=>row.id===normalized.reference.videoId);
      if(matches?.length!==1)fail('speech_reference_source_unavailable');
      validateDealerSpeechReference(normalized,matches[0],dealerId);
      if(matches[0].bytes>MAX_VIDEO)fail('speech_reference_source_limit');return matches[0];};
    try{
      const video=await readSource(),key=dealerId+':'+revision;
      const candidate=video.compositing??video.classification?.compositing;
      const compositing=clipCompositing(candidate)?{...candidate}:null;
      if(cache.has(key)){await guard();const item=cache.get(key);return {...item,compositing,image:{...item.image,bytes:Buffer.from(item.image.bytes)}};}
      if(busy)fail('speech_reference_busy');busy=true;ownsWork=true;
      const response=await readVideoResponse(video.id,new Request('https://studio.invalid/api/dealer-speech-reference',{signal:controller.signal}));
      const bytes=await readBounded(response,video.bytes,controller.signal);
      if(hash(bytes)!==normalized.reference.sha256)fail('speech_reference_source_changed');
      await guard();directory=await mkdtemp(join(tmpdir(),'croupier-speech-reference-'));
      const input=join(directory,'source.media'),output=join(directory,'frame.png');
      await writeFile(input,bytes,{flag:'wx',mode:0o600});
      const probe=await runProcess(ffprobePath,['-v','error','-protocol_whitelist','file,pipe','-format_whitelist','mov,matroska,webm','-select_streams','v:0','-show_entries','stream=width,height:format=duration','-of','json',input],{signal:controller.signal});
      let info;try{info=JSON.parse(probe.toString('utf8'));}catch{fail('speech_reference_decode_failed');}
      const stream=info?.streams?.[0],duration=Number(info?.format?.duration);
      if(!stream||!Number.isInteger(stream.width)||!Number.isInteger(stream.height)||stream.width<32||stream.height<32
        ||stream.width>4096||stream.height>4096||!Number.isFinite(duration)||duration<=0||normalized.reference.offsetMs>=duration*1000)fail('speech_reference_frame_out_of_range');
      await guard();
      await runProcess(ffmpegPath,['-hide_banner','-loglevel','error','-nostdin','-protocol_whitelist','file,pipe','-format_whitelist','mov,matroska,webm','-threads','2','-ss',String(normalized.reference.offsetMs/1000),'-i',input,'-map','0:v:0','-an','-sn','-dn','-frames:v','1','-vf','scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1','-pix_fmt','rgb24','-threads','2','-fs',String(MAX_IMAGE),'-f','image2',output],{signal:controller.signal});
      const image=await readFile(output);validatePng(image);
      const refreshed=await readSource();await guard();
      if(JSON.stringify(refreshed.compositing??refreshed.classification?.compositing)!==JSON.stringify(candidate))fail('speech_reference_source_changed');
      const result={dealerId,profileRevision:revision,compositing,image:{sha256:hash(image),bytes:image,width:1080,height:1920,contentType:'image/png'}};
      cache.set(key,result);while(cache.size>4)cache.delete(cache.keys().next().value);
      return {...result,image:{...result.image,bytes:Buffer.from(image)}};
    }finally{
      clearTimeout(timer);signal?.removeEventListener('abort',stop);
      if(directory){
        if(dirname(resolve(directory))!==resolve(tmpdir())||!basename(directory).startsWith('croupier-speech-reference-'))fail('speech_reference_cleanup_path');
        await rm(directory,{recursive:true,force:true});
      }
      if(ownsWork)busy=false;
    }
  }});
}
