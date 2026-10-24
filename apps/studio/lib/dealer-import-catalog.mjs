// Advisory import contract. All destinations come from the saved project; a
// filename or model response cannot create dealers, events, bindings or media.
import { dealerMediaSlots } from './dealer-media-library.mjs';
import { kindForEvent, MAX_VIDEO_BYTES, validateVideoMetadata } from '../../../packages/presentation/contracts/video-intake.mjs';
import { registeredDealerIds } from '../../../packages/presentation/contracts/dealer-identity.mjs';
import { DEFAULT_DEALER_COMPOSITING } from '../../../packages/presentation/contracts/dealer-compositing.mjs';
import { StudioStorageError } from '../../../packages/studio-registry/server/document-contract.mjs';
import { parseClipFilename, clipNamingGuide, CLIP_POSE_VARIANTS } from '../../../packages/presentation/contracts/clip-naming.mjs';
import { speechSlotStandard } from '../../../packages/presentation/contracts/speech-slot-bindings.mjs';
import { frozenImportFileMatch, frozenImportProposal, frozenImportWarnings, frozenImportSourceForDealer } from './dealer-import-sources.mjs';

export const DEALER_IMPORT_LIMITS = Object.freeze({ maxFiles: 30, maxFileBytes: MAX_VIDEO_BYTES, maxContext: 4000, maxMessage: 2000,
  maxHistoryMessages: 8, maxHistoryMessage: 3000, maxHistoryChars: 12000, maxPath: 240, maxAlternatives: 2, vision: false });
// The clip map's five Blackjack groups. Reference stills are a sixth, local-only group.
export const DEALER_IMPORT_GROUPS = Object.freeze([
  Object.freeze({ id: 'wait', title: 'Vila', subtitle: 'Basloop och tysta beteendeklipp' }),
  Object.freeze({ id: 'ready', title: 'Redo', subtitle: 'Till och från skon' }),
  Object.freeze({ id: 'players', title: 'Dela till spelare', subtitle: 'Plats 1–7' }),
  Object.freeze({ id: 'dealer', title: 'Dealerns kort', subtitle: 'Öppet · dolt · vända' }),
  Object.freeze({ id: 'speech', title: 'Talade repliker', subtitle: 'Situation och språk' }),
  Object.freeze({ id: 'pose', title: 'Referensbilder', subtitle: 'VILA och REDO · sparas inte' }),
]);
const SPEECH_CAPTIONS = { greeting: 'Välkommen', placebets: 'Lägg insatser', goodluck: 'Lycka till', insurance: 'Försäkring', double: 'Dubbling', peek: 'Kontrollera kort',
  blackjack: 'Blackjack', dealerblackjack: 'Dealerns blackjack', bust: 'Spelaren över 21', dealerbust: 'Dealern över 21', win: 'Vinst', push: 'Lika', lose: 'Förlust',
  sidebet: 'Sidospel', chatter1: 'Småprat 1', chatter2: 'Småprat 2', farewell: 'Tack för spelet' };
const SPEECH_EXPLANATIONS = { goodluck: 'Startfras när insatserna är klara.', insurance: 'Tal när försäkring erbjuds.', double: 'Bekräftelse på spelarens dubbling.',
  greeting: 'Välkomsthälsning vid bordet.', placebets: 'Uppmaning att lägga nästa insats.', peek: 'Tal medan dealern kontrollerar korten.', blackjack: 'Tal vid spelarens blackjack.',
  dealerblackjack: 'Tal vid dealerns blackjack.', bust: 'Tal när spelaren går över 21.', dealerbust: 'Tal när dealern går över 21.', win: 'Tal vid vinst.', push: 'Tal vid oavgjort.',
  lose: 'Tal vid förlust.', sidebet: 'Tal om ett sidospel.', chatter1: 'Småprat vid bordet.', chatter2: 'Småprat vid bordet.', farewell: 'Avslutande hälsning.' };
