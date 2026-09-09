import * as T from './vendor/three/three.module.js';

// Dimensions in tabletop units. The stack and cut card share the same axis;
// both are driven by public draw counts, never by a second simulated deck.
export function makeShoe(size, state, render, assetBase='') {
  const root=new T.Group(), w=size*.37, l=size*.88, h=size*.29;
  const glass=new T.MeshPhysicalMaterial({color:'#e3eff0',transparent:true,opacity:.12,roughness:.06,metalness:.02,clearcoat:1,clearcoatRoughness:.08,side:T.DoubleSide,depthWrite:false});
  const edge=new T.LineBasicMaterial({color:'#c2d4d4',transparent:true,opacity:.30});
  const dark=new T.MeshStandardMaterial({color:'#171c21',roughness:.38,metalness:.15});
  const paper=new T.MeshStandardMaterial({color:'#eeeade',roughness:.84});
  const red=new T.MeshStandardMaterial({color:'#a52b20',roughness:.46,side:T.DoubleSide});
  const steel=new T.MeshStandardMaterial({color:'#bec4bf',roughness:.23,metalness:.85});
  const materials=[glass,edge,dark,paper,red,steel];
  function mesh(g,m,parent=root) {const x=new T.Mesh(g,m);x.castShadow=m!==glass;x.receiveShadow=true;parent.add(x);return x;}
  function panel(g) {const x=mesh(g,glass);const edges=new T.LineSegments(new T.EdgesGeometry(g),edge);x.add(edges);return x;}
  function roundedBox(width,height,length,material,parent=root) {
    const radius=Math.min(width,height,length)*.24;
    const shape=new T.Shape();
    const x=-width/2,y=-length/2;
    shape.moveTo(x+radius,y);shape.lineTo(x+width-radius,y);shape.quadraticCurveTo(x+width,y,x+width,y+radius);
    shape.lineTo(x+width,y+length-radius);shape.quadraticCurveTo(x+width,y+length,x+width-radius,y+length);
    shape.lineTo(x+radius,y+length);shape.quadraticCurveTo(x,y+length,x,y+length-radius);shape.lineTo(x,y+radius);shape.quadraticCurveTo(x,y,x+radius,y);
    const g=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:true,bevelThickness:.45,bevelSize:.45,bevelSegments:2,steps:1});
    g.rotateX(-Math.PI/2);g.translate(0,-height/2,0);
    return mesh(g,material,parent);
  }
  const base=roundedBox(w+9,3,l+6,dark);base.position.y=3;
  for(const side of [-1,1]) {
    const shape=new T.Shape();shape.moveTo(-l/2,0);shape.lineTo(l/2,0);shape.lineTo(l/2,h*1.1);shape.lineTo(-l/2,h*.48);shape.closePath();
    const wall=panel(new T.ExtrudeGeometry(shape,{depth:1.4,bevelEnabled:true,bevelThickness:.45,bevelSize:.45,bevelSegments:2,steps:1})); wall.rotation.y=Math.PI/2; wall.position.set(side*(w/2+3),5,0);
  }
  const rear=panel(new T.BoxGeometry(w+6,h,2));rear.position.set(0,h/2+4,-l/2);
  for(const x of [-w*.4,w*.4]) {const foot=mesh(new T.BoxGeometry(9,4,l*.7),dark);foot.position.set(x,0,0);}
  // Recessed steel fixings anchor the acrylic walls into the weighted base.
  for(const x of [-w*.43,w*.43]) for(const z of [-l*.4,l*.4]) {
    const screw=mesh(new T.CylinderGeometry(1.25,1.25,.5,12),steel);screw.position.set(x,5,z);
    const slot=mesh(new T.BoxGeometry(1.5,.12,.25),dark);slot.position.set(x,5.28,z);
  }
  const stack=new T.Group();root.add(stack);stack.rotation.x=.07;
  // Card fronts incline toward the opening, while the pack recedes into the shoe.
  stack.position.set(0,h*.48,l*.36);
  const pack=mesh(new T.BoxGeometry(w*.91,h*.82,1),paper,stack);
  const faceTexture=new T.TextureLoader().load(assetBase+'assets/cardback.png',render);faceTexture.colorSpace=T.SRGBColorSpace;
  const cardBack=new T.MeshStandardMaterial({map:faceTexture,roughness:.65}); materials.push(cardBack);
  const face=mesh(new T.PlaneGeometry(w*.90,h*.81),cardBack,stack);face.position.z=1;
  const edgeLines=new T.Group();stack.add(edgeLines);
  const lineMat=new T.LineBasicMaterial({color:'#9f9b91',transparent:true,opacity:.38});materials.push(lineMat);
  for(let i=0;i<42;i++) {
    const pts=[new T.Vector3(-w*.457,h*.41,0),new T.Vector3(w*.457,h*.41,0),new T.Vector3(w*.457,-h*.41,0)];
    const line=new T.Line(new T.BufferGeometry().setFromPoints(pts),lineMat);edgeLines.add(line);
  }
  const cut=mesh(new T.BoxGeometry(w*.96,h*.97,1.1),red,stack);
  const follower=roundedBox(w*.88,h*.72,9,dark,stack);
  const lip=roundedBox(w*.75,3,8,dark);lip.position.set(0,5,l*.46);
  const outlet=new T.Object3D();outlet.position.set(0,h*.16,l*.53);root.add(outlet);
  function update(s) {
    const fraction=Math.max(.015, Math.min(1,(s?.remaining??415)/(s?.total??416)));
    const length=l*.86*fraction;
    pack.scale.z=length;pack.position.z=-length/2;
    edgeLines.children.forEach((line,i)=>{line.position.z=-length*i/42;});
    follower.position.z=-length-4;
    const until=Math.max(0,(s?.cutAfter??312)-(s?.dealt??1));
    cut.position.z=s?.cutReached ? 0 : -l*.86*until/(s?.total??416);
    // Pull the reached cut card clear of the pack; never intersect the next card.
    cut.position.x=s?.cutReached ? -w*1.02 : 0;
    cut.position.y=s?.cutReached ? -h*.48+1 : h*.06;
    // A removed cut card rests on the felt beside the shoe, rather than floating.
    cut.rotation.x=s?.cutReached ? Math.PI/2-.07 : 0;
  }
  update(state);
  return {root,outlet,update,dispose(){materials.forEach(m=>m.dispose());faceTexture.dispose();}};
}
