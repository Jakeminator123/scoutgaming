import {labUrl} from '../../../lib/lab-url.mjs';
import {aiTableMisfitMessage} from '../../../lib/ai-image-contract.mjs';

// Spelbordets publicering i Admin (docs/plans/ADMIN-FORENKLING.md §7). Servern äger alla
// kontroller (apps/studio/lib/room-release.mjs); här läses förhandsvisningen, kroppen byggs
// exakt av den, kvittot kontrolleras och felkontraktet {error, code, step} översätts till
// svenska. Klienten försöker aldrig igen automatiskt: varje nytt försök börjar med att
// användaren läser in förhandsvisningen igen.

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const code = value => typeof value === 'string' && /^[a-z][a-z0-9_]{0,100}$/.test(value);
const revision = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
const token = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const count = value => Number.isSafeInteger(value) && value >= 0;

export const ROOM_RELEASE_READ_PATH = '/api/admin/room-release';
export const ROOM_RELEASE_PUBLISH_PATH = '/api/admin/operator-package';

const languages = Object.freeze({en:'engelska', sv:'svenska'});
const limits = Object.freeze({casual:'Casual', prive:'Privé', high:'High'});
const roles = Object.freeze({background:'Bakgrund', dealer:'Dealer', table:'Bordsgrafik'});
// Utseendets nycklar (packages/operators/contracts/branding.mjs PARTNER_BRANDING_FIELDS).
const appearanceKeys = Object.freeze({...roles, lane:'Scenmall', color:'Färg'});
export const languageLabel = value => languages[value] ?? String(value ?? '–');
export const limitLabel = value => limits[value] ?? String(value ?? '–');

// Materialskälen ur den fasta listan (room-game-config-api.mjs) som användaren kan åtgärda.
const materialReasons = Object.freeze({
  native_material_take_unrecognized:'ingen godkänd tagning',
  native_material_take_mismatch:'tagningen stämmer inte med klippet',
  native_material_take_audio_truncated:'tagningens ljud är avklippt',
  native_material_speech_unbound:'repliken saknar tal',
  native_material_speech_slot_missing:'en replik saknar klipp',
  native_material_speech_timing_mismatch:'talets längd stämmer inte med klippet',
  native_material_speech_pose_unsupported:'talklippets pose stöds inte',
  native_material_bank_incomplete:'klippbanken är inte komplett',
  native_material_idle_missing:'vila saknas',
  native_material_dealer_missing:'dealern saknas i scenmallen',
  native_material_video_unavailable:'ett klipp är inte tillgängligt',
  native_material_transition_pose_missing:'en övergång saknar pose',
  native_material_measurement_missing:'klippen är inte uppmätta',
  native_material_measurement_mismatch:'klippens mätning stämmer inte',
  native_material_size_mismatch:'klippens storlek stämmer inte',
});
// Saknad eller inaktuell tidsmätning åtgärdas med Mät omätta klipp på dealerns flik Klipp.
const measurementReason = reason => reason === 'native_material_measurement_missing' || reason === 'native_material_measurement_mismatch';
export function materialReasonText(reason) {
  return materialReasons[reason] ?? (code(reason) ? 'materialet är inte komplett (' + reason + ')' : 'materialet är inte komplett');
}