// Plain-language placement for people who do not know the event model. Same
// words as the clip map, so a proposal reads like the card it lands on.
export function slotPresentation(slot) {
  const { eventId = '', situation = '', kind } = slot;
  if (kind === 'pose') return { group: 'pose', caption: `${situation || slot.pose || ''}`.toUpperCase() + ' · referensbild', explanation: 'Stillbild av dealerns pose. Sparas inte i klippbanken.' };
  if (eventId === 'idle.ready') return { group: 'wait', caption: 'Basloop och beteendeklipp', explanation: 'Dealern väntar mellan spelhändelserna: andning, blickar, nickningar och andra tysta rörelser som återgår till vila.' };
  if (eventId === 'transition.shoe') return { group: 'ready', caption: situation === 'to-shoe' ? 'Till skon' : 'Från skon',
    explanation: situation === 'to-shoe' ? 'Dealern gör sig redo före första kortet (VILA → REDO).' : 'Dealern återgår till vila efter sista kortet (REDO → VILA).' };
  if (eventId.startsWith('deal.player.') && /^box[0-6]$/.test(situation)) {
    const seat = Number(situation.slice(3)) + 1;
    return { group: 'players', caption: `Plats ${seat}`, explanation: `När ett kort delas till spelarplats ${seat}.` };
  }
  if (eventId === 'deal.dealer') return { group: 'dealer', caption: situation === 'dealer-hole' ? 'Lägg dolt kort' : 'Dra öppet kort',
    explanation: situation === 'dealer-hole' ? 'När dealerns dolda kort delas.' : 'När dealern får ett öppet kort, även tredje och senare kort.' };
  if (eventId === 'reveal.dealer') return { group: 'dealer', caption: 'Vänd dolt kort', explanation: 'När dealerns dolda kort vänds upp.' };
  if (kind === 'speech') return { group: 'speech', caption: SPEECH_CAPTIONS[situation] ?? slot.label ?? situation, explanation: SPEECH_EXPLANATIONS[situation] ?? 'Tal vid den valda spelsituationen.' };
  return { group: null, caption: slot.label ?? eventId, explanation: '' };
}
// The saved standard clip per dealer and slot. A proposal into an empty slot is
// offered as the standard; everything else is a variant. This reads the draft
// only; it never binds anything.
export function dealerSlotStandard(project, dealerId, slot) {
  if (slot.kind === 'pose') return null;
  const line = project.lines?.find(row => row.dealerId === dealerId && row.eventId === slot.eventId);
  if (!line) return null;
  if (slot.eventId === 'idle.ready') {
    const policy = project.dealerIdlePolicies?.find(row => row.dealerId === dealerId)?.policy;
    return policy?.base?.[0]?.videoId ?? line.variants.find(row => row.id === line.baselineVariantId)?.videoGenerationId ?? null;
  }
  if (slot.kind === 'speech') { try { return speechSlotStandard(project, dealerId, slot.eventId, slot.situation)?.videoGenerationId ?? null; } catch { return null; } }
  return line.variants.find(row => row.id === `${dealerId}.${slot.eventId}.slot.${slot.situation}`)?.videoGenerationId ?? null;
}
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
  for (const slot of slots) Object.assign(slot, slotPresentation(slot));
  // Standards are read per registered dealer so a proposal can say whether it
  // fills an empty slot or adds a variant. Values are saved clip ids or null.
  const standards = Object.fromEntries(dealers.map(dealer => [dealer.id, Object.fromEntries(slots.filter(slot => slot.kind !== 'pose').map(slot => [slot.id, dealerSlotStandard(project, dealer.id, slot)]))]));
  // The naming guide only lists slots that exist in this saved project.
  const naming = clipNamingGuide().filter(row => slots.some(slot => slot.id === row.slotId));
  return { dealers, slots, groups: DEALER_IMPORT_GROUPS.map(row => ({ ...row })), standards, limits: DEALER_IMPORT_LIMITS, naming, poseVariants: Object.entries(CLIP_POSE_VARIANTS).map(([id, row]) => ({ id, ...row })) };
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
    if (!exact(file, ['id', 'name', 'size', 'type'], ['path']) || !/^[A-Za-z0-9_-]{1,80}$/.test(file.id)
      || ids.has(file.id) || !clean(file.name, 240) || !file.name.trim() || /[\\/\u0000-\u001f]/.test(file.name)
      || !Number.isSafeInteger(file.size) || file.size < 16 || file.size > MAX_VIDEO_BYTES || !TYPES.has(file.type)) fail();
    // A dropped folder keeps its relative path as advice (repliker/sv/…). It is a
    // display and hint string, never a storage location, and must end in the name.
    const path = Object.hasOwn(file, 'path') ? file.path : null;
    if (path !== null && (!clean(path, DEALER_IMPORT_LIMITS.maxPath) || /[\\\u0000-\u001f]/.test(path) || path.startsWith('/') || path.includes('//')
      || path.split('/').some(segment => segment === '.' || segment === '..' || !segment.trim()) || !path.endsWith(file.name))) fail();
    ids.add(file.id);
    return { id: file.id, name: file.name, size: file.size, type: file.type, ...(path !== null && path !== file.name ? { path } : {}) };
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
  const slots = catalog.slots.slice(0, 64).map(({ id, label, kind, start, end, group, caption }) => ({ id: text(id, 120), label: text(label, 120),
    kind: text(kind, 16), start: text(start, 8), end: text(end, 8), group: text(group ?? '', 16), caption: text(caption ?? '', 60) }));
  return { dealers, slots, dealerCount: catalog.dealers.length, slotCount: catalog.slots.length,
    truncated: shortened || dealers.length < catalog.dealers.length || slots.length < catalog.slots.length };
}

