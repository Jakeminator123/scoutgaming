import * as THREE from '/vendor/three/three.module.js';
import {cardFaceArt} from '/card-art.mjs';
export function packedGPU(canvas,video){
 const width=1920,height=1080;
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setSize(width,height,false);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(0,width,0,-height,.1,1000);camera.position.z=100;
 const source=new THREE.VideoTexture(video);source.colorSpace=THREE.NoColorSpace;source.minFilter=THREE.LinearFilter;source.magFilter=THREE.LinearFilter;
 for(const front of [false,true]){
  const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,uniforms:{source:{value:source},front:{value:front?1:0}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`uniform sampler2D source;uniform float front;varying vec2 v;void main(){vec3 m=texture2D(source,vec2(v.x,v.y*.5)).rgb;vec3 rgb=texture2D(source,vec2(v.x,.5+v.y*.5)).rgb;float f=min(m.r,m.g);float b=(m.r-f)/max(1.0-f,.00001);float a=mix(b,f,front);if(a<.01)discard;gl_FragColor=vec4(rgb,a);}`});
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);plane.position.set(width/2,-height/2,front?1:-1);plane.renderOrder=front?2:0;scene.add(plane);
 }
 const tex=new THREE.CanvasTexture(cardFaceArt({r:'Q',s:'♠'}).canvas);tex.colorSpace=THREE.SRGBColorSpace;
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,1,1,1,0,0,0],2));geometry.setIndex([0,2,1,0,3,2]);
 const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:tex,transparent:true,alphaTest:.01,toneMapped:false,side:THREE.DoubleSide}));mesh.renderOrder=1;mesh.frustumCulled=false;scene.add(mesh);
 return {paint(record){const p=record?.fingerCandidateNative;mesh.visible=!!p;if(p){const dx=p[0]-1075,dy=p[1]-620;[[1052,619],[1109,612],[1136,643],[1079,650]].forEach(([x,y],i)=>geometry.attributes.position.setXYZ(i,x+dx,-y-dy,0));geometry.attributes.position.needsUpdate=true;}source.needsUpdate=true;renderer.render(scene,camera);}};
}
