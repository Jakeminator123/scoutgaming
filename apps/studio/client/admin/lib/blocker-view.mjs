import {unmeasuredClips,measureClipsInOrder} from './media-timing.mjs';

// Spärrarna i Admin som en mening på svenska och en knapp till rätt plats (enkel väg §3).
// blockerView(code, ctx) → {title, text, tone, action:{label, href, run?}|null, detail}.
// Koden visas aldrig i texten, bara under Detaljer (`detail`). `action.run` är en åtgärd som
// knappen utför direkt (runBlockerAction); annars är `href` platsen där spärren åtgärdas.

const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const code = value => typeof value === 'string' && /^[a-z][a-z0-9_]{0,100}$/.test(value);
const enc = encodeURIComponent;
const roomHref = (roomId, flik) => id(roomId) ? '/admin/rooms/' + enc(roomId) + '?flik=' + flik : '/admin/companies';
const dealerHref = (dealerId, flik) => id(dealerId) ? '/admin/dealers/' + enc(dealerId) + '?flik=' + flik : '/admin/dealers';
const sceneHref = compositionId => '/admin/scenes?' + new URLSearchParams({tab:'miljoer', ...(id(compositionId) ? {composition:compositionId} : {})});
const companyHref = (operatorId, flik) => id(operatorId) ? '/admin/companies/' + enc(operatorId) + '?flik=' + flik : '/admin/companies';
const assignmentHref = operatorId => companyHref(operatorId, 'tilldelning');
const assignment = ctx => ({label:'Öppna tilldelningen', href:assignmentHref(ctx.operatorId)});
const environment = ctx => ({label:'Öppna miljön', href:sceneHref(ctx.compositionId)});
const environments = Object.freeze({label:'Öppna Miljöer', href:'/admin/scenes?tab=miljoer'});
const appearance = ctx => ({label:'Öppna Utseende', href:roomHref(ctx.roomId, 'utseende')});
const clipMap = ctx => ({label:'Öppna Klippkartan', href:dealerHref(ctx.dealerId, 'klipp')});

// Materialskälen (room-game-config-api.mjs) i fyra texter: mätning, tal, klippbank och tekniskt fel.
const SPEECH = ['native_material_speech_slot_missing','native_material_speech_unbound','native_material_take_unrecognized'];
const BANK = ['native_material_bank_incomplete','native_material_idle_missing'];
const MEASURE = ['native_material_measurement_missing','native_material_measurement_mismatch'];
const technical = Object.freeze({
  native_material_take_mismatch:'tagningen stämmer inte med klippet', native_material_take_audio_truncated:'ljudet fortsätter efter klippbytet',
  native_material_speech_timing_mismatch:'talets längd stämmer inte med klippet', native_material_speech_pose_unsupported:'talklippets pose stöds inte',
  native_material_transition_pose_missing:'en övergång saknar pose', native_material_video_unavailable:'filen går inte att läsa',
  native_material_size_mismatch:'storleken stämmer inte', native_material_timing_limit:'klippen blir för långa i följd',
  native_material_media_limit:'för många klipp', native_material_contract_unsupported:'landningarna stöder inte spelet',
  native_material_slot_unsupported:'facket stöds inte', native_material_frozen_v3_required:'tilldelningen behöver publiceras igen',
  native_material_invalid_publication:'publiceringen är ofullständig', native_material_room_mismatch:'klippet hör till ett annat spelbord',
});
export const MATERIAL_REASONS = Object.freeze([...MEASURE, ...SPEECH, ...BANK, 'native_material_profile_missing', 'native_material_dealer_missing', ...Object.keys(technical)]);
const language = value => ({sv:'svenska', en:'engelska'})[value] ?? 'valt språk';

