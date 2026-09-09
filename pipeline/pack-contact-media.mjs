// Keep the photographic RGB at its native resolution. Tracking/mattes remain
// normalized to the same camera; scaling a matte must never scale the action.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const probe=file=>JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,nb_read_frames,r_frame_rate','-of','json',file],{encoding:'utf8'})).streams[0];

export function packContactMedia({segments,masks,sourceOutput,packedOutput}) {
  if(!segments?.length)throw new Error('Native source segments are required');
  const streams=segments.map(s=>probe(s.file)),{width,height}=streams[0];
  const fps=24;
  let frames=0;
  const filters=segments.map((s,i)=>{
    const p=streams[i],count=Number(p.nb_read_frames),[n,d]=p.r_frame_rate.split('/').map(Number);
    const start=s.start??0,end=s.end??count,stride=s.stride??1;
    if(p.width!==width||p.height!==height||n/d!==fps||![start,end,stride].every(Number.isInteger)||start<0||end>count||end<=start||stride<1)
      throw new Error(`Invalid native segment ${i}`);
    frames+=Math.ceil((end-start)/stride);
    return `[${i}:v]trim=start_frame=${start}:end_frame=${end},select='not(mod(n,${stride}))',setpts=N/(${fps}*TB)[s${i}]`;
  });
  const maskFiles=fs.readdirSync(masks).filter(f=>/^\d{4}\.png$/.test(f)).sort();
  if(maskFiles.length!==frames||maskFiles.some((f,i)=>f!==String(i+1).padStart(4,'0')+'.png'))throw new Error('Native RGB and matte frame counts differ');
  // Concat uses microsecond timestamps; the image sequence uses 1/fps. Give
  // both streams exact integer frame ticks before vstack, otherwise a rounded
  // final timestamp can duplicate the last RGB/matte frame.
  filters.push(segments.map((_,i)=>`[s${i}]`).join('')+`concat=n=${segments.length}:v=1:a=0,settb=1/${fps},setpts=N,split=2[clean][rgb]`);
  filters.push(`[${segments.length}:v]scale=${width}:${height}:flags=lanczos,setsar=1,settb=1/${fps},setpts=N[mask]`);
  filters.push('[rgb][mask]vstack=inputs=2[packed]');
  for(const file of [sourceOutput,packedOutput])fs.mkdirSync(path.dirname(file),{recursive:true});
  const encode=['-an','-c:v','libx264','-crf','14','-bf','0','-pix_fmt','yuv420p','-movflags','+faststart'];
  execFileSync('ffmpeg',['-y','-hide_banner','-loglevel','error',...segments.flatMap(s=>['-i',s.file]),'-framerate',String(fps),'-i',path.join(masks,'%04d.png'),'-filter_complex',filters.join(';'),'-map','[clean]',...encode,sourceOutput,'-map','[packed]',...encode,packedOutput]);
  for(const [file,multiplier] of [[sourceOutput,1],[packedOutput,2]]) {
    const p=probe(file);
    if(p.width!==width||p.height!==height*multiplier||Number(p.nb_read_frames)!==frames)throw new Error('Native packed output does not match source frames');
  }
  return {width,height,fps,frames};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const recipe=JSON.parse(fs.readFileSync(process.argv[2]));
  console.log(JSON.stringify(packContactMedia(recipe)));
}
