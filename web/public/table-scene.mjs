import { createDealingCard } from './dealing-card.mjs';
import { makeShoe } from './shoe-model.mjs';
import * as THREE from './vendor/three/three.module.js';

// Fixed camera: the dealer film, mesh rail and DOM hit targets share one
// projection. Camera parallax would break contact with the recorded hands.
export function createTableScene(canvas, dealer) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera();
  camera.position.set(0, 2000, 2000);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xfff3df, 0x171b20, 2));
  const key = new THREE.DirectionalLight(0xffe6bd, 3.2);
  key.position.set(-500, 800, -300); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.001;
  key.shadow.normalBias = 1.5; scene.add(key);
  const fill = new THREE.DirectionalLight(0xc0d4ef, 1.5);
  fill.position.set(600, 300, 500); scene.add(fill);
  const palette = { vera: '#144c35', astrid: '#263336', amira: '#665139', mei: '#12484e' };
  const texture = feltTexture(palette[dealer] ?? palette.vera);
  const felt = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  const leather = new THREE.MeshPhysicalMaterial({ color: '#191a18', roughness: .32, metalness: .12, clearcoat: .25 });
  const wood = new THREE.MeshStandardMaterial({ color: '#21150f', roughness: .38, metalness: .12 });
  const brass = new THREE.MeshStandardMaterial({ color: '#b99b57', roughness: .3, metalness: .75 });
  const carpet = new THREE.MeshStandardMaterial({ map: carpetTexture(), roughness: 1, color: '#9da9ad' });
  const legMaterial = new THREE.MeshStandardMaterial({ color: '#201912', roughness: .26, metalness: .18 });
  const footMaterial = new THREE.MeshStandardMaterial({ color: '#8e7957', roughness: .3, metalness: .75 });
  const contact = new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: .6 });
  let group, width, height, rx, depth, rear, shoeModel, shoeState;
  function mesh(geometry, material, y = 0) {
    const m = new THREE.Mesh(geometry, material); m.position.y = y; m.castShadow = true; m.receiveShadow = true; group.add(m); return m;
  }
  function shape(radius, d) {
    const s = new THREE.Shape();
    s.moveTo(-radius, 0); s.lineTo(radius, 0);
    for (let i = 1; i <= 96; i++) {
      const a = Math.PI * i / 96;
      s.lineTo(radius * Math.cos(a), d * Math.sin(a));
    }
    s.closePath(); return s;
  }
  function resize() {
    width = innerWidth; height = innerHeight;
    const portrait = width < 861 && height > width;
    rear = portrait ? height * .40 : height * .52;
    rx = portrait ? width * .78 : width * .485;
    depth = height * (portrait ? .34 : .39) * Math.SQRT2;
    renderer.setSize(width, height, false);
    camera.left = -width / 2; camera.right = width / 2;
    camera.top = height / 2; camera.bottom = -height / 2;
    camera.near = 1; camera.far = 10000; camera.updateProjectionMatrix();
    Object.assign(key.shadow.camera, { left: -width, right: width, top: height, bottom: -height, near: 1, far: 5000 });
    key.shadow.camera.updateProjectionMatrix();
    if (group) {
      shoeModel?.dispose();
      scene.remove(group);
      group.traverse(o => { o.geometry?.dispose(); });
    }
    group = new THREE.Group();
    group.position.z = (rear - height / 2) * Math.SQRT2;
    scene.add(group);
    // The table is supported by two pedestals on a carpeted floor. Floor
    // starts behind the legs, replacing the old photo's foreground table.
    const floorGeo = new THREE.PlaneGeometry(width * 4, height * 4);
    floorGeo.rotateX(-Math.PI / 2);
    const floor = mesh(floorGeo, carpet, -height * .27);
    floor.position.z = height * 2 - depth * .1; floor.castShadow = false;
    for (const side of [-1, 1]) {
      const x = side * rx * .72, z = depth * .48;
      const leg = mesh(new THREE.CylinderGeometry(height * .038, height * .049, height * .235, 40), legMaterial, -height * .1475);
      leg.position.x = x; leg.position.z = z;
      const foot = mesh(new THREE.CylinderGeometry(height * .063, height * .067, height * .018, 40), footMaterial, -height * .258);
      foot.position.x = x; foot.position.z = z;
      const collar = mesh(new THREE.CylinderGeometry(height * .046, height * .046, 4, 40), footMaterial, -height * .058);
      collar.position.x = x; collar.position.z = z;
    }
    const body = new THREE.ExtrudeGeometry(shape(rx, depth), { depth: height * .07, bevelEnabled: true, bevelSize: 4, bevelThickness: 4, bevelSegments: 3, steps: 1, curveSegments: 64 });
    body.rotateX(Math.PI / 2); mesh(body, wood, -3);
    const top = new THREE.ShapeGeometry(shape(rx - 8, depth - 8), 64);
    // Texture coordinates must be tied to the entire tabletop, not one tile.
    const pos = top.attributes.position, uv = top.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + rx) / (2 * rx), 1 - pos.getY(i) / depth);
    top.rotateX(Math.PI / 2); mesh(top, felt, 2);
    const points = [];
    for (let i = 0; i <= 120; i++) {
      const a = Math.PI * i / 120;
      points.push(new THREE.Vector3(rx * Math.cos(a), 0, depth * Math.sin(a)));
    }
    // The raised leather front and metal inlay are real cross-sections.
    const path = new THREE.CatmullRomCurve3(points);
    mesh(new THREE.TubeGeometry(path, 120, height * .017, 12, false), leather, 3);
    mesh(new THREE.TubeGeometry(path, 120, 1.4, 6, false), brass, -height * .022);
    // Back rail stops at the dealer's forearms, preserving native contact.
    for (const sign of [-1, 1]) {
      const g = new THREE.CylinderGeometry(6, 6, rx * .64, 12);
      g.rotateZ(Math.PI / 2);
      const m = mesh(g, leather, 3); m.position.x = sign * rx * .68;
    }
    addShoe();
    render();
  }
  function addShoe() {
    // A detailed existing product cutout suits this fixed broadcast camera
    // better than a low-poly replacement. Its contact shadow lives on the felt.
    const size = Math.max(80, Math.min(width * .12, height * .19));
    const shoeX = Math.min(rx * .70, width / 2 - size * .60);
    const shadowGeo = new THREE.PlaneGeometry(size * .72, size * .72); shadowGeo.rotateX(-Math.PI / 2);
    const shadow = mesh(shadowGeo, contact, 3); shadow.castShadow = false;
    shadow.position.x = shoeX; shadow.position.z = depth * .25;
    shoeModel=makeShoe(size,shoeState,render);
    shoeModel.root.position.set(shoeX,5,depth*.25);
    shoeModel.root.rotation.y=-.62;
    group.add(shoeModel.root);
  }
  function project(x, z) {
    const p = new THREE.Vector3(x * rx, 1, z * depth).applyMatrix4(group.matrixWorld).project(camera);
    return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 };
  }
  function render() { renderer.render(scene, camera); }
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault(); document.documentElement.classList.remove('table-3d');
  });
  canvas.addEventListener('webglcontextrestored', () => { resize(); document.documentElement.classList.add('table-3d'); });
  resize();
  const dealCard = createDealingCard({scene,camera,renderer});
  return { resize, project, render,
    dealCard(options) { return dealCard({...options,origin:shoeModel.outlet.getWorldPosition(new THREE.Vector3())}); },
    setShoe(state) { shoeState=state; shoeModel?.update(state); render(); },
    shoeOutlet() {
      const p=shoeModel.outlet.getWorldPosition(new THREE.Vector3()).project(camera);
      return {x:(p.x+1)*width/2,y:(1-p.y)*height/2};
    }
  };
}