function material(reason, ctx) {
  const dealer = typeof ctx.dealerName === 'string' && ctx.dealerName.trim() ? ctx.dealerName.trim() : 'Dealern';
  if (MEASURE.includes(reason)) return {title:'Tidsmätning', text:'Klippen saknar aktuell tidsmätning.', action:{label:'Mät omätta klipp', href:dealerHref(ctx.dealerId, 'klipp'), run:'measure'}};
  if (SPEECH.includes(reason)) return {title:'Röst och tal', text:'En replik saknar godkänt tal på ' + language(ctx.language) + '.', action:{label:'Öppna Röst och tal', href:dealerHref(ctx.dealerId, 'tal')}};
  if (BANK.includes(reason)) return {title:'Klipp', text:dealer + ' saknar klipp för ett fack.', action:clipMap(ctx)};
  // En dealer utan egen filmad profil ärver PAOW:s (#657).
  if (reason === 'native_material_profile_missing') return {title:'Landningar', text:'Dealern saknar filmad profil (landningar). Välj Använd PAOW:s landningar för dealers från dealer-fabriken, eller mät.', action:{label:'Öppna Landningar', href:dealerHref(ctx.dealerId, 'landningar')}};
  if (reason === 'native_material_dealer_missing') return {title:'Miljö', text:'Dealern finns inte i miljön.', action:{label:'Öppna miljön', href:sceneHref(ctx.compositionId)}};
  return {title:'Klipp', text:'Ett klipp är tekniskt fel' + (technical[reason] ? ': ' + technical[reason] : '') + '.', action:clipMap(ctx)};
}

const reload = {label:'Läs in igen', href:null, run:'reload'};
const views = {
  studio_presentation_room_environment_required:ctx => ({title:'Miljö', text:'Miljön har flera bakgrunder. Välj en som standard.', action:environment(ctx)}),
  studio_presentation_room_environment_conflict:ctx => ({title:'Miljö', text:'Miljön delas av andra spelbord. Använd en egen miljö för det nya spelbordet.', action:environment(ctx)}),
  studio_presentation_shared_layer_conflict:ctx => ({title:'Tilldelning', text:'Bolagets tilldelning är äldre än miljön. Publicera tilldelningen igen.', action:assignment(ctx)}),
  studio_operator_package_missing:ctx => ({title:'Tilldelning', text:'Bolaget har ingen publicerad tilldelning.', action:assignment(ctx)}),
  // Nytt spelbord (presentation-room-api.mjs och snabbskapandet, room-quick-create.mjs).
  studio_presentation_package_conflict:ctx => ({title:'Tilldelning', text:'Bolagets tilldelning behöver publiceras igen innan ett nytt spelbord kan läggas till.', action:assignment(ctx)}),
  studio_presentation_package_too_large:ctx => ({title:'Tilldelning', text:'Tilldelningen blir för stor med det här spelbordet.', action:assignment(ctx)}),
  studio_presentation_lane_incompatible:ctx => ({title:'Miljö', text:'Miljön saknar en spelbar dealer eller bakgrund.', action:environment(ctx)}),
  environment_dealer:ctx => ({title:'Miljö', text:'Miljön har en annan dealer som standard.', action:environment(ctx)}),
  no_dealer:() => ({title:'Dealer', text:'Det finns ingen dealer att skapa spelbordet med.', action:{label:'Öppna Dealers', href:'/admin/dealers'}}),
  studio_presentation_game_lane_conflict:() => ({title:'Spelbord', text:'Spelbordet krockar med ett äldre spelbord. Läs in igen.', action:reload}),
  studio_conflict:() => ({title:'Ändrat', text:'Någon annan sparade just. Läs in igen.', action:reload}),
  studio_room_game_config_missing:ctx => ({title:'Spelinställningar', text:'Spelbordet saknar spelinställningar.', action:{label:'Öppna Spelinställningar', href:roomHref(ctx.roomId, 'spel')}}),
  // Utan spelbord (nytt spelbord) publiceras eller slängs utkastet från bolagets journal.
  studio_room_choices_draft_pending:ctx => ({title:'Utseende', text:'Bolaget har ett opublicerat utseendeutkast. Publicera eller släng det först.',
    action:!id(ctx.roomId) && id(ctx.operatorId) ? {label:'Öppna bolagets journal', href:companyHref(ctx.operatorId, 'journal')} : {label:'Öppna Utseende', href:roomHref(ctx.roomId, 'utseende')}}),
  studio_release_unchanged:() => ({title:'Inget att publicera', text:'Inget skiljer sig från live.', tone:'info', action:null}),
  studio_release_other_changes:ctx => ({title:'Spelbord', text:'Spelbordet har andra opublicerade ändringar. Publicera visar dem.', action:{label:'Publicera', href:roomHref(ctx.roomId, 'utseende')}}),
  ai_table_misfit:ctx => ({title:'Bordsgrafik', text:'Bordsgrafiken är ritad för en annan dealer eller placering.', action:{label:'Skapa nytt bord med AI', href:sceneHref(ctx.compositionId)}}),
  studio_room_activation_blocked:ctx => ({title:'Tillgänglighet', text:'Spelbordet kan inte öppnas än.', action:{label:'Öppna spelbordet', href:roomHref(ctx.roomId, 'tillganglighet')}}),
  composition_assigned:ctx => ({title:'Tilldelning', text:'Miljön är tilldelad ett bolag.', action:{label:'Öppna tilldelningen', href:assignmentHref(ctx.operatorId)}}),
  studio_presentation_runtime_update_required:() => ({title:'Drift', text:'Spelmotorn behöver uppdateras innan ändringen kan publiceras.', action:null}),
  studio_room_game_config_unavailable:() => ({title:'Drift', text:'Spelinställningarna kan inte publiceras just nu. Försök igen om en stund.', action:null}),
  studio_room_config_storage_missing:() => ({title:'Drift', text:'Databasen saknar lagringen för spelinställningar. Kontakta drift.', action:null}),
  studio_media_registry_unavailable:() => ({title:'Drift', text:'Medieregistret svarar inte just nu. Försök igen om en stund.', action:null}),
  studio_room_not_found:() => ({title:'Spelbord', text:'Spelbordet är inte öppet hos bolaget eller ingår inte i tilldelningen.', action:null}),
};
for (const [alias, to] of [['studio_presentation_shared_dealer_conflict','studio_presentation_shared_layer_conflict'],
  ['studio_presentation_legacy_package_conflict','studio_presentation_package_conflict'],
  ['studio_presentation_room_rejected','studio_presentation_game_lane_conflict'],['studio_presentation_room_binding_conflict','studio_presentation_game_lane_conflict'],
  ['studio_release_preview_stale','studio_conflict'],['studio_room_restore_blocked','studio_room_activation_blocked']]) views[alias] = views[to];

