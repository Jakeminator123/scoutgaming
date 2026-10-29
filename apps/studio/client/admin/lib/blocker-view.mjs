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
const sceneHref = compositionId => '/admin/scenes?' + new URLSearchParams({tab:'mallar', ...(id(compositionId) ? {composition:compositionId} : {})});
const assignmentHref = operatorId => id(operatorId) ? '/admin/companies/' + enc(operatorId) + '?flik=tilldelning' : '/admin/companies';

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
  if (BANK.includes(reason)) return {title:'Klipp', text:dealer + ' saknar klipp för ett fack.', action:{label:'Öppna Klippkartan', href:dealerHref(ctx.dealerId, 'klipp')}};
  if (reason === 'native_material_profile_missing') return {title:'Landningar', text:dealer + ' saknar landningar.', action:{label:'Öppna Landningar', href:dealerHref(ctx.dealerId, 'landningar')}};
  if (reason === 'native_material_dealer_missing') return {title:'Scenmall', text:'Dealern finns inte i scenmallen.', action:{label:'Öppna scenmallen', href:sceneHref(ctx.compositionId)}};
  return {title:'Klipp', text:'Ett klipp är tekniskt fel' + (technical[reason] ? ': ' + technical[reason] : '') + '.', action:{label:'Öppna Klippkartan', href:dealerHref(ctx.dealerId, 'klipp')}};
}

const reload = {label:'Läs in igen', href:null, run:'reload'};
const views = {
  studio_presentation_room_environment_required:ctx => ({title:'Scenmall', text:'Scenmallen har flera bakgrunder. Välj en som standard.', action:{label:'Öppna scenmallen', href:sceneHref(ctx.compositionId)}}),
  studio_presentation_room_environment_conflict:ctx => ({title:'Scenmall', text:'Scenmallen delas av andra spelbord. Använd en egen scenmall för det nya spelbordet.', action:{label:'Öppna scenmallen', href:sceneHref(ctx.compositionId)}}),
  studio_presentation_shared_layer_conflict:ctx => ({title:'Tilldelning', text:'Bolagets tilldelning är äldre än scenmallen. Publicera tilldelningen igen.', action:{label:'Öppna tilldelningen', href:assignmentHref(ctx.operatorId)}}),
  studio_operator_package_missing:ctx => ({title:'Tilldelning', text:'Bolaget har ingen publicerad tilldelning.', action:{label:'Öppna tilldelningen', href:assignmentHref(ctx.operatorId)}}),
  studio_presentation_game_lane_conflict:() => ({title:'Spelbord', text:'Spelbordet krockar med ett äldre spelbord. Läs in igen.', action:reload}),
  studio_conflict:() => ({title:'Ändrat', text:'Någon annan sparade just. Läs in igen.', action:reload}),
  studio_room_game_config_missing:ctx => ({title:'Spelinställningar', text:'Spelbordet saknar spelinställningar.', action:{label:'Öppna Spelinställningar', href:roomHref(ctx.roomId, 'spel')}}),
  studio_room_choices_draft_pending:ctx => ({title:'Utseende', text:'Bolaget har ett opublicerat utseendeutkast.', action:{label:'Öppna Utseende', href:roomHref(ctx.roomId, 'utseende')}}),
  studio_release_unchanged:() => ({title:'Inget att publicera', text:'Inget skiljer sig från live.', tone:'info', action:null}),
  studio_release_other_changes:ctx => ({title:'Spelbord', text:'Spelbordet har andra opublicerade ändringar. Publicera visar dem.', action:{label:'Publicera', href:roomHref(ctx.roomId, 'utseende')}}),
  ai_table_misfit:ctx => ({title:'Bordsgrafik', text:'Bordsgrafiken är ritad för en annan dealer eller placering.', action:{label:'Skapa nytt bord med AI', href:sceneHref(ctx.compositionId)}}),
  studio_room_activation_blocked:ctx => ({title:'Tillgänglighet', text:'Spelbordet kan inte öppnas än.', action:{label:'Öppna spelbordet', href:roomHref(ctx.roomId, 'tillganglighet')}}),
  composition_assigned:ctx => ({title:'Tilldelning', text:'Scenmallen är tilldelad ett bolag.', action:{label:'Öppna tilldelningen', href:assignmentHref(ctx.operatorId)}}),
  studio_presentation_runtime_update_required:() => ({title:'Drift', text:'Spelmotorn behöver uppdateras innan ändringen kan publiceras.', action:null}),
  studio_room_config_storage_missing:() => ({title:'Drift', text:'Databasen saknar lagringen för spelinställningar. Kontakta drift.', action:null}),
  studio_media_registry_unavailable:() => ({title:'Drift', text:'Medieregistret svarar inte just nu. Försök igen om en stund.', action:null}),
  studio_room_not_found:() => ({title:'Spelbord', text:'Spelbordet är inte öppet hos bolaget eller ingår inte i tilldelningen.', action:null}),
};
for (const [alias, to] of [['studio_presentation_shared_dealer_conflict','studio_presentation_shared_layer_conflict'],
  ['studio_presentation_room_rejected','studio_presentation_game_lane_conflict'],['studio_presentation_room_binding_conflict','studio_presentation_game_lane_conflict'],
  ['studio_release_preview_stale','studio_conflict'],['studio_room_restore_blocked','studio_room_activation_blocked']]) views[alias] = views[to];
export const BLOCKER_CODES = Object.freeze([...Object.keys(views), 'studio_room_game_material_unavailable', ...MATERIAL_REASONS]);

/**
 * En spärr som titel, en mening och en knapp. ctx: roomId, operatorId, dealerId, dealerName,
 * compositionId, language, materialReason (för studio_room_game_material_unavailable).
 */
export function blockerView(blockerCode, ctx = {}) {
  const detail = code(blockerCode) ? blockerCode : '';
  let view;
  if (blockerCode === 'studio_room_game_material_unavailable') view = MATERIAL_REASONS.includes(ctx.materialReason) ? material(ctx.materialReason, ctx)
    : {title:'Klipp', text:'Spelbordets inspelade material räcker inte.', action:{label:'Öppna Klippkartan', href:dealerHref(ctx.dealerId, 'klipp')}};
  else if (MATERIAL_REASONS.includes(blockerCode)) view = material(blockerCode, ctx);
  else if (Object.hasOwn(views, blockerCode)) view = views[blockerCode](ctx);
  else view = {title:'Hinder', text:'Något hindrar publiceringen.', action:null};
  return {tone:'error', ...view, detail:[detail, MATERIAL_REASONS.includes(ctx.materialReason) ? ctx.materialReason : ''].filter(Boolean).join(' · ')};
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
