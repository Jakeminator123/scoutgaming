import {validateProject} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import {materialForAsset} from '../../../../../packages/presentation/contracts/material-catalog.mjs';
import {validateRouletteStartBinding,validateFrozenRouletteStart} from '../../../../../packages/presentation/contracts/roulette-start-contract.mjs';
import {assertRouletteIdleRecord} from '../../../../../packages/presentation/contracts/roulette-idle-contract.mjs';
import {rouletteClipSlots,rouletteClipMatches} from './roulette-clip-map.mjs';

const startSlot=rouletteClipSlots().find(slot=>slot.eventId==='roulette.wheel-start');
const idleSlot=rouletteClipSlots().find(slot=>slot.eventId==='roulette.idle'&&slot.situation==='breathing');
export function rouletteStartTables(project,laneId) {
  const layer=project.lanes?.find(lane=>lane.id===laneId)?.layers.table;
  if(!layer?.enabled)return [];
  return (project.layerAssets??[]).flatMap(asset=>{
    const design=materialForAsset(asset);
    return asset.role==='table'&&asset.game==='roulette'&&design?.game==='roulette'&&layer.allowed.includes(asset.id)
      ? [{assetId:asset.id,designId:design.id,label:asset.label}]:[];
  });
}
export function rouletteStartCompositions(project,dealerId) {
  return (project.lanes??[]).filter(lane=>lane.layers.dealer.enabled&&lane.layers.dealer.allowed.includes(dealerId)
    &&rouletteStartTables(project,lane.id).length>0);
}
export function rouletteStartForm(project,dealerId,videoId) {
  const saved=project.dealers.find(dealer=>dealer.id===dealerId)?.rouletteStart;
  const chosen=videoId??saved?.videoId??'',binding=saved?.videoId===chosen?saved:null;
  return {videoId:chosen,tableDesignId:binding?.tableDesignId??'',durationMs:binding?String(binding.durationMs):'',
    wheelImpulseMs:binding?String(binding.wheelImpulseMs):'',ballReleaseMs:binding?String(binding.ballReleaseMs):'',
    foregroundPolygons:binding?.foregroundPolygons?JSON.stringify(binding.foregroundPolygons):''};
}
export function bindRouletteStart(project,inventory,dealerId,laneId,form) {
  const dealer=project.dealers.find(row=>row.id===dealerId);
  if(!rouletteStartCompositions(project,dealerId).some(lane=>lane.id===laneId))
    throw Error('Välj en miljö som tillåter denna dealer och ett registrerat roulettebord.');
  if(!dealer?.rouletteIdle)throw Error('Koppla roulettens grundloop innan du kopplar startfilmen.');
  const idle=inventory.videos.find(row=>row.id===dealer.rouletteIdle.videoId);
  if(!rouletteClipMatches(idle,dealerId,idleSlot))throw Error('Den kopplade roulette-grundloopen är inte tillgänglig.');
  assertRouletteIdleRecord({contentType:idle.contentType,classification:idle.classification},dealerId);
  const video=inventory.videos.find(row=>row.id===form.videoId);
  if(!rouletteClipMatches(video,dealerId,startSlot))throw Error('Välj en tillgänglig startfilm registrerad för denna dealer och roulette.');
  if(!rouletteStartTables(project,laneId).some(row=>row.designId===form.tableDesignId))
    throw Error('Välj en registrerad rouletteborddesign som är tillåten i miljön.');
  const profile={tableDesignId:form.tableDesignId};
  for(const key of ['durationMs','wheelImpulseMs','ballReleaseMs']) {
    if(typeof form[key]!=='string'||!/^\d+$/.test(form[key]))throw Error('Ange filmens längd, hjulimpuls och kulsläpp som hela millisekunder.');
    profile[key]=Number(form[key]);
  }
  if(form.foregroundPolygons?.trim()){
    try{profile.foregroundPolygons=JSON.parse(form.foregroundPolygons);}catch{throw Error('Handregionen måste vara giltig JSON med normaliserade polygonpunkter.');}
  }
  let binding;
  try{binding=validateRouletteStartBinding({videoId:video.id,...profile});}
  catch{throw Error('Kontrollera tider och handregion: 0 ≤ hjulimpuls ≤ kulsläpp < längd (1–60 s).');}
  try{validateFrozenRouletteStart({clip:video,...profile},dealerId,value=>value);}
  catch{throw Error('Startfilmen behöver registrerad alfa-WebM, engångsspelning, VILA → VILA och explicit inramning. Granska och klassificera filmen först.');}
  const draft=structuredClone(project);draft.dealers.find(row=>row.id===dealerId).rouletteStart=binding;
  return validateProject(draft);
}
export function removeRouletteStart(project,dealerId) {
  const draft=structuredClone(project),dealer=draft.dealers.find(row=>row.id===dealerId);
  if(!dealer)throw Error('Dealern saknas.');
  delete dealer.rouletteStart;return validateProject(draft);
}
