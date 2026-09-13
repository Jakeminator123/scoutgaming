// A filmed actor-only join is separate from card/contact choreography.
// Bind it to both the reviewed take and the exact underlying idle assets.
export function sceneJoinPayload(join) {
  return JSON.stringify({camera:join.camera,media:join.media,bindings:join.bindings,idle:join.idle});
}
export function validateSceneJoin(join) {
  const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
  if(join?.status!=='review'||!hash(join.calibrationSha256))return ['Unreviewable scene join'];
  const m=join.media,c=join.camera;
  if(!m||!hash(m.sha256)||typeof m.src!=='string'||!m.src.startsWith('dealers/astrid/performance/joins/'))return ['Invalid scene-join media'];
  if(!c||c.width!==1920||c.height!==1080||m.width!==c.width||m.height!==c.height||m.fps!==60||!Number.isInteger(m.frames)||m.frames<2)return ['Invalid scene-join camera or clock'];
  if(!hash(join.idle?.rgbSha256)||!hash(join.idle?.maskSha256))return ['Missing idle binding'];
  if(!Array.isArray(join.bindings)||!join.bindings.length||join.bindings.some(b=>!['entry','exit'].includes(b.edge)||!b.takeId||!hash(b.mediaSha256)||!hash(b.calibrationSha256)))return ['Missing take binding'];
  return [];
}
export function selectSceneJoin(manifest,take,edge,idle) {
  if(!manifest||!take||!idle)return null;
  return manifest.joins?.find(j=>!validateSceneJoin(j).length&&j.idle.rgbSha256===idle.sha256&&j.idle.maskSha256===idle.matteSha256&&
    JSON.stringify(j.camera)===JSON.stringify({width:take.camera.width,height:take.camera.height})&&
    j.bindings.some(b=>b.edge===edge&&b.takeId===take.id&&b.mediaSha256===take.media.sha256&&b.calibrationSha256===take.calibrationSha256))??null;
}
