import { normalizeRecordedSpeech, recordedSpeechForVideo, recordedSpeechIdentity, recordedSpeechSourceVerified } from '../../../packages/presentation/contracts/recorded-speech.mjs';
import { SPEECH_LINES } from '../../../packages/presentation/contracts/speech-lines.mjs';
import { ASTRID_VOICE_PROFILE } from '../../../packages/presentation/contracts/astrid-voice-profile.mjs';
import { normalizeDealerSpeechProfile, validateDealerSpeechReference } from '../../../packages/presentation/contracts/dealer-speech-profile.mjs';

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
      review=speech.review.status==='rejected'?'rejected':recordedSpeechSourceVerified(speech)&&speech.review.status==='approved'
        ?recordedSpeechForVideo(video,{dealerId,lineId:speech.lineId,language:speech.language})?'approved':video.available===false?'unavailable':'invalid-proof':'pending';
    }catch{review='invalid-proof';}
    const url=studioSpeechMediaUrl(video.previewUrl),audio=metadata.mediaType==='audio'||video.contentType?.startsWith('audio/');
    // Imported takes without a receipt carry language and take only in the
    // import note; that is display grouping, never a review identity.
    const notes=typeof metadata.notes==='string'?metadata.notes:'',declaredLanguage=typeof declared?.language==='string'?declared.language:'';
    const notedLanguage=declaredLanguage?'':notes.match(notedLanguagePattern)?.[1]??'',notedTake=notes.match(notedTakePattern)?.[1];
    return {id:video.id,label:project.clipLabels?.[video.id]??video.label,situation:metadata.situation,
      lineLabel:STUDIO_SPEECH_LINES.find(row=>row.id===metadata.situation)?.label??metadata.situation,
      exactText:typeof declared?.exactText==='string'?declared.exactText:'',language:declaredLanguage||notedLanguage,languageNoted:Boolean(notedLanguage),
      take:takeNumber(declared?.takeId)??(notedTake?Number(notedTake):null)??takeNumber(metadata.label)??takeNumber(video.label),
      available:video.available===true&&video.integrity!=='unavailable'&&Boolean(url),url,audio:Boolean(audio),
      contentType:video.contentType??'',sha256:video.sha256??'',speech,review};
  }).sort((a,b)=>a.lineLabel.localeCompare(b.lineLabel,'sv')||a.label.localeCompare(b.label,'sv')||a.id.localeCompare(b.id));
}
const notedLanguagePattern=/(?:^|\s)Språk i (?:källan|filnamnet): ([a-z]{2,3})\./,notedTakePattern=/(?:^|\s)Tagning (\d{1,3}) enligt (?:källan|filnamnet)\./;
function takeNumber(value){const match=typeof value==='string'?value.match(/(?:^|[_\-\s])(\d{1,3})(?:\.[a-z0-9]{2,4})?$/i):null;return match?Number(match[1]):null;}
// The round's own lines in play order; equals NATIVE_ROOM_SPEECH_SLOTS as a set.
const blackjackGameLineIds=Object.freeze(['placebets','goodluck','blackjack','dealerblackjack','dealerbust','double','insurance','lose','push','win']);
export function studioRecordedSpeechGameLineIds(game='blackjack'){
  if(!['blackjack','roulette'].includes(game))throw Error('studio_speech_game_invalid');
  return game==='roulette'?[...neutralLineIds]:[...blackjackGameLineIds];
}
// One row per replikplats: the game's lines always (gaps stay visible), other
// catalogue lines only when files exist. Svenska and English are always offered;
// the highest take number is first. Unmappable files stay under `other`.
export function studioRecordedSpeechGroups(rows,game='blackjack'){
  const base=studioRecordedSpeechGameLineIds(game),order=[...base,...STUDIO_SPEECH_LINES.map(row=>row.id).filter(id=>!base.includes(id))];
  const lines=order.map(id=>({id,label:labels[id],game:base.includes(id),languages:[{language:'sv',takes:[]},{language:'en',takes:[]}]})),other=[];
  for(const row of rows){
    const line=lines.find(item=>item.id===row.situation),language=row.language.split('-')[0];
    if(!line||!language){other.push(row);continue;}
    let group=line.languages.find(item=>item.language===language);
    if(!group)line.languages.push(group={language,takes:[]});
    group.takes.push(row);
  }
  const byLabel=(a,b)=>a.label.localeCompare(b.label,'sv')||a.id.localeCompare(b.id);
  for(const line of lines)for(const group of line.languages)group.takes.sort((a,b)=>(b.take??-1)-(a.take??-1)||byLabel(a,b));
  return {lines:lines.filter(line=>line.game||line.languages.some(group=>group.takes.length)),other:other.sort(byLabel)};
}
// Open a line on the take worth acting on, not merely the newest file: the
// talfack standard, else approved, else a receipt awaiting review, else the
// highest number. Takes arrive highest-first, so find() keeps that tie-break.
export function studioRecordedSpeechPreferredTake(takes,standardId=null){
  return takes.find(row=>standardId&&row.id===standardId)??takes.find(row=>row.available&&row.review==='approved')
    ??takes.find(row=>row.speech&&row.review==='pending')??takes[0];
}
const speechTime=at=>{const date=new Date(at);return Number.isFinite(date.getTime())?date.toLocaleString('sv-SE'):at;};
export function studioRecordedSpeechStatus(row,formatTime=speechTime){
  const review=row.speech?.review;
  if(row.review==='approved')return `Godkänd av ${review.by} · ${formatTime(review.at)}`;
  if(row.review==='rejected')return review?.by?`Underkänd av ${review.by} · ${formatTime(review.at)}`:'Underkänd';
  if(row.review==='pending')return 'Väntar på granskning';
  if(row.review==='missing-proof')return 'Saknar talkvitto';
  if(row.review==='unavailable')return 'Filen är otillgänglig';
  return 'Talkvittot matchar inte filen';
}
// Generated speech (file build or realtime) needs a verified voice coupling:
// today the Astrid build chain or a profile saved as enabled.
export function studioGeneratedSpeechAvailable(project,dealerId){
  return studioSpeechBuildCompatibility(project,dealerId).supported||project.dealers.find(row=>row.id===dealerId)?.speechProfile?.state==='enabled';
}
// Body for POST /studio/api/videos/speech-review. The client names only the
// exact take identity it played; the server rechecks it and stamps who and when.
export function studioRecordedSpeechReviewRequest(row,dealerId,verdict) {
  if(!row?.speech||!['approved','rejected',null].includes(verdict)||typeof row.sha256!=='string'||!/^[a-f0-9]{64}$/.test(row.sha256))throw Error('studio_speech_review_invalid');
  return {id:row.id,sha256:row.sha256,dealerId,lineId:row.speech.lineId,language:row.speech.language,expectedIdentity:recordedSpeechIdentity(row.speech),verdict};
}
