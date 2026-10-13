// Intake vocabulary only. These slots cannot become blackjack runtime events
// or activate a published room merely because a file was registered.
export const ROULETTE_MEDIA_EVENTS = Object.freeze([
  {id:'roulette.reference',label:'Roulette · VILA-bild',sourceType:'idle',situations:['VILA']},
  {id:'roulette.idle',label:'Roulette · vila',sourceType:'idle',situations:['breathing','glasses-clean']},
  {id:'roulette.wheel-start',label:'Roulette · hjulstart',sourceType:'transition',situations:['wheel-start']},
]);
export const rouletteMediaEvent = id => ROULETTE_MEDIA_EVENTS.find(event=>event.id===id);
export function dealerMediaEvents(project) {
  return [...project.events,...ROULETTE_MEDIA_EVENTS.filter(event=>!project.events.some(row=>row.id===event.id))];
}
export function rouletteMediaDefaults(eventId,situation) {
  return {game:'roulette',action:eventId==='roulette.reference'?'reference':situation,
    startPose:eventId==='roulette.reference'?'VILA':'unverified',endPose:eventId==='roulette.reference'?'VILA':'unverified'};
}
export function validateRouletteMedia(input) {
  const event=rouletteMediaEvent(input.eventId);
  if(!event) {
    if(['game','action','startPose','endPose'].some(key=>input[key]!==undefined))throw Error('Roulettens poser och handlingar får inte användas i blackjackfack.');
    return;
  }
  const expected=rouletteMediaDefaults(input.eventId,input.situation);
  if(input.game!==expected.game||input.action!==expected.action||!event.situations.includes(input.situation)
    ||!['VILA','WHEEL','unverified'].includes(input.startPose)||!['VILA','WHEEL','unverified'].includes(input.endPose)
    ||(input.mediaType==='image')!==(input.eventId==='roulette.reference')
    ||input.mediaType==='audio'||input.familyId)throw Error('Välj roulettens exakta handling och ange start-/slutpose. VILA-bilden har ett eget referensfack.');
  if(input.eventId==='roulette.reference'&&(input.startPose!=='VILA'||input.endPose!=='VILA'))throw Error('VILA-referensen ska ange VILA i båda posefälten.');
}
