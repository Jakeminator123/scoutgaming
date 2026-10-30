// Explicit, immutable-source calibration data. Provenance is not visual approval.
const hash = /^[a-f0-9]{64}$/;
const targets = new Set(['1','2','3','4','5','6','7','dealer','hole','flip']);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const finite = value => Number.isFinite(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const fail = () => { throw new Error('Invalid filmed deal profile'); };
function keys(value, expected) {
  if (!object(value) || Object.keys(value).sort().join('|') !== [...expected].sort().join('|')) fail();
}
export function filmedDealTarget(event) {
  if (event?.type === 'reveal') return event.to === 'dealer' ? 'flip' : null;
  if (event?.type !== 'deal') return null;
  if (event.to === 'dealer') return event.faceDown === true ? 'hole' : event.faceDown === false ? 'dealer' : null;
  return event.to === 'box' && Number.isInteger(event.box) && event.box >= 0 && event.box < 7 ? String(event.box + 1) : null;
}
export function validateFilmedDealProfile(profile) {
  // `inherited` marks PAOW's profile used as another dealer's standard (registry).
  keys(profile, ['version','id','game','source','plane','card','positions','tracks','takes','timingEvidence',...(object(profile) && 'inherited' in profile ? ['inherited'] : [])]);
  if (profile.inherited !== undefined && profile.inherited !== 'paow') fail();
  if (profile.version !== 1 || profile.game !== 'blackjack' || !/^[a-z0-9-]{1,100}$/.test(profile.id)
      || !/^[a-z0-9-]{1,100}$/.test(profile.timingEvidence)) fail();
  // A dealer's studio profile (filmed-profiles/studio-profile.mjs) names its dealer instead of a source commit.
  const studio=object(profile.source)&&Object.hasOwn(profile.source,'studio');
  if (studio) {
    keys(profile.source,['studio']);
    const origin=profile.source.studio;
    keys(origin,['dealerId','kind',...(origin?.kind==='copy'?['base']:[])]);
    if (!['copy','measured'].includes(origin.kind)||typeof origin.dealerId!=='string'||!profile.id.startsWith(`studio-${origin.dealerId}-`)) fail();
  } else keys(profile.source,['commit','sources']);
  if (!studio && (!/^[a-f0-9]{40}$/.test(profile.source.commit) || !Array.isArray(profile.source.sources) || !profile.source.sources.length)) fail();
  for (const source of studio ? [] : profile.source.sources) {
    keys(source,['path','sha256']);
    if (typeof source.path !== 'string' || !source.path || source.path.includes('..') || !hash.test(source.sha256)) fail();
  }
  keys(profile.plane,['width','height','fps']); keys(profile.card,['width','height']);
  if (![profile.plane.width,profile.plane.height,profile.plane.fps,profile.card.width,profile.card.height].every(value=>finite(value)&&value>0)
      || profile.plane.fps > 120 || profile.card.width > profile.plane.width || profile.card.height > profile.plane.height) fail();
  keys(profile.positions,['1','2','3','4','5','6','7','dealer']);
  for (const point of Object.values(profile.positions)) {
    keys(point,['cx','cy']);
    if (!finite(point.cx)||!finite(point.cy)||point.cx<0||point.cy<0||point.cx>profile.plane.width||point.cy>profile.plane.height) fail();
  }
  if (!object(profile.tracks) || Object.keys(profile.tracks).length > 32) fail();
  for (const [name,track] of Object.entries(profile.tracks)) {
    if (!/^(?:[1-7]|dealer|hole|flip)v?$/.test(name)) fail();
    keys(track,['firstFrame','frames']);
    if (!integer(track.firstFrame)||!Array.isArray(track.frames)||!track.frames.length||track.frames.length>3600) fail();
    for (const frame of track.frames) {
      keys(frame,['q','p','body','paper']);
      for (const key of ['q','p','body']) if (!Array.isArray(frame[key])||frame[key].length!==4
        ||frame[key].some(point=>!Array.isArray(point)||point.length!==2||point.some(value=>!finite(value)||Math.abs(value)>8192))) fail();
      if (!Array.isArray(frame.paper)||frame.paper.length!==3||frame.paper.some(value=>!integer(value)||value>255)) fail();
    }
  }
  if (!Array.isArray(profile.takes)||!profile.takes.length||profile.takes.length>128) fail();
  const seen=new Set(), hashes=new Set();
  for (const take of profile.takes) {
    keys(take,['key','target','variant','track','sha256','repositoryPath','frames','offsetFrames','startPose','endPose','firstFaceFrame','contactFrame','landFrame','clearFrame',...(Object.hasOwn(take,'releaseFrame')?['releaseFrame']:[])]);
    if (!targets.has(take.target)||!['','i','u','iu','v','iv'].includes(take.variant)||take.key!==`${take.target}:${take.variant||'base'}`
        ||seen.has(take.key)||hashes.has(take.sha256)||!hash.test(take.sha256)||typeof take.repositoryPath!=='string'||take.repositoryPath.includes('..')) fail();
    seen.add(take.key);hashes.add(take.sha256);
    if (!['VILA','REDO'].includes(take.startPose)||!['VILA','REDO'].includes(take.endPose)
        ||!(take.track===take.target+(take.variant.endsWith('v')?'v':'')
          ||studio&&profile.source.studio.kind==='copy'&&['v','iv'].includes(take.variant)&&take.track===take.target)
        ||(!profile.tracks[take.track]&&take.track!=='hole'&&(!studio||profile.source.studio.kind==='copy'))) fail();
    if (![take.frames,take.offsetFrames,take.firstFaceFrame,take.contactFrame,take.landFrame,take.clearFrame].every(integer)
        ||take.frames<1||take.offsetFrames>=take.frames||take.firstFaceFrame<take.offsetFrames||take.contactFrame<take.offsetFrames
        ||take.contactFrame>take.landFrame||take.landFrame>take.clearFrame||Math.max(take.firstFaceFrame,take.clearFrame)>=take.frames) fail();
    const track=profile.tracks[take.track];
    if (track && (take.firstFaceFrame!==track.firstFrame+take.offsetFrames||track.firstFrame+track.frames.length+take.offsetFrames>take.frames)) fail();
    if (Object.hasOwn(take,'releaseFrame') && (!integer(take.releaseFrame)||take.releaseFrame<take.firstFaceFrame||take.releaseFrame>=take.frames-1)) fail();
  }
  return profile;
}

export function resolveFilmedDealTake(profile,{sha256,event}={}) {
  if (!profile || !hash.test(sha256??'')) return null;
  validateFilmedDealProfile(profile);
  const target=filmedDealTarget(event);
  return profile.takes.find(take=>take.sha256===sha256&&take.target===target)??null;
}

export function filmedFaceAtTime(profile,take,seconds) {
  if (!profile||!take||!finite(seconds)||seconds<0) return null;
  const canonical=profile.takes.find(row=>row.key===take.key&&row.sha256===take.sha256);
  if (!canonical) return null;
  const track=profile.tracks[canonical.track];
  if (!track) return null;
  const index=Math.floor(seconds*profile.plane.fps+1e-5)-canonical.offsetFrames-track.firstFrame;
  return index<0?null:track.frames[Math.min(index,track.frames.length-1)];
}
