// Canonical supplied material, shared by Studio, partner, lobby and game readers.
// These IDs identify designs, not operator rooms or private layer-upload UUIDs.
// A catalogue entry grants neither access nor visual/publication acceptance.
import {BACKGROUND_MATERIALS} from './background-materials.mjs';

export const MATERIAL_CATALOG_VERSION=1;
export const MATERIALS=Object.freeze([
  ...BACKGROUND_MATERIALS,
  Object.freeze({id:'blackjack-green-felt',role:'table',game:'blackjack',label:'Blackjack · grön filt',sources:Object.freeze([
    Object.freeze({kind:'image',contentType:'image/png',sha256:'1a88e822883374b6e855fa75d0da6a4dd02be0840bd4ddb7865345fe12c988b4',size:1858750,width:1672,height:941,hasAlpha:true}),
  ])}),
  Object.freeze({id:'blackjack-black-felt',role:'table',game:'blackjack',label:'Blackjack · svart filt',sources:Object.freeze([
    Object.freeze({kind:'image',contentType:'image/png',sha256:'c43a150457216aeb8649f802c5feb8719e257631704f98db46be2530214b8b19',size:1842659,width:1672,height:941,hasAlpha:true}),
  ])}),
]);

export function materialById(id) {return MATERIALS.find(row=>row.id===id)??null;}
export function materialForAsset(asset) {
  if(!asset||!['background','table'].includes(asset.role))return null;
  return MATERIALS.find(row=>row.role===asset.role&&row.sources.some(source=>source.sha256===asset.sha256
    &&source.size===asset.size&&source.contentType===asset.contentType&&source.width===asset.width&&source.height===asset.height))??null;
}
export function materialSource(materialId,kind='image') {return materialById(materialId)?.sources.find(row=>row.kind===kind)??null;}
export function materialLabel(asset) {return materialForAsset(asset)?.label??asset.label;}
export function materialFitsGame(asset,game) {
  const material=materialForAsset(asset);
  return Boolean(material&&(material.role==='background'||material.game===game));
}