// Fasta skäl i studio_release_invalid.
const invalidReasons = Object.freeze({
  studio_release_unchanged:'Inget skiljer sig från live, så inget publicerades.',
  studio_room_binding_incompatible:'Ett öppet spelbord hos bolaget kan inte visas med den sparade scenmallen.',
  studio_presentation_required:'Bolagets scenmallar är inte sparade eller saknas.',
  studio_dealer_idle_required:'Dealern saknar sparad vila.',
  studio_roulette_idle_required:'Roulettedealern saknar sparad vila.',
  studio_dealer_idle_policy_mismatch:'Dealerns vila stämmer inte med de sparade klippen.',
  studio_dealer_background_required:'Scenmallen saknar bakgrund.',
  studio_media_binding_invalid:'Ett klipp i scenmallen är felkopplat.',
  studio_room_choices_draft_invalid:'Utseendeutkastet passar inte med de sparade scenmallarna.',
  // "Använd i miljön och i spelbordet" (AI-dialogen, action adopt-room-material).
  studio_release_other_changes:'Spelbordet har andra sparade ändringar som inte är publicerade. Materialet ligger i biblioteket; publicera spelbordet med Publicera, där skillnaden visas.',
  studio_room_game_config_missing:'Spelbordet saknar publicerade spelinställningar. Publicera spelbordet en gång först.',
  ai_adopt_other_template:'Spelbordet använder en annan scenmall än den bordet ritades för.',
  ai_adopt_room_choice:'Bolaget eller spelbordet har ett eget val som döljer scenmallens standard. Välj materialet under Utseende.',
  ai_adopt_other_room_table:'Ett annat öppet spelbord hos bolaget på samma scenmall visar ett annat bord och skulle få den nya bredden. Ta bort dess eget bordsval under Utseende eller ändra bredden i scenmallen.',
  ai_adopt_template_table_misfit:'Ett annat AI-bord i scenmallen är ritat för en annan bredd eller dealer och skulle inte passa längre. Ta bort det ur mallen eller rita om det först.',
  ai_adopt_template_missing:'Scenmallen finns inte längre.',
  ai_adopt_material_missing:'Materialet finns inte i biblioteket eller passar inte Blackjack.',
  ai_adopt_table_misfit:'Bordsgrafiken passar inte scenmallens dealers eller placering.',
  ai_adopt_invalid:'Valet kunde inte läggas in i scenmallen.',
});

const conflictSteps = Object.freeze({
  package:'Bolagets publicering har ändrats sedan förhandsvisningen.',
  project:'Scenmallarna har sparats om sedan förhandsvisningen.',
  administration:'Spelbordets uppgifter har ändrats sedan förhandsvisningen.',
  room_config_head:'Spelinställningarna har publicerats från ett annat håll.',
  media:'Ett klipp har ändrats medan publiceringen förbereddes.',
  materials:'Bolagets eget material har ändrats sedan förhandsvisningen.',
  room_choices:'Utseendeutkastet har ändrats sedan förhandsvisningen.',
});
const RELOAD = ' Läs in igen.';
// "Inget publicerades" sägs bara när servern med en känd kod har vägrat före commit. Ett 5xx-svar
// utan känd kod kan komma från en proxy eller en timeout efter commit: utfallet är då okänt.
const NOTHING = ' Inget publicerades.';
const UNCERTAIN = ' Läs in igen för att se om publiceringen gick igenom.';

/**
 * Begriplig svensk text för felkontraktet {error, code, step} och HTTP-status. `phase` är
 * 'publish' (standard) eller 'read' (förhandsvisningen, där inget kan ha publicerats).
 */
export function roomReleaseErrorMessage({status = 0, code: errorCode, step, reason, materialReason, phase = 'publish'} = {}) {
  switch (errorCode) {
    case 'studio_release_preview_stale': return 'Något har ändrats sedan förhandsvisningen.' + RELOAD;
    case 'studio_conflict': return (conflictSteps[step] ?? 'Uppgifterna har ändrats under tiden.') + NOTHING + RELOAD;
    case 'studio_room_choices_draft_pending': return 'Bolaget har ett opublicerat utseendeutkast. Publicera eller släng det under Utseende först.' + NOTHING;
    case 'studio_room_game_material_unavailable': return 'Spelbordets inspelade material räcker inte: ' + materialReasonText(materialReason) + '.'
      + (measurementReason(materialReason) ? ' Öppna Dealers › dealern och välj Mät omätta klipp.' : ' Öppna Röst och tal.') + NOTHING;
    case 'studio_release_invalid': return (invalidReasons[reason] ?? 'Publiceringen kan inte göras med de sparade valen' + (code(reason) ? ' (' + reason + ')' : '') + '.')
      + (reason === 'studio_release_unchanged' ? '' : NOTHING);
    case 'studio_room_not_found': return 'Spelbordet är inte öppet hos bolaget eller ingår inte i bolagets publicerade tilldelning.' + NOTHING;
    case 'studio_presentation_runtime_update_required': return 'Spelmotorn behöver uppdateras innan ändringen kan publiceras.' + NOTHING;
    case 'studio_room_config_storage_missing': return 'Databasen saknar lagringen för spelinställningar. Kontakta drift.' + NOTHING;
    case 'studio_media_registry_unavailable': return 'Medieregistret svarar inte just nu.' + NOTHING + ' Försök igen om en stund.';
    default: break;
  }
  if (status === 401) return 'Logga in igen för att fortsätta.';
  if (status === 403) return 'Du saknar behörighet att publicera spelbordet.';
  if (status === 409) return 'Uppgifterna har ändrats.' + NOTHING + RELOAD;
  const raw = code(errorCode) ? ' (' + errorCode + ')' : '';
  if (status === 0 || status >= 500) return phase === 'read' ? 'Jämförelsen med live kunde inte läsas' + raw + '.' + RELOAD
    : 'Servern kunde inte bekräfta publiceringen' + raw + '.' + UNCERTAIN;
  return 'Publiceringen gick inte igenom' + (code(errorCode) ? ': ' + errorCode : '') + '.' + NOTHING;
}

