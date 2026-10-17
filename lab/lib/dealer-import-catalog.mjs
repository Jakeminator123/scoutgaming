// Advisory import contract. All destinations come from the saved project; a
// filename or model response cannot create dealers, events, bindings or media.
import { dealerMediaSlots } from './dealer-media-library.mjs';
import { kindForEvent, MAX_VIDEO_BYTES, validateVideoMetadata } from '../../packages/presentation/contracts/video-intake.mjs';
import { registeredDealerIds } from '../../packages/presentation/contracts/dealer-identity.mjs';
import { DEFAULT_DEALER_COMPOSITING } from '../../packages/presentation/contracts/dealer-compositing.mjs';
import { StudioStorageError } from '../../web/storage/studio-contract.mjs';

export const DEALER_IMPORT_LIMITS = Object.freeze({ maxFiles: 30, maxFileBytes: MAX_VIDEO_BYTES, maxContext: 4000, maxMessage: 2000,
  maxHistoryMessages: 8, maxHistoryMessage: 3000, maxHistoryChars: 12000, vision: false });
export const DEALER_IMPORT_STORAGE_WARNING = 'Endast MP4 och WebM kan sparas i klippbanken just nu. Bilder och ljud kan få rådgivande fack eller vara lokala referenser, men måste tas bort ur importlistan innan videor sparas, även om raden har ett tidigare fel.';
const TYPES = new Set(['video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav', 'image/png', 'image/jpeg', 'image/webp']);
const exact = (value, required, optional = []) => value && typeof value === 'object' && !Array.isArray(value)
  && required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => [...required, ...optional].includes(key));
const clean = (value, max) => typeof value === 'string' && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
const fail = () => { throw new StudioStorageError('studio_invalid_request', 400); };
const normalizedName = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function dealerImportCatalog(project) {
  const active = registeredDealerIds(project);
  const dealers = project.dealers.filter(row => active.has(row.id)).map(row => ({ id: row.id, label: row.label || row.id }));
  const slots = supportedDealerImportSlots(project, dealerMediaSlots(project));
  slots.push(...['vila', 'redo'].map(pose => ({ id: `pose/${pose}`, label: `${pose.toUpperCase()} · referensbild`, category: 'pose', kind: 'pose', pose, start: pose.toUpperCase(), end: pose.toUpperCase() })));
  return { dealers, slots, limits: DEALER_IMPORT_LIMITS };
}

export function supportedDealerImportSlots(project, candidates) {
  return candidates.flatMap(slot => {
    const event = project.events.find(row => row.id === slot.eventId);
    // Shared media catalogues may include game-specific entries not supported by
    // this blackjack importer. Do not expose them or dereference a missing event.
    if (!event || slot.eventId.startsWith('roulette.')) return [];
    const kind = kindForEvent(event);
    if (!kind) return [];
    const transition = slot.eventId === 'transition.shoe';
    const atShoe = slot.eventId.startsWith('deal.') || slot.eventId.startsWith('reveal.');
    return [{ ...slot, kind, start: transition ? (slot.situation === 'to-shoe' ? 'VILA' : 'REDO') : atShoe ? 'REDO' : 'VILA',
      end: transition ? (slot.situation === 'to-shoe' ? 'REDO' : 'VILA') : atShoe ? 'REDO' : 'VILA' }];
  });
}

export function validateDealerImportInput(body, catalog) {
  if (!exact(body, ['files', 'context'], ['dealerId', 'message', 'intent', 'history'])
    || !clean(body.context, DEALER_IMPORT_LIMITS.maxContext) || !clean(body.message ?? '', DEALER_IMPORT_LIMITS.maxMessage)
    || !Array.isArray(body.files) || body.files.length > DEALER_IMPORT_LIMITS.maxFiles) fail();
  const intent = Object.hasOwn(body, 'intent') ? body.intent : 'mapping';
  const message = (body.message ?? '').trim();
  if (!['mapping', 'chat'].includes(intent) || intent === 'chat' && !message) fail();
  const dealerId = body.dealerId ?? null;
  if ((intent === 'mapping' || dealerId !== null) && !catalog.dealers.some(row => row.id === dealerId)) fail();
  const history = Object.hasOwn(body, 'history') ? body.history : [];
  if (!Array.isArray(history) || history.length > DEALER_IMPORT_LIMITS.maxHistoryMessages || history.length % 2 !== 0) fail();
  let historyChars = 0;
  const conversation = history.map((entry, index) => {
    if (!exact(entry, ['role', 'content']) || entry.role !== (index % 2 === 0 ? 'user' : 'assistant')
      || !clean(entry.content, DEALER_IMPORT_LIMITS.maxHistoryMessage) || !entry.content.trim()) fail();
    historyChars += entry.content.length;
    if (historyChars > DEALER_IMPORT_LIMITS.maxHistoryChars) fail();
    return { role: entry.role, content: entry.content.trim() };
  });
  const ids = new Set();
  const files = body.files.map(file => {
    if (!exact(file, ['id', 'name', 'size', 'type']) || !/^[A-Za-z0-9_-]{1,80}$/.test(file.id)
      || ids.has(file.id) || !clean(file.name, 240) || !file.name.trim() || /[\\/\u0000-\u001f]/.test(file.name)
      || !Number.isSafeInteger(file.size) || file.size < 16 || file.size > MAX_VIDEO_BYTES || !TYPES.has(file.type)) fail();
    ids.add(file.id);
    return { id: file.id, name: file.name, size: file.size, type: file.type };
  });
  return { dealerId, files, context: body.context.trim(), message, intent, history: conversation };
}

