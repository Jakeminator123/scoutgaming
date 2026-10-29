import catalog from './dealer-voice-catalog.json' with {type:'json'};
import {normalizeDealerSpeechProfile} from './dealer-speech-profile.mjs';

// Röstprofil: the dealer's saved voice in the Studio project document
// (dealers[].speechProfile.voice, Neon croupier_studio.documents). The
// catalog only suggests Jakob's confirmed original voices; it is never runtime
// authority. A voice id is a public provider identity, never a credential.
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const VOICE_ID = /^[A-Za-z0-9]{20}$/;
const MODEL_ID = /^eleven_[a-z0-9_]{1,60}$/;
export const DEALER_VOICE_DEFAULT_MODEL = 'eleven_multilingual_v2';
const invalid = () => Object.assign(Error('studio_dealer_voice_invalid'), {code:'studio_dealer_voice_invalid', statusCode:422});

export function validElevenLabsVoiceId(value) { return typeof value === 'string' && VOICE_ID.test(value); }
export function validElevenLabsModelId(value) { return typeof value === 'string' && MODEL_ID.test(value); }

function catalogVariant(voiceId, modelId) {
  const row = catalog.voices.find(item => item.provider === 'elevenlabs' && item.voiceId === voiceId);
  if (!row) return null;
  for (const [language, variant] of Object.entries(row.languages ?? {})) if (variant.modelId === modelId) return {language, settings:variant.settings};
  return row.default.modelId === modelId ? {settings:row.default.settings} : null;
}

/** Normalizes an Admin "Ändra" request into a speechProfile.voice. Explicit
 * fields win; omitted tuning is kept only for the same voice and model. */
export function dealerVoiceFromRequest(input, current = null) {
  if (!object(input) || Object.keys(input).some(key => !['provider','voiceId','modelId','language','settings'].includes(key))) throw invalid();
  if (input.provider !== 'elevenlabs' || !validElevenLabsVoiceId(input.voiceId)) throw invalid();
  if (input.modelId !== undefined && !validElevenLabsModelId(input.modelId)) throw invalid();
  const same = current?.provider === 'elevenlabs' && current.voiceId === input.voiceId;
  const modelId = input.modelId ?? (same ? current.modelId : catalog.voices.find(row => row.voiceId === input.voiceId)?.default.modelId ?? DEALER_VOICE_DEFAULT_MODEL);
  if (!validElevenLabsModelId(modelId)) throw invalid();
  const kept = same && current.modelId === modelId ? {language:current.language, settings:current.settings} : catalogVariant(input.voiceId, modelId) ?? {};
  const language = input.language ?? kept.language, settings = input.settings ?? kept.settings;
  const voice = {provider:'elevenlabs', voiceId:input.voiceId, modelId,
    ...(language === undefined ? {} : {language}), ...(settings === undefined ? {} : {settings:{...settings}})};
  try { return normalizeDealerSpeechProfile({schemaVersion:2, state:'preparation', voice, reference:null}).voice; }
  catch { throw invalid(); }
}

/** Writes only the voice. State and reference stay; an enabled session sees
 * a new profile revision and must verify the new voice before speaking. */
export function applyDealerVoiceProfile(project, dealerId, voice) {
  const matches = project?.dealers?.filter(row => row.id === dealerId) ?? [];
  if (matches.length !== 1) throw Object.assign(Error('studio_dealer_missing'), {code:'studio_dealer_missing', statusCode:409});
  const saved = matches[0].speechProfile ? normalizeDealerSpeechProfile(matches[0].speechProfile) : null;
  const next = dealerVoiceFromRequest(voice, saved?.voice ?? null);
  const speechProfile = normalizeDealerSpeechProfile({schemaVersion:2, state:saved?.state ?? 'preparation', voice:next, reference:saved?.reference ?? null});
  return {...project, dealers:project.dealers.map(row => row.id === dealerId ? {...row, speechProfile} : row)};
}

function catalogRowFor(dealer) {
  const names = [dealer?.id, dealer?.label].filter(value => typeof value === 'string').map(value => value.trim().toLocaleLowerCase('sv'));
  const rows = catalog.voices.filter(row => row.aliases.some(alias => names.includes(alias)));
  return rows.length === 1 ? rows[0] : null;
}

/** What Admin shows under the dealer: the saved profile, else the catalog's
 * confirmed voice for this dealer as an unsaved suggestion (today's value). */
export function dealerVoiceProfileView(dealer) {
  let saved = null;
  try { saved = dealer?.speechProfile ? normalizeDealerSpeechProfile(dealer.speechProfile).voice : null; } catch { saved = null; }
  const name = voiceId => catalog.voices.find(row => row.voiceId === voiceId)?.label ?? null;
  if (saved) return {source:'saved', name:name(saved.voiceId), provider:saved.provider, voiceId:saved.voiceId, modelId:saved.modelId};
  const row = catalogRowFor(dealer);
  if (row) return {source:'catalog', name:row.label, provider:row.provider, voiceId:row.voiceId, modelId:row.languages?.sv?.modelId ?? row.default.modelId};
  return {source:'none', name:null, provider:null, voiceId:null, modelId:null};
}
