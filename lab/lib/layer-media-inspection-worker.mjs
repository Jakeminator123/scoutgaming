import { parentPort,workerData } from 'node:worker_threads';
import { readSync } from 'node:fs';
import sharp from 'sharp';
import { Input,MP4,WEBM,CustomSource,EncodedPacketSink } from 'mediabunny';

const {fd,size,contentType,limits}=workerData;
const invalid=()=>{throw Error('studio_invalid_media_format');};
const limited=()=>{throw Error('studio_media_inspection_limit');};
let reads=0,total=0;
function read(start,end,{image=false}={}) {
  const length=end-start;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end>size||length<=0)invalid();
  if(++reads>limits.reads||length>limits.readBytes||(total+=length)>(image?limits.fileBytes:limits.videoReadBytes))limited();
  const bytes=Buffer.allocUnsafe(length);let offset=0;
  while(offset<length){const count=readSync(fd,bytes,offset,length-offset,start+offset);if(count===0)invalid();offset+=count;}
  return bytes;
}
function dimensions(width,height) {
  if(![width,height].every(n=>Number.isSafeInteger(n)&&n>0&&n<=16384)||width*height>limits.pixels)limited();
  return {width,height};
}
async function inspectImage() {
  const bytes=Buffer.allocUnsafe(size);
  for(let at=0;at<size;at+=limits.readBytes)read(at,Math.min(size,at+limits.readBytes),{image:true}).copy(bytes,at);
  const settings={limitInputPixels:limits.pixels,failOn:'warning',animated:true};
  const metadata=await sharp(bytes,settings).metadata();
  const expected={'image/png':'png','image/jpeg':'jpeg','image/webp':'webp'}[contentType];
  if(metadata.format!==expected)invalid();
  const height=metadata.pageHeight??metadata.height,width=metadata.width,pages=metadata.pages??1;
  if(!Number.isSafeInteger(pages)||pages<1||width*height*pages>limits.pixels)limited();
  // A metadata-only read accepts truncated pixel payloads. Decode within the
  // pixel budget, returning only a tiny output, without transcoding the source.
  await sharp(bytes,settings).timeout({seconds:3}).resize(1,1,{fit:'fill'}).raw().toBuffer();
  const rotated=[5,6,7,8].includes(metadata.orientation);
  return {...dimensions(rotated?height:width,rotated?width:height),contentType};
}
function checkMp4Bounds() {
  let position=0,mdat=false;
  while(position<size){
    if(size-position<8)invalid();
    const header=read(position,position+8),type=header.toString('ascii',4),short=header.readUInt32BE(0);
    let length=short,headerSize=8;
    if(short===1){if(size-position<16)invalid();const big=read(position+8,position+16).readBigUInt64BE();if(big>BigInt(Number.MAX_SAFE_INTEGER))invalid();length=Number(big);headerSize=16;}
    if(short===0)length=size-position;
    if(length<headerSize||length>size-position)invalid();
    if(type==='mdat'&&length>headerSize)mdat=true;
    position+=length;
  }
  if(!mdat)invalid();
}
async function inspectVideo() {
  if(contentType==='video/mp4')checkMp4Bounds();
  const source=new CustomSource({getSize:()=>size,read:(start,end)=>read(start,end),maxCacheSize:1024*1024,prefetchProfile:'none'});
  const input=new Input({source,formats:[MP4,WEBM]});
  try {
    if(await input.getFormat()!==(contentType==='video/mp4'?MP4:WEBM))invalid();
    const tracks=await input.getVideoTracks();
    if(!tracks.length)invalid();if(tracks.length>16)limited();
    const track=await input.getPrimaryVideoTrack();
    const value=dimensions(await track.getDisplayWidth(),await track.getDisplayHeight());
    dimensions(await track.getCodedWidth(),await track.getCodedHeight());
    if(![0,90,180,270].includes(await track.getRotation()))invalid();
    const packets=new EncodedPacketSink(track),options={skipLiveWait:true};
    const first=await packets.getFirstPacket(options),last=await packets.getPacket(Infinity,options);
    for(const packet of [first,last])if(!packet||!packet.data.byteLength||!Number.isFinite(packet.timestamp)||!Number.isFinite(packet.duration)||packet.duration<0)invalid();
    return {...value,contentType};
  } finally {input.dispose();}
}
try {
  const value=contentType.startsWith('image/')?await inspectImage():await inspectVideo();
  parentPort.postMessage({ok:true,value});
} catch(error) {
  parentPort.postMessage({ok:false,code:error?.message==='studio_media_inspection_limit'?error.message:'studio_invalid_media_format'});
}