// Filename advice comes from the shared naming convention. Pose, language and
// take are derived from the name only; they are proposals until a human saves.
// Only an explicit chain (suffix or shoe transition) becomes a declaration; an
// assumed chain is mentioned but never written on the operator's behalf.
export function filenameClipAdvice(file, catalog) {
  const parsed = parseClipFilename(file.name, { type: file.type, path: file.path ?? '' });
  const hints = parsed.slotIds.filter(id => catalog.slots.some(slot => slot.id === id));
  const slotId = hints.length === 1 ? hints[0] : null;
  const chained = slotId && slotId === parsed.slotId && parsed.poses && /^(?:deal|reveal|transition)\./.test(slotId) ? parsed.poses : null;
  return { slotId, hints, poses: chained && parsed.explicitPose ? chained : null, assumed: chained && !parsed.explicitPose ? chained : null,
    variant: chained ? parsed.variant : null, language: slotId?.startsWith('speak.') ? parsed.language : null,
    take: slotId?.startsWith('speak.') ? parsed.take : null, canonical: slotId !== null && parsed.canonical, folderHint: parsed.folderHint };
}

const alternativeReason = (slotId, catalog) => `Kan också vara ${catalog.slots.find(slot => slot.id === slotId)?.caption ?? slotId} enligt namnet.`;
export function filenameDealerImportRows(input, catalog) {
  return input.files.map(file => {
    const advice = filenameClipAdvice(file, catalog);
    const { slotId, hints } = advice;
    const chain = advice.poses ? ` Poskedja ${advice.poses.start} → ${advice.poses.end} enligt namnet.`
      : advice.assumed ? ` Namnet saknar poskedja; fackets vanliga kedja är ${advice.assumed.start} → ${advice.assumed.end}. Välj den i raden om den stämmer.` : '';
    const source = file.path && advice.folderHint ? 'Mappen och filnamnet' : 'Filnamnet';
    const alternatives = slotId ? [] : hints.slice(0, DEALER_IMPORT_LIMITS.maxAlternatives).map(id => ({ slotId: id, reason: alternativeReason(id, catalog) }));
    return { fileId: file.id, slotId, confidence: slotId ? advice.canonical ? 'high' : 'medium' : 'low', reason: slotId
      ? `${source} matchar ett exakt fack.${chain} Innehållet är inte verifierat.`
      : hints.length > 1 ? 'Filnamnet anger flera möjliga fack. Välj rätt fack själv.' : 'Filnamnet räcker inte för en säker placering. Välj ett fack eller förtydliga kontexten.',
      ...(alternatives.length ? { alternatives } : {}),
      ...(advice.poses ? { poses: advice.poses } : {}), ...(advice.language ? { language: advice.language } : {}), ...(advice.take !== null ? { take: advice.take } : {}) };
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
    if (!exact(row, ['fileId', 'slotId', 'confidence', 'reason'], ['alternatives']) || !input.files.some(file => file.id === row.fileId) || seen.has(row.fileId)
      || row.slotId !== null && !catalog.slots.some(slot => slot.id === row.slotId)
      || !['low', 'medium', 'high'].includes(row.confidence) || !clean(row.reason, 600)) throw Error('invalid_import_advice');
    // Alternatives are other allowlisted slots the person can pick with one
    // click. They are never applied by themselves and never repeat the proposal.
    if (Object.hasOwn(row, 'alternatives')) {
      if (!Array.isArray(row.alternatives) || row.alternatives.length > DEALER_IMPORT_LIMITS.maxAlternatives
        || row.alternatives.some((item, index) => !exact(item, ['slotId', 'reason']) || item.slotId === row.slotId || !clean(item.reason, 300)
          || !catalog.slots.some(slot => slot.id === item.slotId) || row.alternatives.findIndex(other => other.slotId === item.slotId) !== index)) throw Error('invalid_import_advice');
    }
    seen.add(row.fileId); return { ...row };
  });
  return { assistantMessage: value.assistantMessage, rows };
}