// A small projection of the current scoped catalogue, not the saved project.
// Chat never receives media URLs, operator accounts, room config or secrets.
export function dealerImportChatContext(catalog, selectedDealerId) {
  let shortened = false;
  const text = (value, max) => {
    if (typeof value !== 'string') return '';
    if (value.length > max) shortened = true;
    return value.slice(0, max);
  };
  const selected = catalog.dealers.find(row => row.id === selectedDealerId);
  const ordered = selected ? [selected, ...catalog.dealers.filter(row => row.id !== selectedDealerId)] : catalog.dealers;
  const dealers = ordered.slice(0, 32).map(({ id, label }) => ({ id: text(id, 120), label: text(label, 120) }));
  const slots = catalog.slots.slice(0, 64).map(({ id, label, kind, start, end }) => ({ id: text(id, 120), label: text(label, 120),
    kind: text(kind, 16), start: text(start, 8), end: text(end, 8) }));
  return { dealers, slots, dealerCount: catalog.dealers.length, slotCount: catalog.slots.length,
    truncated: shortened || dealers.length < catalog.dealers.length || slots.length < catalog.slots.length };
}

function filenameHints(file) {
  const name = file.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\.[^.]+$/, '').replace(/[\s_.]+/g, '-');
  const token = word => new RegExp(`(?:^|-)(?:${word})(?:-|$)`).test(name);
  const hints = new Set();
  if (file.type.startsWith('image/')) {
    if (token('vila|keystone|rest')) hints.add('pose/vila');
    if (token('redo|ready')) hints.add('pose/redo');
    return hints;
  }
  if (token('to-shoe|till-skon')) hints.add('transition.shoe/to-shoe');
  if (token('from-shoe|fran-skon')) hints.add('transition.shoe/from-shoe');
  const positions = [...name.matchAll(/(?:^|-)(?:pos(?:ition)?|plats|seat)-?([1-7])(?:[a-z]|-?alt\d*)?(?=-|$)/g)];
  const boxes = [...name.matchAll(/(?:^|-)box-?([0-6])(?=-|$)/g)];
  for (const box of [...positions.map(match => Number(match[1]) - 1), ...boxes.map(match => Number(match[1]))]) {
    hints.add(`deal.player.${box < 2 ? 'left' : box < 5 ? 'centre' : 'right'}/box${box}`);
  }
  if (token('dealer-up|dealerup|oppet-dealerkort')) hints.add('deal.dealer/dealer-up');
  const reveal = token('reveal|flip|vand');
  if (reveal) hints.add('reveal.dealer/dealer-hole');
  if (token('dealer-hole|dealerhole|hole-card|holecard') && !reveal) hints.add('deal.dealer/dealer-hole');
  if (token('idle|grundloop')) hints.add('idle.ready/');
  for (const line of ['goodluck', 'insurance', 'double', 'placebets', 'dealerblackjack', 'blackjack', 'dealerbust', 'win', 'push', 'lose', 'greeting', 'peek', 'bust', 'sidebet', 'chatter1', 'chatter2', 'farewell']) {
    if (token(line)) hints.add(`${['goodluck', 'insurance', 'double'].includes(line) ? `speak.${line}` : 'speak.other'}/${line}`);
  }
  return hints;
}

