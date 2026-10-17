import { normalizeRecordedSpeech, recordedSpeechForVideo } from '../../packages/presentation/contracts/recorded-speech.mjs';
import { SPEECH_LINES } from '../../packages/presentation/contracts/speech-lines.mjs';
import { ASTRID_VOICE_PROFILE } from './astrid-voice-profile.mjs';
import { normalizeDealerSpeechProfile, validateDealerSpeechReference } from '../../packages/presentation/contracts/dealer-speech-profile.mjs';

// New generation templates. Existing recorded banks retain their own exact
// captions; choosing Swedish never relabels or approves English recorded media.
const swedish = Object.freeze({
  greeting: 'Välkommen till Privé Blackjack. Slå dig ner, jag är din dealer i kväll.',
  placebets: 'Lägg era insatser, tack.',
  goodluck: 'Insatserna är stängda. Lycka till vid mitt bord!',
  insurance: 'Försäkringen är öppen. Vill du försäkra din hand?',
  peek: 'Låt mig ta en titt på min hand.',
  blackjack: 'Blackjack! Vackert spelat. Grattis!',
  bust: 'Över tjugoett. Tyvärr, den handen är över.',
  dealerbust: 'Dealern är över tjugoett! Grattis, bordet vinner.',
  win: 'Bra spelat! Njut av din vinst.',
  lose: 'Dealern vinner den här gången. Bättre lycka nästa runda.',
  push: 'Det är lika. Din insats betalas tillbaka.',
  dealerblackjack: 'Dealern har blackjack. Den här rundan går till huset.',
  sidebet: 'Ditt sidospel ger vinst! Snyggt gjort.',
  chatter1: 'Korten har varit snälla i kväll.',
  chatter2: 'Ta god tid på dig. Det är ingen brådska vid mitt bord.',
  farewell: 'Tack för att du spelade med mig. Välkommen tillbaka snart.',
  double: 'Du dubblar. Ett kort, nu gör vi det bästa av det.',
});
const labels = {greeting:'Välkommen',placebets:'Lägg insatser',goodluck:'Lycka till',insurance:'Försäkring',peek:'Kontrollera handen',blackjack:'Blackjack',bust:'Över 21',dealerbust:'Dealern över 21',win:'Vinst',lose:'Förlust',push:'Lika',dealerblackjack:'Dealerns blackjack',sidebet:'Sidospel',chatter1:'Småprat 1',chatter2:'Småprat 2',farewell:'Tack för spelet',double:'Dubbling'};
export const STUDIO_SPEECH_TEMPLATE_REVISION = 'studio-sv-en-v1';
export const STUDIO_SPEECH_LINES = Object.freeze(Object.entries(SPEECH_LINES).map(([id,en]) => Object.freeze({id,label:labels[id],en,sv:swedish[id]})));
const neutralLineIds=Object.freeze(['placebets','goodluck','chatter2','farewell']);
// These are unchanged library captions, not a Roulette event/trigger contract.
// greeting names Blackjack; chatter1 refers to cards in both source languages.
export function studioSpeechLineIds(game='blackjack'){
  if(!['blackjack','roulette'].includes(game))throw Error('studio_speech_game_invalid');
  return game==='roulette'?[...neutralLineIds]:STUDIO_SPEECH_LINES.map(row=>row.id);
}
export const STUDIO_ASTRID_VOICE = Object.freeze({dealerId:'astrid',name:ASTRID_VOICE_PROFILE.name,provider:'cartesia',voiceId:ASTRID_VOICE_PROFILE.voiceId,modelId:ASTRID_VOICE_PROFILE.modelId,profileRevision:ASTRID_VOICE_PROFILE.profileRevision,source:'web/public/astrid-voice-profile.mjs'});
export function studioSpeechLines(language, ids = STUDIO_SPEECH_LINES.map(row=>row.id)) {
  if (!['sv','en'].includes(language) || !Array.isArray(ids) || !ids.length || ids.length > 17 || new Set(ids).size !== ids.length) throw Error('studio_speech_selection_invalid');
  return ids.map(id=>{const row=STUDIO_SPEECH_LINES.find(item=>item.id===id);if(!row||typeof row[language]!=='string'||!row[language])throw Error('studio_speech_selection_invalid');return {id,label:row.label,language,exactText:row[language]};});
}
export function studioSpeechBuildCompatibility(project,dealerId) {
  const dealer=project.dealers.find(row=>row.id===dealerId);
  if(!dealer)return {supported:false,message:'Dealern saknas i det sparade projektet.'};
  if(dealerId!=='astrid')return {supported:false,message:'Filbygget har endast en verifierbar Astrid/Victoria-koppling. Denna dealers strömmande talprofil används inte som filbyggare.'};
  const voice=dealer.speechProfile?.voice;
  if(voice&&(voice.provider!==STUDIO_ASTRID_VOICE.provider||voice.voiceId!==STUDIO_ASTRID_VOICE.voiceId||voice.modelId!==STUDIO_ASTRID_VOICE.modelId||voice.settings||voice.language))return {supported:false,message:'Den sparade rösten skiljer sig från Astrid/Victoria-kedjan. Ingen annan röst ersätts automatiskt.'};
  // The fullfile worker has a fixed Astrid avatar, not the arbitrary reference
  // selected for registered streaming profiles.
  if(dealer.speechProfile?.reference)return {supported:false,message:'Den valda referensen hör till strömmande tal. Filbyggaren kan inte verifiera den mot sin fasta Astrid-avatar.'};
  return {supported:true,message:'Befintlig Astrid/Victoria-förhandsvisning: Cartesia-röst och läppsynk på RunPod. Varje nytt talset kräver granskning.'};
}
export function applyStudioSpeechProfile(project,inventory,dealerId,input) {
  if(!project.dealers.some(row=>row.id===dealerId))throw Error('studio_speech_dealer_missing');
  const speechProfile=normalizeDealerSpeechProfile(input);
  if(speechProfile.reference)validateDealerSpeechReference(speechProfile,inventory.videos.find(row=>row.id===speechProfile.reference.videoId),dealerId);
  return {...project,dealers:project.dealers.map(row=>row.id===dealerId?{...row,speechProfile}:row)};
}
export function studioSpeechMediaUrl(value) {
  // Protected application routes only; never provider URLs or credentials.
  if(typeof value!=='string'||!/^\/(?:studio\/)?api\/(?:speech-build\?media=[a-f0-9]{32}&kind=(?:audio|video)|videos\/[A-Za-z0-9._:-]+|replies\/[a-f0-9-]+\/(?:audio|video)(?:\?dealer=[a-z][a-z0-9-]*)?)$/.test(value))return null;
  return value;
}