// A frozen Kevin source recognises its own files by exact name and size. That
// evidence replaces filename and model proposals for those files, but it is
// still advice: a person reviews the slot and saves through the normal upload.
export function frozenDealerImportMatches(input, catalog) {
  const matches = new Map();
  for (const file of input.files) {
    const match = frozenImportFileMatch(input.dealerId, file, catalog);
    if (match) matches.set(file.id, match);
  }
  return matches;
}

// Read-only repair advice for existing ordinary uploads. SHA and size identify
// the frozen file; the normal import generator owns the wording and slot facts.
// The existing classify writer remains responsible for authority and row CAS.
export function frozenImportNoteRepairs(dealerId, inventory, catalog) {
  if (!catalog.dealers.some(row => row.id === dealerId)) throw new StudioStorageError('studio_dealer_unknown', 404);
  const source = frozenImportSourceForDealer(dealerId), candidates = [];
  let skipped = 0;
  if (!source) return { dealerId, candidates, skipped };
  const files = new Map();
  for (const file of source.files) {
    if (!/^[a-f0-9]{64}$/.test(file.sha256 ?? '')) continue;
    const key = `${file.sha256}:${file.size}`;
    files.set(key, [...(files.get(key) ?? []), file]);
  }
  const videos = inventory?.videos ?? [], ids = new Set(), duplicateIds = new Set();
  for (const video of videos) { if (ids.has(video.id)) duplicateIds.add(video.id); ids.add(video.id); }
  for (const video of videos) {
    const previous = video.classification;
    if (video.dealer !== dealerId || previous?.dealerId !== dealerId || typeof previous.notes !== 'string' || previous.notes.trim()) continue;
    // Private Blob inventory reports "unchecked": listing does not rehash the
    // object. Upload commit already verified its immutable SHA/size before
    // registration. This repairs text only; it grants no playback acceptance.
    if (!video.available || video.storage !== 'private-blob' || video.source !== 'upload' || !['unchecked', 'verified'].includes(video.integrity)
      || video.retainedBank || video.familyId || previous.familyId || previous.archived || video.deletion || previous.recordedSpeech
      || duplicateIds.has(video.id) || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(video.id)) { skipped++; continue; }
    let matches = files.get(`${video.sha256}:${video.bytes}`) ?? [];
    // Byte-identical named variants may carry different pose metadata. Only
    // the exact preserved source name/stem can disambiguate those aliases.
    if (matches.length > 1) matches = matches.filter(file => {
      const name = file.path.slice(file.path.lastIndexOf('/') + 1);
      return previous.label === name || previous.label === name.replace(/\.[^.]+$/, '');
    });
    if (matches.length !== 1) { skipped++; continue; }
    const file = matches[0], name = file.path.slice(file.path.lastIndexOf('/') + 1);
    const input = { dealerId, files: [{ id: video.id, name, size: file.size, type: 'video/mp4' }] };
    const proposal = finishDealerImportRows([{ fileId: video.id, slotId: null }], input, catalog)[0];
    const expected = proposal.classification;
    if (!expected || proposal.evidence?.sha256 !== video.sha256
      || ['dealerId', 'eventId', 'situation', 'kind', 'role', 'playback', 'startPose', 'endPose', 'mediaType'].some(key => previous[key] !== expected[key])) { skipped++; continue; }
    try { validateVideoMetadata(previous, { forWrite: true }); } catch { skipped++; continue; }
    candidates.push({ id: video.id, sha256: video.sha256, previous: structuredClone(previous), notes: expected.notes });
  }
  return { dealerId, candidates, skipped };
}

