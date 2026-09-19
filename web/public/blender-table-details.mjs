import * as T from './vendor/three/three.module.js';

// Ink only: retain the supplied Blender felt and its normal/roughness maps.
// Artwork comes from table-scene.mjs and design-kit/ScoutBrand.dc.html.
export function createFeltBranding({radius,depth,rear,surfaceHeight}){
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;
  const x=canvas.getContext('2d');
  x.textAlign='center';x.fillStyle='#bcab76';x.font='500 44px Georgia';
  x.fillText('BLACKJACK PAYS 3 TO 2',1024,370);
  x.fillStyle='#a6b2a0';x.font='32px Georgia';
  x.fillText('Dealer stands on all 17s',1024,430);
  x.strokeStyle='#a6955d';x.lineWidth=2;
  x.beginPath();x.ellipse(1024,280,550,250,0,.22,Math.PI-.22);x.stroke();
  x.fillStyle='#b9a66c';x.font='500 38px Georgia';
  x.fillText('INSURANCE PAYS 2 TO 1',1024,492);
  // Same Scout bracket/S mark as the existing felt-etch brand reference.
  x.save();x.translate(420,235);x.scale(1.5,2.2);
  x.strokeStyle='rgba(233,214,138,.40)';x.lineWidth=6;
  x.stroke(new Path2D('M8 22V8H22 M78 8H92V22 M92 78V92H78 M22 92H8V78 M68 36C68 28 60 24 50 24C40 24 32 28 32 36C32 50 68 50 68 64C68 72 60 76 50 76C40 76 32 72 32 64'));
  x.fillStyle='rgba(214,255,58,.30)';x.beginPath();x.arc(50,50,7,0,Math.PI*2);x.fill();x.restore();
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
  const material=new T.MeshStandardMaterial({map,transparent:true,depthWrite:false,roughness:.95,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const ink=new T.Mesh(new T.PlaneGeometry(radius*2,depth),material);
  ink.name='ScoutFeltInk';ink.rotation.x=-Math.PI/2;
  ink.position.set(0,surfaceHeight+.0002,rear+depth/2);ink.receiveShadow=true;
  return ink;
}

export const BET_BOX_SIZE={width:.205,height:.205*100/128};
export function createFeltBettingBoxes({radius,depth,rear,surfaceHeight}){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=400;
  const ctx=canvas.getContext('2d');ctx.scale(4,4);ctx.translate(64,50);
  ctx.strokeStyle='#c2b681';ctx.fillStyle='#c2b681';ctx.lineWidth=.8;
  ctx.beginPath();ctx.arc(0,0,30,0,Math.PI*2);ctx.stroke();
  for(const side of [-1,1]){
    ctx.save();if(side<0)ctx.rotate(Math.PI);
    ctx.beginPath();ctx.arc(0,0,38,-Math.PI/4,Math.PI/4);
    ctx.lineTo(52/Math.SQRT2,52/Math.SQRT2);ctx.arc(0,0,52,Math.PI/4,-Math.PI/4,true);ctx.closePath();ctx.stroke();
    ctx.translate(45,0);ctx.rotate(Math.PI/2);ctx.font='7px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(side<0?'PP':'21+3',0,0);ctx.restore();
  }
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
  const material=new T.MeshStandardMaterial({map,transparent:true,depthWrite:false,roughness:.95,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const geometry=new T.PlaneGeometry(BET_BOX_SIZE.width,BET_BOX_SIZE.height);
  const group=new T.Group();group.name='FeltBettingBoxes';
  const meshes=Array.from({length:7},(_,id)=>{const m=new T.Mesh(geometry,material);m.name=`FeltBox${id}`;m.visible=false;m.receiveShadow=true;group.add(m);return m;});
  return {group,meshes,update(boxes){
    for(const mesh of meshes)mesh.visible=false;
    for(const box of boxes){const m=meshes[box.id];if(!m)continue;
      m.visible=true;m.position.set(box.x*radius,surfaceHeight+.0004,rear+box.z*depth);
      m.rotation.set(-Math.PI/2,0,-box.rotation);m.updateMatrixWorld(true);
    }
  }};
}

// A sloping pack fits inside the supplied shell; its front card stays at the
// outlet as the follower moves forward. Only public server counts size it.
export function createBlenderCardStack({width,length,height},cardBack){
  const root=new T.Group();root.name='ServerCardStack';root.visible=false;
  const w=width*.85,run=length*.30,rise=height*.27;
  const front=.008,bottom=.005,maxLength=length*.55,slope=.25;
  const paper=new T.MeshStandardMaterial({color:'#f0eee6',roughness:.86});
  const geo=new T.BoxGeometry(w,1,1),original=geo.attributes.position.array.slice();
  const pack=new T.Mesh(geo,paper);pack.name='CardPack';pack.castShadow=true;root.add(pack);
  const faceMaterial=new T.MeshStandardMaterial({map:cardBack,roughness:.72,side:T.DoubleSide});
  const face=new T.Mesh(new T.PlaneGeometry(w,Math.hypot(run,rise)),faceMaterial);
  face.name='ScoutCardBack';face.rotation.x=-Math.atan2(run,rise);
  face.position.set(0,bottom+rise/2+.0002,-front-run/2+.0002);root.add(face);
  const edgeCount=42,lines=new Float32Array(edgeCount*4*3);
  const lineGeo=new T.BufferGeometry();lineGeo.setAttribute('position',new T.BufferAttribute(lines,3));
  const edges=new T.LineSegments(lineGeo,new T.LineBasicMaterial({color:'#99998e',transparent:true,opacity:.5}));root.add(edges);
  const follower=new T.Mesh(new T.BoxGeometry(w*.95,rise,.005),new T.MeshStandardMaterial({color:'#171c21',roughness:.5}));
  follower.name='ShoeFollower';root.add(follower);
  const cut=new T.Mesh(new T.PlaneGeometry(w*1.03,Math.hypot(run,rise)*1.05),new T.MeshStandardMaterial({color:'#a52b20',roughness:.55,side:T.DoubleSide}));
  cut.name='CutCard';cut.rotation.copy(face.rotation);root.add(cut);
  function update(state){
    const valid=Number.isFinite(state?.remaining)&&Number.isFinite(state?.total)&&state.total>0;
    root.visible=valid;if(!valid)return;
    const remaining=Math.max(0,Math.min(state.total,state.remaining));
    const d=maxLength*remaining/state.total;
    pack.visible=face.visible=edges.visible=remaining>0;
    const pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){
      const y=original[i*3+1]+.5,z=(.5-original[i*3+2])*d;
      pos.setXYZ(i,original[i*3],bottom+y*rise+z*slope,-front-y*run-z);
    }
    pos.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();
    const n=Math.min(edgeCount,remaining),lp=lineGeo.attributes.position;
    for(let i=0;i<n;i++){
      const z=d*i/n,y=bottom+rise+z*slope;
      lp.setXYZ(i*4,-w/2,y,-front-run-z);lp.setXYZ(i*4+1,w/2,y,-front-run-z);
      lp.setXYZ(i*4+2,w/2,y,-front-run-z);lp.setXYZ(i*4+3,w/2,bottom+z*slope,-front-z);
    }
    lp.needsUpdate=true;lineGeo.setDrawRange(0,n*4);lineGeo.computeBoundingSphere();
    follower.position.set(0,bottom+rise/2+d*slope,-front-run/2-d-.004);
    follower.rotation.x=face.rotation.x;
    const hasCut=Number.isFinite(state.cutAfter)&&Number.isFinite(state.dealt);
    cut.visible=hasCut;
    if(hasCut){
      const reached=state.cutReached===true;
      const cutDepth=maxLength*Math.max(0,Math.min(remaining,state.cutAfter-state.dealt))/state.total;
      cut.position.set(reached?-w*1.12:0,reached?.002:bottom+rise/2+cutDepth*slope,-front-run/2-cutDepth);
      cut.rotation.x=reached?-Math.PI/2:face.rotation.x;
    }
    root.userData.remaining=remaining;root.userData.total=state.total;root.userData.packLength=d;
  }
  return {root,update};
}
