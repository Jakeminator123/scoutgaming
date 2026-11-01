// Klippformatet för besöket (Emil 1 nov, som blackjackens public/clip-format.js, samma val och samma sessionsnyckel):
// kastklippen finns i tre mindre format bredvid originalen i kast/ (låsta gröna, crf 14):
//   kast-av1/   AV1  crf 38    ~100 kB per klipp
//   kast-hevc/  HEVC crf 26    ~175 kB
//   kast-h264/  H.264 crf 23   ~250 kB, spelas överallt
// Samma rutor (1920×1088, 90 st) och filnamn, så kastets json gäller alla format. Sidan väljer det bästa format enheten
// avkodar i hårdvara (MediaCapabilities powerEfficient), annars H.264. ?format=av1|hevc|h264|orig väljer för hand (QA).
const PROBES = [
  ["av1", 'video/mp4; codecs="av01.0.08M.08"'],
  ["hevc", 'video/mp4; codecs="hvc1.1.6.L120.90"'],
];
const KEY = "clipFormat";

async function probe() {
  try {
    const asked = new URLSearchParams(location.search).get("format");
    if (["av1", "hevc", "h264", "orig"].includes(asked)) return asked;
    const kept = sessionStorage.getItem(KEY);
    if (kept) return kept;
  } catch {}
  const mc = globalThis.navigator?.mediaCapabilities;
  if (!mc?.decodingInfo) return "h264";
  for (const [name, contentType] of PROBES) {
    try {
      const r = await mc.decodingInfo({ type: "file", video: { contentType, width: 1920, height: 1088, bitrate: 1_000_000, framerate: 24 } });
      if (r.supported && r.powerEfficient) return name;
    } catch {}
  }
  return "h264";
}

/** Besökets format (högst 400 ms; H.264 om webbläsaren inte svarar i tid). */
export const formatKlart = Promise.race([probe(), new Promise((ok) => setTimeout(() => ok("h264"), 400))]).then((f) => {
  try { sessionStorage.setItem(KEY, f); } catch {}
  return f;
});

/** Adressen till ett kastklipp i formatet f: .../kast/x.mp4 -> .../kast-<f>/x.mp4 (orig = originalet). */
export const formatAdress = (url, f) => (f === "orig" ? url : url.replace(/\/kast\/([^/]+\.mp4)$/, `/kast-${f}/$1`));

/** Ett format gick inte att avkoda: resten av besöket (och omladdningar) kör H.264. */
export function formatFel() { try { sessionStorage.setItem(KEY, "h264"); } catch {} }