// Skälen i studio_release_invalid (apps/studio/lib/room-release.mjs). ai_adopt_* kommer från "Använd i miljön
// och i spelbordet" i AI-dialogen (apps/studio/lib/ai-material-adoption.mjs).
const release = {
  studio_release_unchanged:views.studio_release_unchanged,
  studio_release_other_changes:views.studio_release_other_changes,
  studio_room_game_config_missing:views.studio_room_game_config_missing,
  studio_room_binding_incompatible:ctx => ({title:'Miljö', text:'Ett öppet spelbord hos bolaget kan inte visas med den sparade miljön.', action:environment(ctx)}),
  studio_presentation_required:() => ({title:'Miljö', text:'Bolagets miljöer är inte sparade eller saknas.', action:environments}),
  studio_dealer_idle_required:ctx => ({title:'Vila', text:'Dealern saknar sparad vila.', action:clipMap(ctx)}),
  studio_roulette_idle_required:ctx => ({title:'Vila', text:'Roulettedealern saknar sparad vila.', action:clipMap(ctx)}),
  studio_dealer_idle_policy_mismatch:ctx => ({title:'Vila', text:'Dealerns vila stämmer inte med de sparade klippen.', action:clipMap(ctx)}),
  studio_dealer_background_required:ctx => ({title:'Miljö', text:'Miljön saknar bakgrund.', action:environment(ctx)}),
  studio_media_binding_invalid:ctx => ({title:'Miljö', text:'Ett klipp i miljön är felkopplat.', action:environment(ctx)}),
  // Utkastet åtgärdas under Utseende, inte i miljöerna.
  studio_room_choices_draft_invalid:ctx => ({title:'Utseende', text:'Utseendeutkastet passar inte med de sparade miljöerna.', action:appearance(ctx)}),
  ai_adopt_other_template:ctx => ({title:'Miljö', text:'Spelbordet använder en annan miljö än den bordet ritades för.', action:appearance(ctx)}),
  ai_adopt_room_choice:ctx => ({title:'Utseende', text:'Bolaget eller spelbordet har ett eget val som döljer miljöns standard. Välj materialet under Utseende.', action:appearance(ctx)}),
  ai_adopt_other_room_table:ctx => ({title:'Bordsgrafik', text:'Ett annat öppet spelbord hos bolaget i samma miljö visar ett annat bord och skulle få den nya bredden. Ta bort dess eget bordsval under Utseende eller ändra bredden i miljön.', action:environment(ctx)}),
  ai_adopt_template_table_misfit:ctx => ({title:'Bordsgrafik', text:'Ett annat AI-bord i miljön är ritat för en annan bredd eller dealer och skulle inte passa längre. Ta bort det ur miljön eller rita om det först.', action:environment(ctx)}),
  ai_adopt_template_missing:() => ({title:'Miljö', text:'Miljön finns inte längre.', action:environments}),
  ai_adopt_material_missing:() => ({title:'Material', text:'Materialet finns inte i biblioteket eller passar inte Blackjack.', action:{label:'Öppna Material', href:'/admin/scenes?tab=material'}}),
  ai_adopt_table_misfit:ctx => ({title:'Bordsgrafik', text:'Bordsgrafiken passar inte miljöns dealers eller placering.', action:{label:'Skapa nytt bord med AI', href:sceneHref(ctx.compositionId)}}),
  ai_adopt_invalid:ctx => ({title:'Miljö', text:'Valet kunde inte läggas in i miljön.', action:environment(ctx)}),
};
export const RELEASE_REASONS = Object.freeze(Object.keys(release));
export const BLOCKER_CODES = Object.freeze([...Object.keys(views), 'studio_room_game_material_unavailable', 'studio_release_invalid', ...MATERIAL_REASONS]);

