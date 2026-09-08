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
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera();
  camera.position.set(0, 2000, 2000);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xfff3df, 0x171b20, 2));
  const key = new THREE.DirectionalLight(0xffe6bd, 3.2);
  key.position.set(-500, 800, -300); scene.add(key);
  const fill = new THREE.DirectionalLight(0xc0d4ef, 1.5);
  fill.position.set(600, 300, 500); scene.add(fill);
  const palette = { vera: '#144c35', astrid: '#263336', amira: '#665139', mei: '#12484e' };
  const texture = feltTexture(palette[dealer] ?? palette.vera);
  const felt = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  const leather = new THREE.MeshPhysicalMaterial({ color: '#191a18', roughness: .32, metalness: .12, clearcoat: .25 });
  const wood = new THREE.MeshStandardMaterial({ color: '#21150f', roughness: .38, metalness: .12 });
  const brass = new THREE.MeshStandardMaterial({ color: '#b99b57', roughness: .3, metalness: .75 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#e1e6df', transparent: true, opacity: .27, roughness: .08, metalness: .1, depthWrite: false, side: THREE.DoubleSide });
  const paper = new THREE.MeshStandardMaterial({ color: '#e7e4d8', roughness: .6 });
  const divider = new THREE.MeshStandardMaterial({ color: '#7e2926', roughness: .65 });
  let group, width, height, rx, depth, rear;
  function mesh(geometry, material, y = 0) {
    const m = new THREE.Mesh(geometry, material); m.position.y = y; group.add(m); return m;
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
    depth = height * (portrait ? .34 : .435) * Math.SQRT2;
    renderer.setSize(width, height, false);
    camera.left = -width / 2; camera.right = width / 2;
    camera.top = height / 2; camera.bottom = -height / 2;
    camera.near = 1; camera.far = 10000; camera.updateProjectionMatrix();
    if (group) {
      scene.remove(group);
      group.traverse(o => { o.geometry?.dispose(); });
    }
    group = new THREE.Group();
    group.position.z = (rear - height / 2) * Math.SQRT2;
    scene.add(group);
    const body = new THREE.ExtrudeGeometry(shape(rx, depth), { depth: height * .045, bevelEnabled: true, bevelSize: 4, bevelThickness: 4, bevelSegments: 3, steps: 1, curveSegments: 64 });
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
    const shoe = new THREE.Group();
    shoe.position.set(rx * .72, 12, depth * .16);
    shoe.rotation.y = -.25;
    const unit = Math.min(width / 1470, height / 750);
    shoe.scale.setScalar(Math.max(.6, unit));
    const side = new THREE.BoxGeometry(3, 48, 90);
    for (const x of [-27, 27]) { const m = new THREE.Mesh(side, glass); m.position.set(x, 22, 0); shoe.add(m); }
    const stack = new THREE.Mesh(new THREE.BoxGeometry(46, 26, 65), paper);
    stack.rotation.x = -.32; stack.position.y = 14; shoe.add(stack);
    const cut = new THREE.Mesh(new THREE.BoxGeometry(45, 1, 65), divider);
    cut.rotation.x = -.32; cut.position.set(0, 28, -5); shoe.add(cut);
    group.add(shoe);
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
  return { resize, project, render };
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
