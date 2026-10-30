// 3D-hjulet: kör hjulfilens modul (roulette-hjul-v2.html, spel=1) i spelets egen sida, så att hjulet har en enda källa.
// Modulen läser sina parametrar ur window.__hjulQ och lämnar scenen i window.__hjul. Kameran räknas som i hjulfilen.
import { HJULPARAM } from "./konfig.mjs";

const absolut = (rel) => new URL(rel, location.href).href;
let ENV = { S1: 0.5, hjul: 0.45 };

// bord: js/bord.mjs (hjulets fil och stil, rummets bilder och miljöljus)
export async function laddaHjul(bord) {
  const { wheel, room } = bord, RUM_S1 = room.s1, RUM_HJUL = room.hjul;
  ENV = room.env ?? ENV;
  const html = await (await fetch(wheel.fil)).text();
  const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!m) throw Error("hittar inte hjulfilens modul");
  window.__hjulQ = new URLSearchParams({ ...HJULPARAM, ...wheel.param, miljo: absolut(RUM_S1) }).toString();
  const url = URL.createObjectURL(new Blob([m[1]], { type: "text/javascript" }));
  await import(url);
  URL.revokeObjectURL(url);
  const H = window.__hjul;
  const { THREE } = H;
  const ladda = (u) => new Promise((ok, fel) => new THREE.TextureLoader().load(absolut(u), (t) => { t.colorSpace = THREE.SRGBColorSpace; ok(t); }, undefined, fel));
  [H.rumS1, H.rumHjul] = await Promise.all([ladda(RUM_S1), ladda(RUM_HJUL)]);
  H.scene.background = H.rumS1;
  if (!H.boll.parent) H.hjul.add(H.boll);
  H.renderer.domElement.remove();
  return H;
}

// kamera som i hjulfilen: elev/dist/az runt målpunkten, bildcentrum förskjutet till (cx, cy) i 1920×1080
export function stallKamera(H, k) {
  const { cam, polar, rad } = H;
  const mal = k.mal ?? H._noll ?? (H._noll = new H.THREE.Vector3());
  cam.fov = k.fov;
  const [x, z] = polar(k.dist * Math.cos(rad(k.elev)), k.az);
  cam.position.set(x + mal.x, k.dist * Math.sin(rad(k.elev)) + mal.y, z + mal.z);
  cam.lookAt(mal);
  cam.setViewOffset(1920, 1080, 960 - k.cx, 540 - k.cy, 1920, 1080);
  cam.updateProjectionMatrix();
}

// bildens miljö: rummet bakom och ljusets styrka
export function stallRum(H, vy) {
  H.scene.background = vy === "S1" ? H.rumS1 : H.rumHjul;
  H.scene.environmentIntensity = vy === "S1" ? ENV.S1 : ENV.hjul;
}

export const blanda = (a, b, u) => {
  const ut = {};
  for (const k of ["elev", "dist", "fov", "cx", "cy", "az"]) ut[k] = a[k] + (b[k] - a[k]) * u;
  return ut;
};