export function finishDealerImportRows(rows, input, catalog) {
  const matches = frozenDealerImportMatches(input, catalog);
  const proposals = rows.map(row => matches.has(row.fileId) ? { ...frozenImportProposal(matches.get(row.fileId), catalog), fileId: row.fileId } : row);
  const counts = new Map(), filled = new Set();
  for (const row of proposals) if (row.slotId) counts.set(row.slotId, (counts.get(row.slotId) ?? 0) + 1);
  const standards = catalog.standards?.[input.dealerId] ?? {};
  const unmapped = (row, warnings, extra) => ({ ...row, slotId: null, confidence: 'low', classification: null, group: null, role: null,
    alternatives: alternativesFor(row, null, catalog), warnings: [...warnings, extra] });
  return input.files.map(file => {
    const row = proposals.find(item => item.fileId === file.id), frozen = matches.get(file.id) ?? null;
    const slot = catalog.slots.find(item => item.id === row.slotId);
    let classification = null;
    // Advice is not storage support. Keep this server-owned warning even when
    // the model omits it, the slot is unknown, or another guard rejects the row.
    const warnings = ['video/mp4', 'video/webm'].includes(file.type) ? [] : [DEALER_IMPORT_STORAGE_WARNING];
    if (frozen) warnings.push(...frozenImportWarnings(frozen));
    const name = `-${normalizedName(file.name)}-`;
    const namedOtherDealer = catalog.dealers.find(dealer => dealer.id !== input.dealerId
      && [dealer.id, dealer.label].some(label => name.includes(`-${normalizedName(label)}-`)));
    if (namedOtherDealer && !frozen) return unmapped(row, warnings, `Filnamnet nämner ${namedOtherDealer.label}, men du har valt en annan dealer. Kontrollera identiteten innan du väljer fack.`);
    if (namedOtherDealer) warnings.push(`Filnamnet nämner ${namedOtherDealer.label}, men namn och storlek matchar ${frozen.source.id}. Kontrollera identiteten innan du sparar.`);
    const image = file.type.startsWith('image/'), audio = file.type.startsWith('audio/');
    if (slot && (image !== (slot.kind === 'pose') || audio && slot.kind !== 'speech')) return unmapped(row, warnings, 'Filtypen passar inte det föreslagna facket. Välj ett kompatibelt fack.');
    const advice = filenameClipAdvice(file, catalog), named = !frozen && Boolean(slot && advice.slotId === slot.id);
    const language = frozen ? row.language ?? null : named ? advice.language : null;
    const take = frozen ? row.take ?? null : named ? advice.take : null;
    let role = null;
    if (slot?.kind === 'pose') warnings.push('Referensbilden sparas inte i klippbanken. Hantera VILA/REDO separat i Skapa material; ett posebyte kräver ny granskning.');
    else if (slot) {
      // Pose, language and take are read from the filename for the same slot only;
      // a model may pick another slot, and then the name's chain does not apply.
      // A frozen source declares them for its own exact file instead.
      const chain = frozen ? row.poses ?? null : named && advice.poses ? advice.poses : null;
      const poses = chain && !audio ? { startPose: chain.start, endPose: chain.end } : {};
      const origin = frozen ? 'källan' : 'filnamnet';
      const notes = [frozen ? `Importförslag från ${frozen.source.id} · innehållet är inte visuellt godkänt.` : 'Importförslag · innehållet är inte visuellt godkänt.',
        ...(language ? [`Språk i ${origin}: ${language}.`] : []), ...(take !== null ? [`Tagning ${take} enligt ${origin}.`] : [])].join(' ');
      classification = validateVideoMetadata({ dealerId: input.dealerId, eventId: slot.eventId, situation: slot.situation,
        kind: slot.kind, role: 'alternative', playback: 'once', label: file.name.slice(0, 120), notes, ...poses,
        ...(audio ? { mediaType: 'audio' } : { compositing: { ...DEFAULT_DEALER_COMPOSITING } }) }, { forWrite: true });
      if (named && advice.assumed) warnings.push('Ingen poskedja sparas: filnamnet saknar -i, -v eller -iv. Välj kedjan i raden om du vet var händerna är när klippet börjar och slutar.');
      if (slot.kind === 'speech') warnings.push('Kontrollera exakt manus, ljud, läppsynk och cue-data. Replik-ID eller filnamn bevisar inte att talet stämmer.');
      if (!audio) warnings.push('Kontrollera grön bakgrund och mobilformat. Frilagda alfaklipp kan förhandsvisas men är spärrade för import tills assistentens kontroll och granskning är färdig. Ingen beskärning eller formatkonvertering utförs.');
      // The first video into a slot without a saved standard is offered as the
      // standard; the saved draft still decides when the person approves.
      if (!audio) { role = standards[slot.id] || filled.has(slot.id) ? 'variant' : 'standard'; filled.add(slot.id); }
    }
    if ((counts.get(row.slotId) ?? 0) > 1) warnings.push('Flera filer föreslås till samma fack. Granska varje alternativ; förslaget ersätter ingen standard.');
    const { poses: _poses, language: _language, take: _take, alternatives: _alternatives, ...base } = row;
    return { ...base, classification, warnings, group: slot?.group ?? null, role, alternatives: alternativesFor(row, slot, catalog, advice),
      ...(classification?.startPose ? { poses: { start: classification.startPose, end: classification.endPose } } : {}),
      ...(language ? { language } : {}), ...(take !== null ? { take } : {}) };
  });
}
// Merge model alternatives with the filename's other readings. Never the chosen
// slot, never a stale pose slot for a video, at most maxAlternatives entries.
function alternativesFor(row, slot, catalog, advice) {
  const result = [];
  const add = (slotId, reason) => {
    if (!slotId || slotId === (slot?.id ?? null) || result.some(item => item.slotId === slotId)) return;
    const candidate = catalog.slots.find(item => item.id === slotId);
    if (!candidate || result.length >= DEALER_IMPORT_LIMITS.maxAlternatives) return;
    result.push({ slotId, reason, caption: candidate.caption ?? candidate.label, group: candidate.group ?? null });
  };
  for (const item of row.alternatives ?? []) add(item.slotId, item.reason);
  for (const slotId of advice?.hints ?? []) add(slotId, alternativeReason(slotId, catalog));
  return result;
}
