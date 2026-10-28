// Bilder till valen och spelbordskorten ur paketets frysta media: samma läsning
// som förhandsvisningen (GET /api/operators/<bolag>/rooms/<spelbord>/preview), ingen
// ny väg. Bara funktioner, inga hooks: komponenterna äger sitt eget tillstånd.
import { validatePublicOperatorPreview } from '../../../packages/presentation/contracts/operator-preview-contract.mjs';

const cache = new Map();
const LIMIT = 48;

export function previewRequestKey({ operatorSlug, roomId, dealerId, packageRevision }) {
  return [operatorSlug, roomId, dealerId, packageRevision].join(':');
}

// En svarskopia per (bolag, spelbord, dealer, version). Fel ger null: korten visar då
// en platta med initialer, aldrig ett felmeddelande. Utanför webbläsaren läses inget.
export function loadPreviewMedia({ operatorSlug, roomId, dealerId, packageRevision }) {
  if (typeof window === 'undefined' || typeof fetch !== 'function' || !operatorSlug || !roomId || !dealerId || !Number.isSafeInteger(packageRevision)) return Promise.resolve(null);
  const key = previewRequestKey({ operatorSlug, roomId, dealerId, packageRevision });
  if (!cache.has(key)) {
    if (cache.size >= LIMIT) cache.delete(cache.keys().next().value);
    const url = `/api/operators/${encodeURIComponent(operatorSlug)}/rooms/${encodeURIComponent(roomId)}/preview?dealer=${encodeURIComponent(dealerId)}&revision=${packageRevision}`;
    cache.set(key, fetch(url, { credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then(response => response.ok ? response.json() : null)
      .then(raw => raw ? validatePublicOperatorPreview(raw, { operatorSlug, roomId, packageRevision, dealerId }) : null)
      .catch(() => null));
  }
  return cache.get(key);
}

// Valets bild: dealerns vila (videons första bildruta) eller materialets fil.
export function previewChoiceMedia(payload, kind, id) {
  if (!payload) return null;
  if (kind === 'dealer') return payload.media.dealer ? { src: payload.media.dealer.src, contentType: payload.media.dealer.contentType } : null;
  const row = (kind === 'table' ? payload.media.tables : payload.media.backgrounds).find(item => item.id === id);
  return row ? { src: row.src, contentType: row.contentType } : null;
}

// Initialer till plattan när en bild saknas: "Green felt" → "GF", "PAOW" → "PA".
export function choiceInitials(label) {
  const words = String(label ?? '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase();
}

// Etiketter utan tekniska suffix: "PAOW · paow-20261027" → "PAOW", "paow-20261027" → "Paow".
export function displayLabel(label) {
  const text = String(label ?? '').trim();
  const stripped = text.replace(/\s*[·(|–-]\s*[a-z0-9]+(?:[-_][a-z0-9]+)*[-_]\d{6,}\)?$/i, '').trim();
  if (stripped && stripped !== text) return stripped;
  const slug = /^([a-z][a-z0-9]*)(?:[-_][a-z0-9]+)*[-_]\d{6,}$/i.exec(text);
  return slug ? slug[1].charAt(0).toUpperCase() + slug[1].slice(1) : text;
}
