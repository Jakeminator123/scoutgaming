import {validateSceneJoin,selectSceneJoin} from './scene-join.mjs';

// A waiting state is usable only as a complete, source-bound round trip.
// Partial generations must never substitute an unrelated hand pose.
export function readyMotionErrors(manifest,takes,idle) {
  if(!manifest||manifest.status!=='review')return ['Ready motion is not reviewable'];
  const {loop,speech}=manifest;
  if(!loop||!speech)return ['Ready loop or speech return missing'];
  for(const clip of [loop,speech,...manifest.joins??[]]){
    const errors=validateSceneJoin(clip);if(errors.length)return errors;
    if(clip.ready?.loopSha256!==loop.media.sha256)return ['Ready pose binding changed'];
    if(clip.idle.rgbSha256!==idle?.sha256||clip.idle.maskSha256!==idle?.matteSha256)return ['Ready speech source changed'];
  }
  if(loop.ready.kind!=='loop'||speech.ready.kind!=='speech')return ['Wrong ready-state roles'];
  for(const take of takes)for(const edge of ['entry','exit']){
    const clip=selectSceneJoin(manifest,take,edge,idle);
    if(!clip||clip.ready.kind!==edge)return [`Missing ${edge} for ${take.id}`];
  }
  return [];
}
