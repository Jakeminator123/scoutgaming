import * as THREE from '/vendor/three/three.module.js';
import {cardFaceArt} from '/card-art.mjs';
export function packedGPU(canvas,video,settings={}){
 const width=1920,height=1080;
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});const outputWidth=settings.outputWidth||width;renderer.setSize(outputWidth,Math.round(height*outputWidth/width),false);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(0,width,0,-height,.1,1000);camera.position.z=100;
 const textures=new Map(),planes=[];
 function textureFor(input){if(!textures.has(input)){const texture=new THREE.VideoTexture(input);texture.colorSpace=THREE.NoColorSpace;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;textures.set(input,texture);}return textures.get(input);}
 let source=textureFor(video);
 for(const front of [false,true]){
  const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,uniforms:{source:{value:source},front:{value:front?1:0},horizontal:{value:0},handMaskEnabled:{value:1}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`uniform sampler2D source;uniform float front;uniform float horizontal;uniform float handMaskEnabled;varying vec2 v;void main(){vec2 maskUV=mix(vec2(v.x,v.y*.5),vec2(.5+v.x*.5,v.y),horizontal);vec2 rgbUV=mix(vec2(v.x,.5+v.y*.5),vec2(v.x*.5,v.y),horizontal);vec3 m=texture2D(source,maskUV).rgb;vec3 rgb=texture2D(source,rgbUV).rgb;float f=min(m.r,m.g)*handMaskEnabled;float b=(m.r-f)/max(1.0-f,.00001);float a=mix(b,f,front);if(a<.01)discard;gl_FragColor=vec4(rgb,a);}`});
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);plane.position.set(width/2,-height/2,front?1:-1);plane.renderOrder=front?2:0;scene.add(plane);planes.push(plane);
 }
 const tex=new THREE.CanvasTexture(cardFaceArt({r:'Q',s:'♠'}).canvas);tex.colorSpace=THREE.SRGBColorSpace;
 const backTex=new THREE.TextureLoader().load('/assets/cardback.png',()=>renderer.render(scene,camera));backTex.colorSpace=THREE.SRGBColorSpace;
 const faceTextures=new Map([['Q♠',tex]]);
 function faceTexture(card){if(!card)return tex;const key=card.r+card.s;if(!faceTextures.has(key)){const t=new THREE.CanvasTexture(cardFaceArt(card).canvas);t.colorSpace=THREE.SRGBColorSpace;faceTextures.set(key,t);}return faceTextures.get(key);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,1,1,1,0,0,0],2));geometry.setIndex([0,2,1,0,3,2]);
 const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:tex,transparent:true,alphaTest:.01,toneMapped:false,side:THREE.DoubleSide}));mesh.renderOrder=1;mesh.frustumCulled=false;scene.add(mesh);
 const cardMeshes=[mesh];
 return {paint(record,options={}){source=textureFor(options.video||video);const selectedMap=options.face==='back'?backTex:tex;if(mesh.material.map!==selectedMap){mesh.material.map=selectedMap;mesh.material.needsUpdate=true;}const scale=options.transform?.scale??1,[tx,ty]=options.transform?.translation??[0,0];for(const plane of planes){plane.material.uniforms.source.value=source;plane.material.uniforms.handMaskEnabled.value=options.handMaskEnabled===false?0:1;plane.material.uniforms.horizontal.value=options.layout==='horizontal'?1:0;plane.scale.set(scale,scale,1);plane.position.x=width/2*scale+tx;plane.position.y=-height/2*scale-ty;}const p=record?.fingerCandidateNative;let quad=options.quad;if(quad===undefined&&p){const dx=p[0]-1075,dy=p[1]-620;quad=[[1052,619],[1109,612],[1136,643],[1079,650]].map(([x,y])=>[x+dx,y+dy]);}const cards=options.cards??[{quad,face:options.face,card:options.card}];
 while(cardMeshes.length<cards.length){const extra=new THREE.Mesh(geometry.clone(),mesh.material.clone());extra.renderOrder=1;extra.frustumCulled=false;scene.add(extra);cardMeshes.push(extra);}
 cardMeshes.forEach((item,index)=>{const card=cards[index];item.visible=!!card?.quad;if(!item.visible)return;const map=card.face==='back'?backTex:faceTexture(card.card);if(item.material.map!==map){item.material.map=map;item.material.needsUpdate=true;}card.quad.forEach(([x,y],i)=>item.geometry.attributes.position.setXYZ(i,x,-y,0));item.geometry.attributes.position.needsUpdate=true;});
 source.needsUpdate=true;renderer.render(scene,camera);}};
}
