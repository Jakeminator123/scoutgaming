export const MEDIA_FILE_TYPES = Object.freeze({'image/png':'png','video/mp4':'mp4','video/webm':'webm','audio/mpeg':'mp3','audio/wav':'wav'});
export function mediaContentType(name) { const extension=name.split('.').at(-1)?.toLowerCase(); return Object.keys(MEDIA_FILE_TYPES).find(type=>MEDIA_FILE_TYPES[type]===extension) ?? ''; }
export function mediaHeaderMatches(type,header) {
  if(header.length<16)return false;
  const text=(from,to)=>String.fromCharCode(...header.subarray(from,to));
  if(type==='image/png')return [137,80,78,71,13,10,26,10].every((byte,i)=>header[i]===byte);
  if(type==='video/mp4')return text(4,8)==='ftyp';
  if(type==='video/webm')return [0x1a,0x45,0xdf,0xa3].every((byte,i)=>header[i]===byte);
  if(type==='audio/wav')return text(0,4)==='RIFF'&&text(8,12)==='WAVE';
  if(type==='audio/mpeg')return text(0,3)==='ID3'||(header[0]===255&&(header[1]&224)===224&&(header[1]&6)!==0&&(header[2]&240)!==240&&(header[2]&12)!==12);
  return false;
}
