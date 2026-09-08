import * as THREE from './vendor/three/three.module.js';

// Physical card faces, paper edge and a lit turnover; the resting hand stays
// in the existing accessible DOM. One short render loop per dealt card.
export function createDealingCard({scene, camera, renderer}) {
  const textures = new Map();
  const back = texture(null);
  function texture(card) {
    const c=document.createElement('canvas'); c.width=280; c.height=392;
    const x=c.getContext('2d');
    x.fillStyle=card?'#f8f5eb':'#111613'; x.fillRect(0,0,280,392);
    if (!card) {
      x.strokeStyle='#384134'; x.lineWidth=.7;
      for(let p=-392;p<672;p+=13) { x.beginPath(); x.moveTo(p,0);x.lineTo(p+392,392);x.stroke();x.beginPath();x.moveTo(p,0);x.lineTo(p-392,392);x.stroke(); }
      x.fillStyle='#111613';x.fillRect(87,151,106,90);
      x.strokeStyle='#b7cf49';x.lineWidth=2;x.strokeRect(10,10,260,372);
      x.save();x.translate(99,157);x.scale(.82,.82);x.lineWidth=5;
      const mark=new Path2D('M8 22V8H22 M78 8H92V22 M92 78V92H78 M22 92H8V78 M68 36C68 28 60 24 50 24C40 24 32 28 32 36C32 50 68 50 68 64C68 72 60 76 50 76C40 76 32 72 32 64');x.stroke(mark);x.restore();
    } else {
      const red=card.s==='♥'||card.s==='♦';x.fillStyle=red?'#b72e2d':'#18221e';
      x.font='bold 45px Georgia';x.textAlign='center';
      for(let i=0;i<2;i++){x.save();if(i){x.translate(280,392);x.rotate(Math.PI);}x.fillText(card.r,34,49);x.font='38px Georgia';x.fillText(card.s,34,89);x.restore();}
      x.font='112px Georgia';x.fillText(card.s,140,232);
    }
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return t;
  }
  function atScreen(x,y,height) {
    const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,1-y/innerHeight*2),camera);
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-height),new THREE.Vector3());
  }
  return async function deal({origin, target, card, faceDown, handoff, duration=680}) {
    const w=target.width, h=target.height*Math.SQRT2;
    const shape=new THREE.Shape();const r=Math.min(w,h)*.055;
    shape.moveTo(-w/2+r,-h/2);shape.lineTo(w/2-r,-h/2);shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);
    shape.lineTo(w/2,h/2-r);shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2);shape.lineTo(-w/2+r,h/2);shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);shape.lineTo(-w/2,-h/2+r);shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
    const geo=new THREE.ShapeGeometry(shape);geo.rotateX(-Math.PI/2);
    const key=card?card.r+card.s:'back';if(card&&!textures.has(key))textures.set(key,texture(card));
    // ShapeGeometry UVs are world units; register the artwork to the card.
    const p=geo.attributes.position,uv=geo.attributes.uv;
    for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+w/2)/w,1-(p.getZ(i)+h/2)/h);
    const frontMat=new THREE.MeshStandardMaterial({map:card?textures.get(key):back,roughness:.64,metalness:0});
    const backMat=new THREE.MeshStandardMaterial({map:back,roughness:.64,side:THREE.BackSide});
    const root=new THREE.Group();const face=new THREE.Mesh(geo,frontMat);face.position.y=.35;face.castShadow=true;root.add(face);
    const reverse=new THREE.Mesh(geo,backMat);reverse.position.y=-.35;reverse.castShadow=true;root.add(reverse);
    const edgeGeo=new THREE.EdgesGeometry(geo);const edgeMat=new THREE.LineBasicMaterial({color:'#dfdbcf'});root.add(new THREE.LineSegments(edgeGeo,edgeMat));scene.add(root);
    const start=origin.clone(),mid=atScreen(handoff.x,handoff.y,14),end=atScreen(target.x+w/2,target.y+target.height/2,4);
    const started=performance.now();
    await new Promise(resolve=>{
      function frame(now){
        const t=Math.min(1,(now-started)/duration),split=.38;
        if(t<split){const u=t/split;root.position.lerpVectors(start,mid,u*u*(3-2*u));}
        else{const u=(t-split)/(1-split);root.position.lerpVectors(mid,end,1-(1-u)**2);}
        root.position.y+=Math.sin(t*Math.PI)*12;
        // Back shows at the shoe. Turn face up only after the handoff.
        const flip=Math.max(0,Math.min(1,(t-.25)/.5));
        root.rotation.set(0,-.45*(1-t),faceDown?Math.PI:Math.PI*(1-flip));
        root.scale.setScalar(.8+.2*t);renderer.render(scene,camera);
        if(t<1)requestAnimationFrame(frame);else resolve();
      }
      requestAnimationFrame(frame);
    });
    scene.remove(root);geo.dispose();edgeGeo.dispose();frontMat.dispose();backMat.dispose();edgeMat.dispose();renderer.render(scene,camera);
  };
}
