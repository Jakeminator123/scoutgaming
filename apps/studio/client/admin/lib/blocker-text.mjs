// Hindren före publicering och spel som svenska meningar (Enkel väg 2). Ett ställe för texterna:
// varje kod ger en mening och en åtgärd (länk eller text). Koden visas aldrig för användaren;
// den ligger bara i `title` för felsökning.

export const BLOCKER_FALLBACK = 'Spelbordet kan inte publiceras just nu. Läs in sidan igen.';

const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const roomHref = (roomId, flik) => id(roomId) ? '/admin/rooms/' + encodeURIComponent(roomId) + '?flik=' + flik : null;
const dealerHref = (dealerId, flik) => id(dealerId) ? '/admin/dealers/' + encodeURIComponent(dealerId) + '?flik=' + flik : null;

// Var hindret åtgärdas: etikett och adress (null när adressen inte är känd; etiketten säger då vart man går).
const targets = Object.freeze({
  tal:{label:'Öppna Röst och tal', missing:'Öppna Dealers › dealern › Röst och tal', href:ctx => dealerHref(ctx.dealerId, 'tal')},
  klipp:{label:'Öppna dealerns klipp', missing:'Öppna Dealers › dealern › Klipp', href:ctx => dealerHref(ctx.dealerId, 'klipp')},
  spel:{label:'Öppna Spelinställningar', missing:'Öppna spelbordets Spelinställningar', href:ctx => roomHref(ctx.roomId, 'spel')},
  utseende:{label:'Öppna Utseende', missing:'Öppna spelbordets Utseende', href:ctx => roomHref(ctx.roomId, 'utseende')},
  scenmallar:{label:'Öppna Scenmallar', href:() => '/admin/scenes?tab=mallar'},
  publicera:{label:'Publicera spelbordet igen', href:() => null},
  drift:{label:'Kontakta drift', href:() => null},
  igen:{label:'Läs in igen', href:() => null},
});

// Materialskälen (apps/studio/lib/room-game-config-api.mjs): vad dealern saknar, och var det åtgärdas.
export const MATERIAL_REASON_TEXT = Object.freeze({
  native_material_bank_incomplete:['har inte alla spelklipp som bordet behöver', 'klipp'],
  native_material_contract_unsupported:['har en filmad profil som inte stöder spelets inställningar', 'klipp'],
  native_material_dealer_missing:['finns inte i spelbordets scenmall', 'scenmallar'],
  native_material_frozen_v3_required:['har klipp som behöver publiceras om med den nya klippbanken', 'publicera'],
  native_material_idle_missing:['saknar ett viloklipp', 'klipp'],
  native_material_invalid_publication:['har en publicering som inte går att läsa', 'publicera'],
  native_material_measurement_mismatch:['har klipp vars mätning inte längre stämmer. Välj Mät omätta klipp', 'klipp'],
  native_material_measurement_missing:['har klipp som inte är uppmätta. Välj Mät omätta klipp', 'klipp'],
  native_material_media_limit:['har fler klipp än spelbordet rymmer', 'klipp'],
  native_material_profile_missing:['saknar en filmad profil för spelet', 'klipp'],
  native_material_room_mismatch:['har material som hör till ett annat spelbord', 'publicera'],
  native_material_size_mismatch:['har klipp med fel bildstorlek', 'klipp'],
  native_material_slot_unsupported:['har ett klipp på en plats som spelet inte använder', 'klipp'],
  native_material_speech_pose_unsupported:['har ett talklipp med en pose som spelet inte stöder', 'tal'],
  native_material_speech_slot_missing:['saknar klipp för en replik', 'tal'],
  native_material_speech_timing_mismatch:['har tal vars längd inte stämmer med klippet', 'tal'],
  native_material_speech_unbound:['har en replik utan godkänt tal', 'tal'],
  native_material_take_audio_truncated:['har en tagning där ljudet klipps av', 'tal'],
  native_material_take_mismatch:['har en tagning som inte hör till klippet', 'tal'],
  native_material_take_unrecognized:['saknar en godkänd tagning för en replik', 'tal'],
  native_material_timing_limit:['har klipp som blir för långa för spelets tider', 'klipp'],
  native_material_transition_pose_missing:['saknar en övergång mellan två poser', 'klipp'],
  native_material_video_unavailable:['har ett klipp som inte går att hämta', 'klipp'],
});

