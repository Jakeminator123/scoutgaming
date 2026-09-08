import * as T from './vendor/three/three.module.js';

// Dimensions in tabletop units. The stack and cut card share the same axis;
// both are driven by public draw counts, never by a second simulated deck.
export function makeShoe(size, state, render) {
  const root=new T.Group(), w=size*.37, l=size*.88, h=size*.29;
  const glass=new T.MeshPhysicalMaterial({color:'#e3eff0',transparent:true,opacity:.16,roughness:.08,metalness:.05,side:T.DoubleSide,depthWrite:false});
  const edge=new T.LineBasicMaterial({color:'#c2d4d4',transparent:true,opacity:.55});
  const dark=new T.MeshStandardMaterial({color:'#171c21',roughness:.38,metalness:.15});
  const paper=new T.MeshStandardMaterial({color:'#eeeade',roughness:.84});
  const red=new T.MeshStandardMaterial({color:'#a52b20',roughness:.46,side:T.DoubleSide});
  const materials=[glass,edge,dark,paper,red];
  function mesh(g,m,parent=root) {const x=new T.Mesh(g,m);x.castShadow=m!==glass;x.receiveShadow=true;parent.add(x);return x;}
  function panel(g) {const x=mesh(g,glass);const edges=new T.LineSegments(new T.EdgesGeometry(g),edge);x.add(edges);return x;}
  const base=panel(new T.BoxGeometry(w+9,3,l+6));base.position.y=3;
  for(const side of [-1,1]) {
    const shape=new T.Shape();shape.moveTo(-l/2,0);shape.lineTo(l/2,0);shape.lineTo(l/2,h*1.1);shape.lineTo(-l/2,h*.48);shape.closePath();
    const wall=panel(new T.ShapeGeometry(shape)); wall.rotation.y=Math.PI/2; wall.position.set(side*(w/2+3),5,0);
  }
  const rear=panel(new T.BoxGeometry(w+6,h,2));rear.position.set(0,h/2+4,-l/2);
  for(const x of [-w*.4,w*.4]) {const foot=mesh(new T.BoxGeometry(9,4,l*.7),dark);foot.position.set(x,0,0);}
  const stack=new T.Group();root.add(stack);stack.rotation.x=-.48;
  // Card fronts incline toward the opening, while the pack recedes into the shoe.
  stack.position.set(0,h*.31,l*.35);
  const pack=mesh(new T.BoxGeometry(w*.91,h*.82,1),paper,stack);
  const faceTexture=new T.TextureLoader().load('assets/cardback.png',render);faceTexture.colorSpace=T.SRGBColorSpace;
  const cardBack=new T.MeshStandardMaterial({map:faceTexture,roughness:.65}); materials.push(cardBack);
  const face=mesh(new T.PlaneGeometry(w*.90,h*.81),cardBack,stack);face.position.z=1;
  const edgeLines=new T.Group();stack.add(edgeLines);
  const lineMat=new T.LineBasicMaterial({color:'#9f9b91',transparent:true,opacity:.38});materials.push(lineMat);
  for(let i=0;i<42;i++) {
    const pts=[new T.Vector3(-w*.457,h*.41,0),new T.Vector3(w*.457,h*.41,0),new T.Vector3(w*.457,-h*.41,0)];
    const line=new T.Line(new T.BufferGeometry().setFromPoints(pts),lineMat);edgeLines.add(line);
  }
  const cut=mesh(new T.BoxGeometry(w*.96,h*.97,1.1),red,stack);
  const follower=mesh(new T.BoxGeometry(w*.88,h*.72,9),dark,stack);
  const lip=mesh(new T.BoxGeometry(w*.75,3,8),dark);lip.position.set(0,5,l*.46);
  const outlet=new T.Object3D();outlet.position.set(0,h*.16,l*.53);root.add(outlet);
  function update(s) {
    const fraction=Math.max(.015, Math.min(1,(s?.remaining??415)/(s?.total??416)));
    const length=l*.68*fraction;
    pack.scale.z=length;pack.position.z=-length/2;
    edgeLines.children.forEach((line,i)=>{line.position.z=-length*i/42;});
    follower.position.z=-length-4;
    const until=Math.max(0,(s?.cutAfter??312)-(s?.dealt??1));
    cut.position.z=-l*.68*until/(s?.total??416);
    // Pull the reached cut card clear of the pack; never intersect the next card.
    cut.position.x=s?.cutReached ? -w*1.02 : 0;
    cut.position.y=s?.cutReached ? h*.38 : h*.06;
    // Exposed cut card stands clear after the round reaches it.
    cut.rotation.x=s?.cutReached ? -.25 : 0;
  }
  update(state);
  return {root,outlet,update,dispose(){materials.forEach(m=>m.dispose());faceTexture.dispose();}};
}