// Ett hinder i förhandsvisningen: text och länk till det ställe där det åtgärdas.
const roomHref = (roomId, flik) => '/admin/rooms/' + encodeURIComponent(roomId) + '?flik=' + flik;
const dealerHref = (dealerId, flik) => '/admin/dealers/' + encodeURIComponent(dealerId) + '?flik=' + flik;
/** @returns {{text:string;href:string|null;linkLabel:string|null}} */
export function roomReleaseBlocker(blocker, {roomId = '', dealerId = null, dealerName = '', rooms = []} = {}) {
  const link = (href, linkLabel) => ({href, linkLabel});
  const none = {href:null, linkLabel:null};
  const dealer = id(dealerId) ? dealerId : null;
  switch (blocker?.code) {
    case 'studio_room_game_config_missing':
      return {text:'Spelinställningar saknas: välj språk och insatsprofil och spara.', ...link(roomHref(roomId, 'spel'), 'Öppna Spelinställningar')};
    case 'studio_room_config_storage_missing':
      return {text:'Databasen saknar lagringen för spelinställningar. Kontakta drift.', ...none};
    case 'studio_room_choices_draft_pending':
      return {text:'Bolaget har ett opublicerat utseendeutkast. Publicera eller släng det först.', ...link(roomHref(roomId, 'utseende'), 'Öppna Utseende')};
    case 'studio_room_game_material_unavailable': {
      if (blocker.area === 'rooms' && id(blocker.roomId)) {
        const name = rooms.find(row => row?.id === blocker.roomId)?.name ?? blocker.roomId;
        return {text:'Spelbordet ' + name + ' kan inte bindas om: ' + materialReasonText(blocker.materialReason) + '.', ...link(roomHref(blocker.roomId, 'spel'), 'Öppna spelbordet')};
      }
      if (measurementReason(blocker.materialReason)) return {text:'Tal och klipp: ' + materialReasonText(blocker.materialReason) + '. Öppna Dealers › '
        + (dealer ? (typeof dealerName === 'string' && dealerName.trim() ? dealerName.trim() : dealer) : 'dealern') + ' och välj Mät omätta klipp.',
        ...(dealer ? link(dealerHref(dealer, 'klipp'), 'Öppna dealerns klipp') : none)};
      return {text:'Tal och klipp: ' + materialReasonText(blocker.materialReason) + '.', ...(dealer ? link(dealerHref(dealer, 'tal'), 'Öppna i Röst och tal') : none)};
    }
    case 'ai_table_misfit':
      return {text:aiTableMisfitMessage({code:blocker.reason}), ...link('/admin/scenes?' + new URLSearchParams({tab:'mallar', ...(id(blocker.compositionId) ? {composition:blocker.compositionId} : {})}), 'Öppna scenmallen')};
    case 'studio_release_invalid': {
      const text = invalidReasons[blocker.reason] ?? 'Scenmallarna kan inte publiceras' + (code(blocker.reason) ? ' (' + blocker.reason + ')' : '') + '.';
      if (['studio_dealer_idle_required','studio_dealer_idle_policy_mismatch'].includes(blocker.reason) && dealer) return {text, ...link(dealerHref(dealer, 'klipp'), 'Öppna dealerns klippkarta')};
      // Utkastet åtgärdas under Utseende, inte i scenmallarna.
      if (blocker.reason === 'studio_room_choices_draft_invalid') return {text, ...link(roomHref(roomId, 'utseende'), 'Öppna Utseende')};
      return {text, ...link('/admin/scenes?tab=mallar', 'Öppna Scenmallar')};
    }
    case 'studio_media_registry_unavailable': return {text:'Medieregistret svarar inte just nu. Läs in igen om en stund.', ...none};
    case 'studio_presentation_runtime_update_required': return {text:'Spelmotorn behöver uppdateras innan ändringen kan publiceras.', ...none};
    case 'studio_conflict': return {text:'Uppgifterna ändrades medan förhandsvisningen lästes. Läs in igen.', ...none};
    default: return {text:'Hinder' + (code(blocker?.code) ? ': ' + blocker.code : '') + '.', ...none};
  }
}