/**
 * En spärr som titel, en mening och en knapp. ctx: roomId, operatorId, dealerId, dealerName,
 * compositionId, language, materialReason och reboundRoom {id, name} (för
 * studio_room_game_material_unavailable), reason (för studio_release_invalid).
 */
export function blockerView(blockerCode, ctx = {}) {
  const detail = code(blockerCode) ? blockerCode : '';
  const materialReason = MATERIAL_REASONS.includes(ctx.materialReason) ? ctx.materialReason : '';
  let view, reason = '';
  if (blockerCode === 'studio_room_game_material_unavailable') {
    view = materialReason ? material(materialReason, ctx)
      : {title:'Klipp', text:'Spelbordets inspelade material räcker inte.', action:clipMap(ctx)};
    reason = materialReason;
    // Ett annat öppet spelbord som binds om av publiceringen och vars material inte räcker.
    const room = ctx.reboundRoom;
    if (id(room?.id)) view = {title:'Spelbord', text:'Spelbordet ' + (typeof room.name === 'string' && room.name.trim() ? room.name.trim() : room.id)
      + ' kan inte bindas om. ' + view.text, action:{label:'Öppna spelbordet', href:roomHref(room.id, 'spel')}};
  } else if (blockerCode === 'studio_release_invalid') {
    view = Object.hasOwn(release, ctx.reason) ? release[ctx.reason](ctx) : {title:'Miljö', text:'Publiceringen kan inte göras med de sparade valen.', action:environments};
    reason = code(ctx.reason) ? ctx.reason : '';
  } else if (MATERIAL_REASONS.includes(blockerCode)) view = material(blockerCode, ctx);
  else if (Object.hasOwn(views, blockerCode)) view = views[blockerCode](ctx);
  else view = {title:'Hinder', text:'Något hindrar publiceringen.', action:null};
  return {tone:'error', ...view, detail:[detail, reason].filter(Boolean).join(' · ')};
}

/**
 * Knappens åtgärd när den utförs direkt. 'measure': mät dealerns omätta klipp (#655,
 * POST /studio/api/videos/measure-timing per klipp) efter en färsk läsning av registret.
 */
export async function runBlockerAction(action, {dealerIds = [], fetchImpl = fetch, signal, onProgress} = {}) {
  if (action?.run !== 'measure') return {ok:false, error:'Åtgärden kan inte utföras här.'};
  const dealers = [...new Set(dealerIds.filter(id))];
  if (!dealers.length) return {ok:false, error:'Spelbordet har ingen dealer att mäta.'};
  let inventory;
  try {
    const response = await fetchImpl('/studio/api/videos', {method:'GET', credentials:'same-origin', cache:'no-store', redirect:'error', signal, headers:{accept:'application/json'}});
    inventory = response.ok ? await response.json() : null;
  } catch { inventory = null; }
  if (!Array.isArray(inventory?.videos)) return {ok:false, error:'Klippregistret kunde inte läsas. Försök igen.'};
  const pending = dealers.flatMap(dealer => unmeasuredClips(inventory, dealer));
  const result = await measureClipsInOrder(pending, {fetchImpl, signal, onProgress});
  if (result.failed.length) return {ok:false, measured:result.measured.length, error:result.failed.length + ' av ' + pending.length + ' klipp kunde inte mätas: ' + result.failed[0].message};
  return {ok:true, measured:result.measured.length, message:pending.length ? pending.length + ' klipp uppmätta.' : 'Alla klipp var redan uppmätta.'};
}