// Registry rows are recordings, not generation templates or voice presets.
// Keep broken/unreviewed files visible; never infer acceptance from a label.
export function studioRecordedSpeech(project,inventory,dealerId,game='blackjack') {
  if(!['blackjack','roulette'].includes(game))throw Error('studio_speech_game_invalid');
  return inventory.videos.filter(video=>{
    const metadata=video.classification;
    return metadata?.dealerId===dealerId&&!metadata.archived&&!video.archived&&(!video.dealer||video.dealer===dealerId)&&metadata.mediaType!=='image'
      &&(metadata.kind==='speech'||metadata.recordedSpeech)
      &&(game==='roulette'?metadata.game==='roulette':metadata.game!=='roulette');
  }).map(video=>{
    const metadata=video.classification,declared=metadata.recordedSpeech;
    let speech=null,review='missing-proof';
    if(declared)try{
      speech=normalizeRecordedSpeech(declared,{dealerId,lineId:metadata.situation,videoSha256:video.sha256});
      review=speech.review.status==='rejected'?'rejected':speech.recording.status==='verified-recording'&&speech.review.status==='approved'
        ?recordedSpeechForVideo(video,{dealerId,lineId:speech.lineId,language:speech.language})?'approved':video.available===false?'unavailable':'invalid-proof':'pending';
    }catch{review='invalid-proof';}
    const url=studioSpeechMediaUrl(video.previewUrl),audio=metadata.mediaType==='audio'||video.contentType?.startsWith('audio/');
    return {id:video.id,label:project.clipLabels?.[video.id]??video.label,situation:metadata.situation,
      lineLabel:STUDIO_SPEECH_LINES.find(row=>row.id===metadata.situation)?.label??metadata.situation,
      exactText:typeof declared?.exactText==='string'?declared.exactText:'',language:typeof declared?.language==='string'?declared.language:'',
      available:video.available===true&&video.integrity!=='unavailable'&&Boolean(url),url,audio:Boolean(audio),
      contentType:video.contentType??'',sha256:video.sha256??'',speech,review};
  }).sort((a,b)=>a.lineLabel.localeCompare(b.lineLabel,'sv')||a.label.localeCompare(b.label,'sv')||a.id.localeCompare(b.id));
}