// En rad per område, i den ordning Admin visar dem. Oförändrade områden visas också.
/** @returns {{area:string;label:string;changed:boolean;rows:string[]}[]} */
export function roomReleaseAreas(preview, {dealerName, rooms = []} = {}) {
  const changes = Array.isArray(preview?.changes) ? preview.changes : [];
  const of = area => changes.filter(row => row?.area === area);
  const take = value => value?.takeId ? 'tagning ' + value.takeId : 'ingen tagning';
  const speech = of('speech').map(row => (row.lineId || 'replik') + ' · ' + (row.language ?? '–') + ': ' + take(row.before) + ' → ' + take(row.after)
    + (row.after?.approvedBy ? ', godkänd av ' + row.after.approvedBy : row.after ? ', inte godkänd' : ''));
  const clips = of('clips').map(row => (count(row.added) ? row.added : 0) + ' tillkommer, ' + (count(row.removed) ? row.removed : 0) + ' tas bort');
  const idle = of('idle').map(row => !row.before?.mediaId && !row.before?.policySha256 ? 'Vila läggs till' : !row.after?.mediaId && !row.after?.policySha256 ? 'Vila tas bort' : 'Vila byts');
  const placement = of('placement').map(() => 'Placeringen i scenmallen är ändrad');
  const settings = of('settings').map(row => {
    const parts = [];
    if (row.before?.language !== row.after?.language) parts.push('Språk ' + (row.before ? languageLabel(row.before.language) : '–') + ' → ' + languageLabel(row.after?.language));
    if (row.before?.limitPreset !== row.after?.limitPreset) parts.push('Insatsprofil ' + (row.before ? limitLabel(row.before.limitPreset) : '–') + ' → ' + limitLabel(row.after?.limitPreset));
    return parts.join(', ') || 'Inställningarna publiceras';
  });
  // Dealerns namn finns i klienten (registret); bakgrund och bordsgrafik har bara id här.
  const choice = (key, value) => value == null ? '–' : key === 'dealer' && typeof dealerName === 'function' ? dealerName(value) || value : value;
  const appearance = appearanceView(preview, {dealerName, rooms});
  // Ett val i utkastet som ger spelbordets ändring visas här, en gång, med var det kommer ifrån.
  const origin = {company:' (bolagets val i utkastet)', own:' (eget val i utkastet)'};
  const choices = of('roomChoices').map(row => (roles[row.key] ?? row.key) + ': ' + choice(row.key, row.before) + ' → ' + choice(row.key, row.after)
    + (origin[appearance?.folded.get(row.key)] ?? ''));
  const rebinding = (Array.isArray(preview?.affectedRooms) ? preview.affectedRooms : []).filter(row => row?.rebinds)
    .map(row => (row.name || row.id) + ' binds om och behåller sina spelinställningar');
  const other = of('package').map(() => 'Annat i bolagets tilldelning ändras (andra scenmallar eller dealers)');
  const area = (key, label, rows) => ({area:key, label, changed:rows.length > 0, rows});
  return [area('speech', 'Tal per replik', speech), area('clips', 'Klipp', clips), area('idle', 'Vila', idle), area('placement', 'Placering', placement),
    area('settings', 'Inställningar', settings), area('roomChoices', 'Spelbordets val', choices),
    ...(appearance ? [area('appearance', appearance.label, appearance.rows)] : []), area('rooms', 'Andra spelbord', rebinding),
    ...(other.length ? [area('package', 'Övrigt', other)] : [])];
}

