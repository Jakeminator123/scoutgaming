// The same small, closed image contract is checked at Web and Director.
// It contains no audio and must never be copied into player memory or logs.
const MAX_IMAGE_BYTES = 64 * 1024;
const MAX_TOTAL_BYTES = 128 * 1024;
const MAX_SIDE = 384;
const DATA_URL = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;

export class ObservationError extends Error {
  constructor(code) { super(code); this.code = code; this.statusCode = 400; }
}

function reject(code) { throw new ObservationError(code); }
function exact(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

// Read JPEG frame markers instead of trusting a claimed MIME or dimensions.
// The browser's canvas encoder writes a complete JPEG ending in EOI.
export function jpegSize(bytes) {
  if (bytes.length < 20 || bytes[0] !== 0xff || bytes[1] !== 0xd8
    || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) reject('invalid_observation_jpeg');
  let offset = 2, width, height, foundFrame = false, foundScan = false, quantized = false, huffman = false;
  while (offset < bytes.length - 2) {
    if (bytes[offset++] !== 0xff) reject('invalid_observation_jpeg');
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xd8 || marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) reject('invalid_observation_jpeg');
    if (offset + 2 > bytes.length - 2) reject('invalid_observation_jpeg');
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length - 2) reject('invalid_observation_jpeg');
    if (marker === 0xdb) {
      let table = offset + 2;
      while (table < offset + length) {
        const info = bytes[table++];
        if ((info >> 4) > 1 || (info & 15) > 3) reject('invalid_observation_jpeg');
        table += (info >> 4 ? 128 : 64);
      }
      if (table !== offset + length || length < 67) reject('invalid_observation_jpeg');
      quantized = true;
    }
    if (marker === 0xc4) {
      let table = offset + 2;
      while (table < offset + length) {
        const info = bytes[table++];
        if ((info >> 4) > 1 || (info & 15) > 3 || table + 16 > offset + length) reject('invalid_observation_jpeg');
        let symbols = 0;
        for (let i = 0; i < 16; i++) symbols += bytes[table++];
        if (!symbols || symbols > 256) reject('invalid_observation_jpeg');
        table += symbols;
      }
      if (table !== offset + length) reject('invalid_observation_jpeg');
      huffman = true;
    }
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      // Canvas captures are baseline JPEGs. Other coding modes are unnecessary.
      if (marker !== 0xc0 || foundFrame || length < 11 || bytes[offset + 2] !== 8
        || ![1, 3].includes(bytes[offset + 7]) || length !== 8 + 3 * bytes[offset + 7]) reject('invalid_observation_jpeg');
      height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      foundFrame = true;
    }
    if (marker === 0xda) {
      if (length !== 6 + 2 * bytes[offset + 2] || ![1, 3].includes(bytes[offset + 2])
        || !foundFrame || !quantized || !huffman || offset + length >= bytes.length - 2) reject('invalid_observation_jpeg');
      for (let scan = offset + length; scan < bytes.length - 2; scan++) {
        if (bytes[scan] !== 0xff) continue;
        const code = bytes[++scan];
        if (code !== 0 && !(code >= 0xd0 && code <= 0xd7)) reject('invalid_observation_jpeg');
      }
      foundScan = true; break;
    }
    offset += length;
  }
  if (!foundFrame || !foundScan || !width || !height || width > MAX_SIDE || height > MAX_SIDE) reject('invalid_observation_dimensions');
  return { width, height };
}

export function normalizeAstridObservation(value, requestId, dealerId = 'astrid', expectedProfileRevision = null) {
  if (dealerId !== 'astrid') reject('observation_astrid_only');
  if (!exact(value, ['version', 'turnId', 'consentTurnId', 'profileRevision', 'images'])
    || value.version !== 1 || !SAFE_ID.test(value.turnId)
    || value.turnId !== requestId || value.consentTurnId !== requestId
    || typeof value.profileRevision !== 'string' || !/^[a-f0-9]{64}$/.test(value.profileRevision)
    || (expectedProfileRevision !== null && value.profileRevision !== expectedProfileRevision)
    || !Array.isArray(value.images) || value.images.length < 1 || value.images.length > 2) reject('invalid_observation_consent');
  let total = 0;
  const images = value.images.map(url => {
    if (typeof url !== 'string') reject('invalid_observation_url');
    const match = DATA_URL.exec(url);
    if (!match || match[1].length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 4) reject('invalid_observation_url');
    const bytes = Buffer.from(match[1], 'base64');
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== match[1]) reject('invalid_observation_bytes');
    total += bytes.length;
    if (total > MAX_TOTAL_BYTES) reject('invalid_observation_bytes');
    jpegSize(bytes);
    return `data:image/jpeg;base64,${match[1]}`;
  });
  return { version: 1, turnId: requestId, consentTurnId: requestId, profileRevision: value.profileRevision, images };
}
