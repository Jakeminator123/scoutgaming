// Emil 28 Oct: Astrid 2.0's clips also come in three smaller formats beside the crf 16 originals (v2/, idle-v2/,
// repliker/ stay as they are: the server reads them, and they are the source the formats are made from):
//   <dir>-av1/   AV1  crf 38   ~7 % of the original
//   <dir>-hevc/  HEVC crf 26   ~11 %
//   <dir>-h264/  H.264 crf 23  ~35 %, plays everywhere
// Same 1080x1920 frames, same file names, same frame counts, so card tracks, lip-sync maps and take names are unchanged.
// The page picks one format per visit, the best its device decodes in hardware (MediaCapabilities powerEfficient; a
// software AV1 decoder at Turbo's 60 frames a second would heat a phone), and every clip URL is rewritten only where it is
// fetched or played: the rest of the game keeps the original URLs. Made with metodik publicera-format.sh,
// MEDIAOPTIMERING.md. ?format=av1|hevc|h264|orig picks one by hand (QA).
const DIRS = /^((?:https?:\/\/[^/]+)?\/media\/dealers\/(?:astrid2)\/)(v2|idle-v2|repliker)\//;
const PROBES = [
  ['av1', 'video/mp4; codecs="av01.0.08M.08"'],
  ['hevc', 'video/mp4; codecs="hvc1.1.6.L120.90"'],
];
const KEY = 'clipFormat';
let format = 'h264';

async function probe() {
  try {
    const asked = new URLSearchParams(location.search).get('format');
    if (['av1', 'hevc', 'h264', 'orig'].includes(asked)) return asked;
    const kept = sessionStorage.getItem(KEY);
    if (kept) return kept;
  } catch {}
  const mc = globalThis.navigator?.mediaCapabilities;
  if (!mc?.decodingInfo) return 'h264';
  for (const [name, contentType] of PROBES) {
    try {
      const r = await mc.decodingInfo({ type: 'file', video: { contentType, width: 1080, height: 1920, bitrate: 2_000_000, framerate: 60 } });
      if (r.supported && r.powerEfficient) return name;
    } catch {}
  }
  return 'h264';
}

/** Resolves once the visit's format is known (at most 400 ms; H.264 if the browser does not answer in time). */
export const clipFormatReady = Promise.race([probe(), new Promise(ok => setTimeout(() => ok('h264'), 400))]).then(f => {
  format = f;
  try { sessionStorage.setItem(KEY, f); } catch {}
  return f;
});

export const clipFormat = () => format;

/** The URL to fetch or play for a clip: its file in the visit's format folder (other dealers' clips unchanged). */
export const formatUrl = (u, f = format) => (typeof u === 'string' && f !== 'orig' ? u.replace(DIRS, `$1$2-${f}/`) : u);

/** A clip in this format failed to decode: the rest of the visit (and a reload) plays H.264. */
export function clipFormatFailed() {
  if (format === 'h264' || format === 'orig') return false;
  format = 'h264';
  try { sessionStorage.setItem(KEY, 'h264'); } catch {}
  return true;
}
