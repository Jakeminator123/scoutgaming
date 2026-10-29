import {stageGeometry,backgroundRect,tableRect} from '../compositor/geometry.js';
import {defaultCompositionSettings,sceneForComposition} from '../contracts/composition-settings.mjs';

// One still of an environment for a computer screen (1920 x 1080): the same reference plane and draw
// order as the compositor (compositor.js render) and Admin's scene preview (CompositionPreview). The
// background is cover-fitted with its saved transform, the table uses its saved placement and the dealer's
// 16:9 actor plane sits on the stage. Rects are pixels [x, y, width, height] and may reach outside the frame.
// Pure: used by the server export of a miljöbild (sharp) and by Admin's scene cards (CSS percentages).
export const SCENE_STILL_SIZE = Object.freeze({width:1920,height:1080});
const DEALER_ASPECT = 16/9;
const size = value => value && Number.isFinite(value.width) && Number.isFinite(value.height) && value.width > 0 && value.height > 0;

/** Layers in draw order for `composition` (a lane's saved composition, or the defaults) on a computer screen.
 * `background` and `table` are the chosen images' sizes ({width, height}) or null; `dealer` adds the actor plane. */
export function desktopSceneStill({composition, background = null, table = null, dealer = false} = {}) {
  const scene = sceneForComposition(composition ?? defaultCompositionSettings(), 'desktop');
  const geometry = stageGeometry(scene), {dims, s, y} = geometry;
  const layers = [];
  if (size(background)) layers.push({role:'background', rect:backgroundRect(scene, background, dims)});
  const tableLayer = size(table) ? {role:'table', rect:tableRect(scene, table, geometry)} : null;
  const dealerLayer = dealer ? {role:'dealer', rect:[(dims[0]-1920*s*DEALER_ASPECT)/2+scene.stage.desktop.x*dims[0], y, 1920*s*DEALER_ASPECT, 1920*s]} : null;
  // tableFront draws the dealer first; otherwise the dealer's hands pass over the table.
  for (const layer of scene.tableFront ? [dealerLayer, tableLayer] : [tableLayer, dealerLayer]) if (layer) layers.push(layer);
  return {width:dims[0], height:dims[1], layers};
}

/** The same rect as percentages of the frame, for CSS absolute positioning. */
export function stillRectPercent([x, y, width, height], frame = SCENE_STILL_SIZE) {
  return {left:x/frame.width*100, top:y/frame.height*100, width:width/frame.width*100, height:height/frame.height*100};
}
