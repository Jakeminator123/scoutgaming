import catalog from '../../../packages/presentation/contracts/dealer-voice-catalog.json' with {type:'json'};
import {ASTRID_VOICE_PROFILE} from '../../../packages/presentation/contracts/astrid-voice-profile.mjs';

// This catalog contains public identities, never account credentials or runtime
// readiness. Defaults and selections change only the draft, never activation.
export const DEALER_VOICE_PRESETS = Object.freeze([
  ...catalog.voices.map(row=>Object.freeze({id:row.id,label:row.label,provider:row.provider,aliases:Object.freeze([...row.aliases])})),
  Object.freeze({id:'astrid-victoria',label:'Astrid · Victoria',provider:'cartesia',aliases:Object.freeze(['astrid'])}),
]);
export function dealerVoicePreset(id, language='sv') {
  if(!/^[a-z]{2}$/.test(language))throw Error('Välj en språkkod med två bokstäver.');
  if(id==='astrid-victoria')return {provider:'cartesia',voiceId:ASTRID_VOICE_PROFILE.voiceId,modelId:ASTRID_VOICE_PROFILE.modelId};
  const row=catalog.voices.find(row=>row.id===id);
  if(!row)throw Error('Okänd röst.');
  const variant=row.languages?.[language]??row.default;
  return {provider:row.provider,voiceId:row.voiceId,modelId:variant.modelId,language,settings:{...variant.settings}};
}
export function dealerVoiceDraft(voice) {
  return {provider:voice?.provider??'',voiceId:voice?.voiceId??'',modelId:voice?.modelId??'',language:voice?.language??'',
    customSettings:Boolean(voice?.settings),stability:String(voice?.settings?.stability??''),similarity:String(voice?.settings?.similarity_boost??''),
    style:String(voice?.settings?.style??''),speakerBoost:voice?.settings?.use_speaker_boost===undefined?'':String(voice.settings.use_speaker_boost)};
}
export function dealerVoiceFromDraft(draft) {
  if(!draft.provider&&!draft.voiceId.trim()&&!draft.modelId.trim())return null;
  return {provider:draft.provider,voiceId:draft.voiceId.trim(),modelId:draft.modelId.trim(),
    ...(draft.provider==='elevenlabs'&&draft.language.trim()?{language:draft.language.trim()}:{}),
    ...(draft.provider==='elevenlabs'&&draft.customSettings?{settings:{
      ...(draft.stability.trim()?{stability:Number(draft.stability)}:{}),
      ...(draft.similarity.trim()?{similarity_boost:Number(draft.similarity)}:{}),
      ...(draft.style.trim()?{style:Number(draft.style)}:{}),
      ...(draft.speakerBoost?{use_speaker_boost:draft.speakerBoost==='true'}:{}),
    }}:{})};
}
export function matchingDealerVoicePreset(draft) {
  const language=draft.language||'sv';
  if(!/^[a-z]{2}$/.test(language))return null;
  return DEALER_VOICE_PRESETS.find(row=>JSON.stringify(dealerVoiceDraft(dealerVoicePreset(row.id,language)))===JSON.stringify(draft))?.id??null;
}
export function suggestedDealerVoicePreset(dealer) {
  const identities=[dealer?.id,dealer?.label].filter(value=>typeof value==='string').map(value=>value.trim().toLocaleLowerCase('sv'));
  const matches=DEALER_VOICE_PRESETS.filter(row=>row.aliases.some(alias=>identities.includes(alias)));
  return matches.length===1?matches[0].id:null;
}
// Jakob explicitly paired these original voices with their dealers. A saved
// voice wins; ambiguous names and unrelated dealers never inherit a voice.
export function initialDealerVoiceDraft(dealer,voice) {
  const preset=suggestedDealerVoicePreset(dealer);
  return dealerVoiceDraft(voice??(['paow','dragge'].includes(preset)?dealerVoicePreset(preset):null));
}
