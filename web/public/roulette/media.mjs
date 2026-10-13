import {defaultCompositionSettings} from '/composition-settings.mjs';

// Temporary game artwork, not an operator publication or a result video.
// Future MP4 must use the same framing and a registered PNG alpha mask.
export const ROULETTE_TABLE = Object.freeze({src:'/roulette/assets/roulette-bord.png',contentType:'image/png'});
export const ROULETTE_TABLE_MASK = null;

export function rouletteSceneSettings(published=null) {
  const settings=published ? structuredClone(published) : defaultCompositionSettings();
  settings.desktop.table={width:.8,x:0,y:.2};
  settings.tableFront=true;
  return settings;
}