// Övriga hinder (apps/studio/lib/room-release.mjs och presentation-room-api.mjs).
export const BLOCKER_TEXT = Object.freeze({
  studio_room_game_config_missing:['Spelbordet saknar spelinställningar: välj språk och insatsprofil och spara.', 'spel'],
  studio_room_game_draft_required:['Spara spelinställningarna som utkast först, så kontrolleras materialet för valt språk.', 'spel'],
  studio_room_choices_draft_pending:['Bolaget har ett utseendeutkast från före den senaste publiceringen. Spara om eller publicera det under Utseende.', 'utseende'],
  studio_room_config_storage_missing:['Databasen saknar lagringen för spelinställningar.', 'drift'],
  studio_presentation_required:['Bolagets scenmallar är inte sparade eller saknas.', 'scenmallar'],
  studio_presentation_room_environment_required:['Scenmallen har ingen fast bakgrund. Välj en fast bakgrund för spelbordet.', 'scenmallar'],
  presentation_room_environment_required:['Scenmallen har ingen fast bakgrund. Välj en fast bakgrund för spelbordet.', 'scenmallar'],
  studio_presentation_runtime_update_required:['Spelmotorn behöver uppdateras innan ändringen kan publiceras.', 'drift'],
  presentation_package_too_large:['Bolagets paket blir för stort med den här scenmallen. Ta bort material som inte används.', 'scenmallar'],
  presentation_lane_incompatible:['Scenmallen passar inte bolagets publicerade paket.', 'scenmallar'],
  presentation_package_conflict:['Bolagets publicering ändrades medan spelbordet förbereddes.', 'igen'],
});

const MATERIAL = 'studio_room_game_material_unavailable';
/** Hindrets nyckel: materialskälet för materialhinder, annars koden. Godtar kod eller {code, materialReason}. */
export function blockerKey(blocker) {
  const value = typeof blocker === 'string' ? {code:blocker} : blocker ?? {};
  return value.code === MATERIAL ? value.materialReason ?? MATERIAL : value.code;
}
export const hasBlockerText = blocker => {
  const key = blockerKey(blocker) ?? '';
  return (typeof blocker === 'object' && blocker?.code === MATERIAL) || /^native_material_/.test(key) || Object.hasOwn(BLOCKER_TEXT, key);
};

function view(text, target, ctx, title) {
  const row = targets[target] ?? targets.igen, href = row.href(ctx);
  return {text, href, linkLabel:href || !row.missing ? row.label : row.missing, title};
}
const fallback = title => ({text:BLOCKER_FALLBACK, href:null, linkLabel:targets.igen.label, title});
const named = value => typeof value === 'string' && value.trim() ? value.trim() : '';

/**
 * En mening och en åtgärd för ett hinder. `ctx`: {roomId, dealerId, dealerName, rooms}.
 * @returns {{text:string;href:string|null;linkLabel:string;title:string}}
 */
export function blockerText(blocker, ctx = {}) {
  const value = typeof blocker === 'string' ? {code:blocker} : blocker ?? {};
  const key = blockerKey(value), title = [value.code, value.materialReason ?? value.reason].filter(Boolean).join(' · ');
  if (Object.hasOwn(BLOCKER_TEXT, key ?? '')) return view(...BLOCKER_TEXT[key], ctx, title);
  const material = Object.hasOwn(MATERIAL_REASON_TEXT, key ?? '') ? MATERIAL_REASON_TEXT[key]
    : key === MATERIAL || /^native_material_/.test(key ?? '') ? ['har material som inte är komplett', 'tal'] : null;
  if (!material) return fallback(title);
  // Ett annat öppet spelbord som binds om: länken går till det spelbordet.
  if (value.area === 'rooms' && id(value.roomId)) {
    const name = named((ctx.rooms ?? []).find(row => row?.id === value.roomId)?.name) || 'ett annat spelbord';
    return {text:'Spelbordet ' + name + ' kan inte bindas om: dealern ' + material[0] + '.', href:roomHref(value.roomId, 'spel'), linkLabel:'Öppna spelbordet', title};
  }
  return view('Spelbordet kan inte publiceras än: ' + (named(ctx.dealerName) || 'dealern') + ' ' + material[0] + '.', material[1], ctx, title);
}

// En kod, ett ensamt ord ("Hinder.") eller ingen text alls är ingen mening för användaren.
const leaks = text => typeof text !== 'string' || !/\S\s+\S/.test(text.trim()) || /[a-z0-9]_[a-z0-9]/i.test(text);
/**
 * Som blockerText, men hinder utanför tabellen går till `other` (till exempel roomReleaseBlocker).
 * En text som ser ut som en kod byts mot BLOCKER_FALLBACK.
 */
export function blockerView(blocker, ctx = {}, other = null) {
  if (hasBlockerText(blocker) || typeof other !== 'function') return blockerText(blocker, ctx);
  const result = other(blocker, ctx) ?? {}, title = [blocker?.code, blocker?.reason].filter(Boolean).join(' · ');
  if (leaks(result.text)) return fallback(title);
  return {text:result.text, href:result.href ?? null, linkLabel:result.linkLabel || targets.igen.label, title};
}
