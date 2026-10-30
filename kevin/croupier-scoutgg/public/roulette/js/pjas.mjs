// Vinstpjäsen (dollyn) som riktig 3D: en svarvad mässingspjäs i klassisk form, som Huxleys runda mässingsmarkör och
// Cammeghs dolly i form av ett litet torn. Den har rund fot med graverade ringar, utsvängd kjol, smal midja, klockformad
// kropp, krage, hals och kulknopp. Den byggs som lathe-profil med PBR-guld (metalness 1, roughness 0,24) och speglar
// RoomEnvironment plus rummets egen bild. Den renderas EN gång vid start till en PNG med alfa (2× upplösning) i bordets
// betraktningsvinkel. Spelet visar sedan bilden, och kontaktskuggan läggs i CSS under foten.
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// profil [radie, höjd], höjden 1 = hela pjäsen; spåren är små inåtsteg (graverade ringar)
const PROFIL = [
  [0.001, 0], [0.40, 0], [0.425, 0.012], [0.432, 0.03], [0.426, 0.036], [0.418, 0.040], [0.426, 0.044], [0.43, 0.056],   // fotens kant, ett spår
  [0.42, 0.07], [0.39, 0.078], [0.35, 0.082], [0.345, 0.092], [0.352, 0.098], [0.345, 0.104],                              // avsats, ett spår
  [0.30, 0.118], [0.235, 0.145], [0.18, 0.185], [0.14, 0.235], [0.118, 0.29], [0.11, 0.33],                                 // utsvängd kjol till midjan
  [0.112, 0.35], [0.14, 0.355], [0.142, 0.368], [0.115, 0.375],                                                             // ring i midjan
  [0.12, 0.40], [0.15, 0.44], [0.178, 0.49], [0.19, 0.535], [0.185, 0.575], [0.165, 0.61], [0.135, 0.635],                  // klockformad kropp
  [0.125, 0.645], [0.19, 0.655], [0.205, 0.668], [0.205, 0.68], [0.19, 0.692], [0.11, 0.70],                                 // krage
  [0.085, 0.715], [0.07, 0.74], [0.066, 0.765],                                                                              // hals
];
const KNOPP = { y: 0.845, r: 0.092 };

export function renderaPjas(THREE, { rum = null, bredd = 300, hojd = 400, elev = 20 } = {}) {
  const c = document.createElement("canvas");
  const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(bredd, hojd, false); r.setClearColor(0x000000, 0);
  r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.05; r.outputColorSpace = THREE.SRGBColorSpace;
  const scen = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(r);
  // miljön: RoomEnvironment för mjuka studioljus, med rummets varma bild som en stor panel bakom kameran
  const miljo = new RoomEnvironment();
  if (rum) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshBasicMaterial({ map: rum, side: THREE.DoubleSide, color: new THREE.Color(1.4, 1.3, 1.2) }));
    pl.position.set(0, 2, 6.5); pl.lookAt(0, 2, 0); miljo.add(pl);
  }
  scen.environment = pm.fromScene(miljo, 0.02).texture;
  const guld = new THREE.MeshPhysicalMaterial({ color: new THREE.Color("#e9b860"), metalness: 1, roughness: 0.24, clearcoat: 0.35, clearcoatRoughness: 0.12, envMapIntensity: 1.15 });
  const kropp = new THREE.Mesh(new THREE.LatheGeometry(PROFIL.map(([x, y]) => new THREE.Vector2(x, y)), 160), guld);
  const knopp = new THREE.Mesh(new THREE.SphereGeometry(KNOPP.r, 96, 64), guld); knopp.position.y = KNOPP.y;
  const toppring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 24, 96), guld); toppring.rotation.x = Math.PI / 2; toppring.position.y = 0.765;
  const pjas = new THREE.Group(); pjas.add(kropp, knopp, toppring); scen.add(pjas);
  const nyckel = new THREE.DirectionalLight("#fff3dc", 2.2); nyckel.position.set(-2, 4, 3); scen.add(nyckel);
  const kant = new THREE.DirectionalLight("#ffe2b0", 1.4); kant.position.set(3, 2, -2.5); scen.add(kant);
  // kameran ser lätt ned, som bordet (filten lutar 48°, pjäsen står upprätt i skärmens plan)
  const kam = new THREE.PerspectiveCamera(22, bredd / hojd, 0.1, 50);
  const rad = (elev * Math.PI) / 180, d = 3.4, mal = new THREE.Vector3(0, 0.46, 0);
  kam.position.set(0, mal.y + d * Math.sin(rad), d * Math.cos(rad)); kam.lookAt(mal);
  r.render(scen, kam);
  const url = c.toDataURL("image/png");
  const fot = new THREE.Vector3(0, 0, 0).project(kam);                // fotens mitt i bilden (andel av höjden uppifrån)
  const fotY = (1 - fot.y) / 2;
  r.dispose(); pm.dispose(); kropp.geometry.dispose(); guld.dispose();
  return { url, fotY, forhallande: bredd / hojd };
}
