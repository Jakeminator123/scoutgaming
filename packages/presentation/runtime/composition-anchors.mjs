import {stageGeometry,tableRect} from '../../../packages/presentation/compositor/geometry.js';
import {validateCompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {projectGamePlane} from './game-overlay-layout.mjs';

export function compositionAnchorFrames(settings,layout,asset){
  const scene={layout,stage:{mobile:settings.mobile.dealer,desktop:settings.desktop.dealer},tablePlacement:settings[layout].table};
  const g=stageGeometry(scene),[x,y,width,height]=tableRect(scene,asset,g);
  return {table:{x,y,width,height},dealer:{x:g.x,y:g.y,width:1080*g.s,height:1920*g.s},
    scene:{x:0,y:0,width:g.dims[0],height:g.dims[1]}};
}
export function resolveAnchorRect(anchor,frames){
  if(!anchor)return {...frames.table};
  const base=frames[anchor.target],r=anchor.rect;
  return {x:base.x+r.x*base.width,y:base.y+r.y*base.height,width:r.width*base.width,height:r.height*base.height};
}
export function rebindAnchor(anchor,target,frames){
  const current=resolveAnchorRect(anchor,frames),base=frames[target];
  return {target,rect:{x:(current.x-base.x)/base.width,y:(current.y-base.y)/base.height,
    width:current.width/base.width,height:current.height/base.height}};
}
// framing is the reference (idle) clip's source framing. Only an opt-in
// autoScale layout receives the dealer plane: absent, the result is unchanged.
export function projectAnchorRects(geometry,frames,viewport,framing){
  const fit=Math.min(viewport.width/frames.scene.width,viewport.height/frames.scene.height);
  const project=r=>({x:(viewport.width-frames.scene.width*fit)/2+r.x*fit,
    y:(viewport.height-frames.scene.height*fit)/2+r.y*fit,width:r.width*fit,height:r.height*fit});
  const dealer=frames.dealer,stage={dims:[frames.scene.width,frames.scene.height],s:dealer.width/1080,x:dealer.x,y:dealer.y};
  return {cardsRect:project(resolveAnchorRect(geometry.anchors?.cards,frames)),betsRect:project(resolveAnchorRect(geometry.anchors?.bets,frames)),
    ...(geometry.autoScale?{dealerPlane:projectGamePlane(stage,viewport,framing)}:{})};
}

// Group edits apply the same affine movement once to dealer and table. Scene-
// anchored cards/bets stay fixed; dealer/table anchors follow their own layer.
export function moveCompositionLayer(settings,layout,role,field,value,together=false){
  const next=structuredClone(settings),before=settings[layout],after=next[layout];
  after[role][field]=value;
  if(together&&['dealer','table'].includes(role)){
    const other=role==='dealer'?'table':'dealer';
    if(field==='x'||field==='y')after[other][field]+=value-before[role][field];
    else{
      const ratio=value/before[role][field];
      after[other][other==='dealer'?'scale':'width']*=ratio;
      // Both layer scales pivot horizontally at the scene centre. Table y is
      // its top edge, while dealer y offsets the centred reference plane.
      after[other].x=after[role].x+(before[other].x-before[role].x)*ratio;
      const pivot=role==='dealer'?.5+before.dealer.y:before.table.y;
      after[other].y=pivot+((other==='dealer'?.5:0)+before[other].y-pivot)*ratio-(other==='dealer'?.5:0);
    }
  }
  return validateCompositionSettings(next);
}

export function restoreGeometryGroup(current,saved,layout,group){
  const next=structuredClone(current),dest=next[layout],source=saved[layout];
  if(group==='cards'){
    if(source.cardView)dest.cardView=source.cardView;else delete dest.cardView;
    dest.cardWidth=source.cardWidth;dest.dealer=structuredClone(source.dealer);
    dest.seats.forEach((seat,i)=>{seat.card=structuredClone(source.seats[i].card);});
  }else{
    dest.seats.forEach((seat,i)=>{seat.bet=structuredClone(source.seats[i].bet);});
    if(source.betMode)dest.betMode=source.betMode;else delete dest.betMode;
  }
  const auto={landing:false,cardSize:false,chips:false,...dest.autoScale};
  for(const key of group==='cards'?['landing','cardSize']:['chips'])auto[key]=source.autoScale?.[key]??false;
  const part=group==='cards'?'cards':'chips',savedAdjust=source.autoScale?.adjust?.[part];
  if(savedAdjust){auto.adjust??={};auto.adjust[part]=structuredClone(savedAdjust);}
  else if(auto.adjust){delete auto.adjust[part];if(!Object.keys(auto.adjust).length)delete auto.adjust;}
  if(auto.landing||auto.cardSize||auto.chips)dest.autoScale=auto;else delete dest.autoScale;
  if(source.anchors?.[group]){dest.anchors??={};dest.anchors[group]=structuredClone(source.anchors[group]);}
  else if(dest.anchors){delete dest.anchors[group];if(!Object.keys(dest.anchors).length)delete dest.anchors;}
  return next;
}