// Bolagets utseendeutkast som följer med publiceringen (servern med steg D v2): Utseendes
// granskningsrader {roomId, key, before, after} och de spelbord utkastet påverkar. Servern
// utan steg D v2 skickar varken området eller appearanceDraft; då visas inget.
function appearanceView(preview, {dealerName, rooms = []} = {}) {
  const changes = Array.isArray(preview?.changes) ? preview.changes : [];
  const entries = changes.filter(row => row?.area === 'appearance');
  const draft = object(preview?.appearanceDraft) ? preview.appearanceDraft : null;
  if (!entries.length && draft?.included !== true) return null;
  const draftRevision = [entries[0]?.draftRevision, draft?.revision].find(count);
  const names = new Map();
  for (const row of [...(Array.isArray(preview?.affectedRooms) ? preview.affectedRooms : []), ...(Array.isArray(rooms) ? rooms : [])])
    if (id(row?.id) && typeof row.name === 'string' && row.name && !names.has(row.id)) names.set(row.id, row.name);
  const roomName = roomId => names.get(roomId) ?? roomId;
  const value = (key, raw) => {
    if (raw == null) return '–';
    if (key === 'dealer' && typeof dealerName === 'function' && typeof raw === 'string') return dealerName(raw) || raw;
    return typeof raw === 'string' || typeof raw === 'number' ? String(raw) : JSON.stringify(raw);
  };
  // Regeln för ett val en gång (rutan och antalet i statusraden):
  // 1. Bolagets rader (roomId null) och raderna roomOverrides.* är val i utkastet.
  // 2. Ett spelbords rad med samma nyckel och samma nya värde som bolagets rad är bara bolagets
  //    val som ärvs; den är inget eget val och spelbordet nämns i stället under "Gäller även".
  //    Övriga spelbordsrader är spelbordets eget val.
  // 3. Ett val som når det valda spelbordet med en nyckel som redan finns under roomChoices
  //    (servern bygger kandidaten på utkastets val) visas och räknas bara där, med sitt ursprung.
  // En ensam dealerändring hos ett bolag med ett spelbord blir då en rad och "1 ändring".
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const selected = preview?.roomId;
  const roomChoiceKeys = new Set(changes.filter(row => row?.area === 'roomChoices' && typeof row.key === 'string').map(row => row.key));
  const list = entries.flatMap(entry => (Array.isArray(entry.changes) ? entry.changes : []).filter(row => object(row) && typeof row.key === 'string'));
  const company = new Map(list.filter(row => !id(row.roomId)).map(row => [row.key, row]));
  const inherited = row => id(row.roomId) && company.has(row.key) && same(row.after, company.get(row.key).after);
  const folded = new Map();
  const rows = [], affected = [];
  for (const row of list) {
    const override = row.key.startsWith('roomOverrides.'), key = override ? row.key.slice('roomOverrides.'.length) : row.key;
    if (!override && inherited(row)) continue;
    if (!override && roomChoiceKeys.has(key)) {
      if (row.roomId === selected) { folded.set(key, 'own'); continue; }
      if (!id(row.roomId) && list.some(other => other.roomId === selected && other.key === key && inherited(other))) {
        if (!folded.has(key)) folded.set(key, 'company');
        continue;
      }
    }
    const subject = id(row.roomId) ? 'Spelbordet ' + roomName(row.roomId) : 'Bolaget';
    rows.push(subject + ' · ' + (appearanceKeys[key] ?? key) + (override ? ' (eget val)' : '') + ': ' + value(key, row.before) + ' → ' + value(key, row.after));
  }
  for (const entry of entries)
    for (const roomId of Array.isArray(entry.affectedRooms) ? entry.affectedRooms : []) if (id(roomId) && !affected.includes(roomId)) affected.push(roomId);
  const changeCount = rows.length;
  if (!rows.length) rows.push('Utkastet' + (draftRevision ? ' ' + draftRevision : '') + ' publiceras samtidigt'
    + (folded.size ? ' (valen står under Spelbordets val)' : ''));
  // Ett bolagsövergripande utkast kan ändra andra spelbord än det valda: det ska synas här.
  const others = affected.filter(roomId => roomId !== preview?.roomId);
  if (others.length) rows.push('Gäller även: ' + others.map(roomName).join(', '));
  return {label:'Utseende' + (draftRevision ? ' (utkast ' + draftRevision + ')' : ' (utkast)'), rows, changeCount, folded};
}