function feltTexture(color) {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024;
  const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  // Deterministic fine weave, avoiding a photographic duplicate table.
  let seed = 4173;
  const grain = x.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < grain.data.length; i += 4) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const shade = ((seed >>> 0) % 9) - 4;
    for (let channel = 0; channel < 3; channel++) grain.data[i + channel] += shade;
  }
  x.putImageData(grain, 0, 0);
  x.textAlign = 'center';
  x.fillStyle = '#bcab76'; x.font = '500 30px Georgia';
  x.fillText('BLACKJACK PAYS 3 TO 2', 1024, 370);
  x.fillStyle = '#859887'; x.font = '23px Georgia';
  x.fillText('Dealer stands on all 17s', 1024, 415);
  x.strokeStyle = '#a6955d'; x.lineWidth = 2;
  x.beginPath(); x.ellipse(1024, 280, 550, 250, 0, .22, Math.PI - .22); x.stroke();
  x.fillStyle = '#b9a66c'; x.font = '500 27px Georgia';
  x.fillText('INSURANCE PAYS 2 TO 1', 1024, 485);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4; return t;
}


function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 10, 64, 64, 63);
  g.addColorStop(0, 'rgba(0,0,0,.7)'); g.addColorStop(.45, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
function carpetTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d'); x.fillStyle = '#26313a'; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = '#565448'; x.lineWidth = 1;
  for (let y = -64; y < 576; y += 64) for (let z = -64; z < 576; z += 64) {
    x.beginPath(); x.moveTo(z, y-24); x.quadraticCurveTo(z+13,y-10,z+24,y);
    x.quadraticCurveTo(z+10,y+13,z,y+24); x.quadraticCurveTo(z-13,y+10,z-24,y);
    x.quadraticCurveTo(z-10,y-13,z,y-24); x.stroke();
    x.fillStyle = '#72654b'; x.fillRect(z-1,y-1,2,2);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9,9); t.anisotropy = 4; return t;
}
