import {MATERIALS} from './public/material-catalog.mjs';
import {layerAssetFitsGame} from './layer-asset-contract.mjs';
import {StudioStorageError} from './storage/studio-contract.mjs';
const sources=new Map(MATERIALS.flatMap(material=>material.sources.map(source=>[source.sha256,{material,source}])));
const fail=()=>{throw new StudioStorageError('studio_presentation_game_material_mismatch',422);};

// Known designs are identified by immutable bytes. A different label, upload
// UUID or forged dimensions cannot turn a blackjack table into roulette media.
// Untagged historical tables remain blackjack-only.
export function assertPresentationRoomMaterials(presentation,room) {
  const game=room.game??'blackjack';if(!['blackjack','roulette'].includes(game))fail();
  const lane=presentation.lanes.find(row=>row.id===room.presentationLaneId);if(!lane)fail();
  const assets=new Map((presentation.assets??[]).map(asset=>[asset.id,asset]));
  for(const role of ['background','table'])for(const id of new Set([...lane.layers[role].allowed,lane.layers[role].default].filter(Boolean))){
    const asset=assets.get(id),known=sources.get(asset?.sha256);
    if(asset&&(!layerAssetFitsGame(asset,game)||asset.role!==role))fail();
    if(!known)continue;
    const {material,source}=known;
    if(material.role!==role||asset.role!==role||['size','contentType','width','height'].some(key=>asset[key]!==source[key])
      ||role==='table'&&material.game!==game)fail();
  }
}