/**
 * Antal ändringar som väntar, för statusraden. Utseendeutkastet räknas med sina val enligt
 * regeln i appearanceView: varje val en gång, och inte igen när det redan räknas under
 * roomChoices. Ett utkast utan ändringsrader räknas som en ändring.
 */
export const roomReleaseChangeCount = preview => {
  const changes = Array.isArray(preview?.changes) ? preview.changes : [];
  const others = changes.filter(row => row?.area !== 'appearance').length;
  if (others === changes.length) return others;
  const view = appearanceView(preview);
  return others + (view?.changeCount || (view?.folded.size ? 0 : 1));
};

/**
 * Huvudknappens läge. Inaktiv med "Inget att publicera" när inget skiljer sig och inget hinder
 * finns; inaktiv när editorn har osparade ändringar; annars öppnar den rutan.
 * @returns {{disabled:boolean;label:string;hint:string}}
 */
export function roomReleaseButton({status, preview, blockedBy = ''} = {}) {
  if (status === 'loading' || status === 'idle') return {disabled:true, label:'Publicera', hint:'Jämför med live…'};
  if (status === 'error') return {disabled:false, label:'Publicera', hint:'Jämförelsen kunde inte läsas'};
  if (blockedBy) return {disabled:true, label:'Publicera', hint:blockedBy};
  const blockers = Array.isArray(preview?.blockers) ? preview.blockers.length : 0;
  if (!preview?.changed && !blockers) return {disabled:true, label:'Inget att publicera', hint:'Sparat läge är detsamma som live'};
  const changes = roomReleaseChangeCount(preview);
  return {disabled:false, label:'Publicera', hint:blockers ? (blockers === 1 ? '1 hinder' : blockers + ' hinder') + ' före publicering'
    : changes === 1 ? '1 ändring ej publicerad' : changes + ' ändringar ej publicerade'};
}

/** "Publicera nu" är aktiv bara när servern säger ready och hinderlistan är tom. */
export const roomReleaseCanPublish = preview => preview?.ready === true && preview.changed === true
  && Array.isArray(preview.blockers) && preview.blockers.length === 0 && token(preview.previewToken);

function validPreview(value, {operatorId, roomId}) {
  const r = value?.revisions;
  return object(value) && value.ok === true && value.operatorId === operatorId && value.roomId === roomId
    && object(r) && Number.isSafeInteger(r.package) && r.package > 0 && revision(r.project) && revision(r.administration)
    && typeof value.ready === 'boolean' && typeof value.changed === 'boolean' && Array.isArray(value.changes) && Array.isArray(value.blockers)
    && value.blockers.every(row => object(row) && typeof row.code === 'string') && Array.isArray(value.affectedRooms) && token(value.previewToken)
    && (value.gameConfig === null || object(value.gameConfig));
}

/** Felkontraktet som text, för andra anrop på samma väg (AI-dialogens "Använd i miljön och i spelbordet"). */
export async function roomReleaseFailure(response, phase = 'publish') { return failure(response, phase); }