export function filenameDealerImportRows(input, catalog) {
  return input.files.map(file => {
    const hints = [...filenameHints(file)].filter(id => catalog.slots.some(slot => slot.id === id));
    const slotId = hints.length === 1 ? hints[0] : null;
    return { fileId: file.id, slotId, confidence: slotId ? 'medium' : 'low', reason: slotId
      ? 'Filnamnet matchar ett exakt fack. Innehåll och ändposer är inte verifierade.'
      : hints.length > 1 ? 'Filnamnet anger flera möjliga fack. Välj rätt fack själv.' : 'Filnamnet räcker inte för en säker placering. Välj ett fack eller förtydliga kontexten.' };
  });
}

export function validateDealerImportAdvice(value, input, catalog) {
  // Chat has no mapping field even in the provider schema. Extra rows are a
  // rejected reply, never proposals waiting for a caller to accidentally apply.
  if (input.intent === 'chat') {
    if (!exact(value, ['assistantMessage']) || !clean(value.assistantMessage, 3000) || !value.assistantMessage.trim()) throw Error('invalid_import_advice');
    return { assistantMessage: value.assistantMessage, rows: [] };
  }
  if (!exact(value, ['assistantMessage', 'rows']) || !clean(value.assistantMessage, 3000) || !value.assistantMessage.trim()
    || !Array.isArray(value.rows) || value.rows.length !== input.files.length) throw Error('invalid_import_advice');
  const seen = new Set();
  const rows = value.rows.map(row => {
    if (!exact(row, ['fileId', 'slotId', 'confidence', 'reason']) || !input.files.some(file => file.id === row.fileId) || seen.has(row.fileId)
      || row.slotId !== null && !catalog.slots.some(slot => slot.id === row.slotId)
      || !['low', 'medium', 'high'].includes(row.confidence) || !clean(row.reason, 600)) throw Error('invalid_import_advice');
    seen.add(row.fileId); return { ...row };
  });
  return { assistantMessage: value.assistantMessage, rows };
}

export function finishDealerImportRows(rows, input, catalog) {
  const counts = new Map();
  for (const row of rows) if (row.slotId) counts.set(row.slotId, (counts.get(row.slotId) ?? 0) + 1);
  return input.files.map(file => {
    const row = rows.find(item => item.fileId === file.id);
    const slot = catalog.slots.find(item => item.id === row.slotId);
    let classification = null;
    // Advice is not storage support. Keep this server-owned warning even when
    // the model omits it, the slot is unknown, or another guard rejects the row.
    const warnings = ['video/mp4', 'video/webm'].includes(file.type) ? [] : [DEALER_IMPORT_STORAGE_WARNING];
    const name = `-${normalizedName(file.name)}-`;
    const namedOtherDealer = catalog.dealers.find(dealer => dealer.id !== input.dealerId
      && [dealer.id, dealer.label].some(label => name.includes(`-${normalizedName(label)}-`)));
    if (namedOtherDealer) return { ...row, slotId: null, confidence: 'low', classification,
      warnings: [...warnings, `Filnamnet nämner ${namedOtherDealer.label}, men du har valt en annan dealer. Kontrollera identiteten innan du väljer fack.`] };
    const image = file.type.startsWith('image/'), audio = file.type.startsWith('audio/');
    if (slot && (image !== (slot.kind === 'pose') || audio && slot.kind !== 'speech')) {
      return { ...row, slotId: null, confidence: 'low', classification, warnings: [...warnings, 'Filtypen passar inte det föreslagna facket. Välj ett kompatibelt fack.'] };
    }
    if (slot?.kind === 'pose') warnings.push('Referensbilden sparas inte i klippbanken. Hantera VILA/REDO separat i Skapa material; ett posebyte kräver ny granskning.');
    else if (slot) {
      classification = validateVideoMetadata({ dealerId: input.dealerId, eventId: slot.eventId, situation: slot.situation,
        kind: slot.kind, role: 'alternative', playback: 'once', label: file.name.slice(0, 120), notes: 'Importförslag · innehållet är inte visuellt godkänt.',
        ...(audio ? { mediaType: 'audio' } : { compositing: { ...DEFAULT_DEALER_COMPOSITING } }) }, { forWrite: true });
      if (slot.kind === 'speech') warnings.push('Kontrollera exakt manus, ljud, läppsynk och cue-data. Replik-ID eller filnamn bevisar inte att talet stämmer.');
      if (!audio) warnings.push('Kontrollera grön bakgrund och mobilformat. Frilagda alfaklipp kan förhandsvisas men är spärrade för import tills assistentens kontroll och granskning är färdig. Ingen beskärning eller formatkonvertering utförs.');
    }
    if ((counts.get(row.slotId) ?? 0) > 1) warnings.push('Flera filer föreslås till samma fack. Granska varje alternativ; förslaget ersätter ingen standard.');
    return { ...row, classification, warnings };
  });
}
