import {sceneForComposition,validateCompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {stageGeometry,tableRect,backgroundRect} from '../../../packages/presentation/compositor/geometry.js';
import {moveCompositionLayer} from '../../../packages/presentation/runtime/composition-anchors.mjs';

// Editor operations use the published coordinate contract. Table y remains its
// top edge; bottom alignment is an explicit edit, never a migration or default.
export function compositionLayerRect(settings,layout,role,asset){
  const scene=sceneForComposition(settings,layout),g=stageGeometry(scene),[width,height]=g.dims;
  let rect;
  if(role==='table'){
    if(![asset?.width,asset?.height].every(value=>Number.isFinite(value)&&value>0))throw Error('Välj ett bord med känd bildstorlek.');
    rect=tableRect(scene,asset,g);
  }else if(role==='background'){
    rect=backgroundRect(scene,[asset?.width,asset?.height].every(value=>Number.isFinite(value)&&value>0)?asset:{width,height},g.dims);
  }else if(role==='dealer'){
    // CompositionPreview draws the framed dealer into a 16:9 source canvas.
    const actorWidth=1920*g.s*16/9;
    rect=[(width-actorWidth)/2+settings[layout].dealer.x*width,g.y,actorWidth,1920*g.s];
  }else throw Error('Ogiltigt lager.');
  return {x:rect[0]/width,y:rect[1]/height,width:rect[2]/width,height:rect[3]/height};
}

export function translateCompositionLayer(settings,layout,role,dx,dy,together=false){
  const next=moveCompositionLayer(settings,layout,role,'x',settings[layout][role].x+dx,together);
  return moveCompositionLayer(next,layout,role,'y',settings[layout][role].y+dy,together);
}

export function sizeCompositionLayer(settings,layout,role,size,{asset,keepBottom=false,together=false}={}){
  const next=moveCompositionLayer(settings,layout,role,role==='table'?'width':'scale',size,together);
  if(role==='table'&&keepBottom&&!together){
    const before=compositionLayerRect(settings,layout,role,asset),after=compositionLayerRect(next,layout,role,asset);
    next[layout].table.y+=before.height-after.height;
  }
  return validateCompositionSettings(next);
}

export function alignCompositionLayer(settings,layout,role,edge,asset,together=false){
  const rect=compositionLayerRect(settings,layout,role,asset);
  if(edge==='center')return translateCompositionLayer(settings,layout,role,.5-rect.x-rect.width/2,0,together);
  if(edge==='bottom')return translateCompositionLayer(settings,layout,role,0,1-rect.y-rect.height,together);
  throw Error('Ogiltig placering.');
}

export function restoreCompositionLayer(settings,saved,layout,role){
  const next=structuredClone(settings);
  next[layout][role]=structuredClone(saved[layout][role]);
  return validateCompositionSettings(next);
}