async function failure(response, phase) {
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  const errorCode = code(body?.code) ? body.code : code(body?.error) ? body.error : undefined;
  const detail = {status:response.status, code:errorCode, ...(code(body?.step) ? {step:body.step} : {}),
    ...(code(body?.reason) ? {reason:body.reason} : {}), ...(code(body?.materialReason) ? {materialReason:body.materialReason} : {})};
  return {ok:false, ...detail, error:roomReleaseErrorMessage({...detail, phase})};
}

/** GET room-release: live och kandidat per område, hinder, revisioner och previewToken. */
export async function readRoomRelease({operatorId, roomId, fetchImpl = fetch, signal} = {}) {
  if (!id(operatorId) || !id(roomId)) return {ok:false, status:0, error:'Välj ett registrerat spelbord.'};
  let response;
  try {
    response = await fetchImpl(labUrl(ROOM_RELEASE_READ_PATH) + '?' + new URLSearchParams({operatorId, roomId}), {method:'GET',
      credentials:'same-origin', cache:'no-store', redirect:'error', signal, headers:{accept:'application/json'}});
  } catch (error) {
    if (signal?.aborted) throw error;
    return {ok:false, status:0, error:'Jämförelsen med live kunde inte läsas. Läs in igen.'};
  }
  if (!response.ok) return failure(response, 'read');
  let value;
  try { value = await response.json(); } catch { value = null; }
  if (!validPreview(value, {operatorId, roomId})) return {ok:false, status:response.status, error:'Serverns jämförelse stämmer inte med spelbordet. Läs in igen.'};
  return {ok:true, preview:value};
}

/** Exakt kropp för publish-room, byggd ur förhandsvisningen: token och alla förväntade revisioner. */
export function roomReleaseBody(preview) {
  return {action:'publish-room', operatorId:preview.operatorId, roomId:preview.roomId, gameConfig:preview.gameConfig,
    expectedPackageRevision:preview.revisions.package, expectedProjectRevision:preview.revisions.project,
    expectedAdministrationRevision:preview.revisions.administration, previewToken:preview.previewToken};
}

function validReceipt(value, preview) {
  return object(value) && value.ok === true && value.operatorId === preview.operatorId && value.roomId === preview.roomId
    && value.previousPackageRevision === preview.revisions.package && value.packageRevision === preview.revisions.package + 1
    && (value.package_revision === undefined || value.package_revision === value.packageRevision)
    && revision(value.configVersion) && typeof value.publishedAt === 'string' && Number.isFinite(Date.parse(value.publishedAt))
    && typeof value.actor === 'string' && value.actor.length > 0 && Array.isArray(value.changes);
}

/**
 * POST operator-package {action:'publish-room'}. Ett anrop per klick; vid fel eller okänt utfall
 * ska användaren läsa in förhandsvisningen igen innan nästa försök.
 */
export async function publishRoomRelease({preview, fetchImpl = fetch} = {}) {
  if (!roomReleaseCanPublish(preview)) return {ok:false, status:0, error:'Det finns hinder eller inget att publicera. Läs in igen.'};
  let response;
  try {
    response = await fetchImpl(labUrl(ROOM_RELEASE_PUBLISH_PATH), {method:'POST', credentials:'same-origin', cache:'no-store', redirect:'error',
      headers:{'content-type':'application/json', accept:'application/json'}, body:JSON.stringify(roomReleaseBody(preview))});
  } catch {
    return {ok:false, status:0, error:'Svaret kom inte fram.' + UNCERTAIN};
  }
  if (!response.ok) return failure(response, 'publish');
  let value;
  try { value = await response.json(); } catch { value = null; }
  if (!validReceipt(value, preview)) return {ok:false, status:response.status, error:'Publiceringskvittot kunde inte bekräftas. Läs in igen innan du fortsätter.'};
  return {ok:true, receipt:value};
}

/** "Publicerat · version N · tid · av vem". */
export function roomReleaseReceiptText(receipt) {
  const at = new Date(receipt.publishedAt);
  const when = at.toLocaleString('sv-SE', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', timeZone:'Europe/Stockholm'});
  return 'Publicerat · version ' + receipt.packageRevision + ' · ' + when + ' · av ' + receipt.actor;
}
