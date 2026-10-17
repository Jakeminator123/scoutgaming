import { SPEECH_LINES } from '../../../../../packages/presentation/contracts/speech-lines.mjs';
const captions = { greeting:'Välkommen', placebets:'Lägg insatser', goodluck:'Lycka till', insurance:'Försäkring', double:'Dubbling', peek:'Kontrollera kort', blackjack:'Blackjack', dealerblackjack:'Dealerns blackjack', bust:'Spelaren över 21', dealerbust:'Dealern över 21', win:'Vinst', push:'Lika', lose:'Förlust', sidebet:'Sidospel', chatter1:'Småprat 1', chatter2:'Småprat 2', farewell:'Tack för spelet', 'to-shoe':'Till skon', 'from-shoe':'Från skon', 'dealer-up':'Öppet kort', 'dealer-hole':'Dolt kort' };
const results = new Set(['blackjack','dealerblackjack','bust','dealerbust','win','push','lose','sidebet']);
export function slotCaption(slot) { return ({VILA:'VILA-bild',breathing:'Andningsvila','glasses-clean':'Glasögonvariation','wheel-start':'Hjulstart och kulsläpp'})[slot.situation] ?? captions[slot.situation] ?? (/^box[0-6]$/.test(slot.situation) ? `Plats ${Number(slot.situation.slice(3))+1}` : slot.title); }
export function isRenderedOutcome(slot) { return slot.game==='roulette' && slot.eventId==='roulette.plan.outcome'; }
export function slotExplanation(slot) {
  if(slot.game==='roulette')return ({
    'roulette.reference':'Stillbild för att jämföra dealerns vilopose.',
    'roulette.idle':slot.situation==='breathing'?'Dealern väntar mellan rundorna.':'Kort variation medan bordet väntar.',
    'roulette.wheel-start':'Dealern sätter hjulet i rörelse och släpper kulan.',
    'roulette.plan.betting':'Tal före rundan: välkommen, insatser och sista chansen att satsa.',
    'roulette.plan.outcome':'Hjulet och kulan visar det vinnande numret.',
    'roulette.plan.result':'Tal om resultatet, följt av återgång till vila.',
  })[slot.eventId]??slot.title;
  if(slot.sourceType==='speak')return ({
    goodluck:'Startfras när insatserna är klara.',insurance:'Tal när försäkring erbjuds.',double:'Bekräftelse på spelarens dubbling.',
    greeting:'Välkomsthälsning vid bordet.',placebets:'Uppmaning att lägga nästa insats.',peek:'Tal medan dealern kontrollerar korten.',
    blackjack:'Tal vid spelarens blackjack.',dealerblackjack:'Tal vid dealerns blackjack.',bust:'Tal när spelaren går över 21.',
    dealerbust:'Tal när dealern går över 21.',win:'Tal vid vinst.',push:'Tal vid oavgjort.',lose:'Tal vid förlust.',
    sidebet:'Tal om ett sidospel.',chatter1:'Småprat vid bordet.',chatter2:'Småprat vid bordet.',farewell:'Avslutande hälsning.',
  })[slot.situation]??'Tal vid den valda spelsituationen.';
  if(slot.eventId.startsWith('deal.player.')&&/^box[0-6]$/.test(slot.situation))return `När ett kort delas till spelarplats ${Number(slot.situation.slice(3))+1}.`;
  if(slot.eventId==='deal.dealer')return slot.situation==='dealer-hole'?'När dealerns dolda kort delas.':'När dealerns öppna kort delas.';
  if(slot.eventId==='transition.shoe')return slot.situation==='from-shoe'?'Dealern återgår till vila efter sista kortet.':'Dealern gör sig redo före första kortet.';
  return ({'idle.ready':'Dealern väntar mellan spelhändelserna.','reveal.dealer':'När dealerns dolda kort vänds upp.',
    'turn.player':'Spelarens tur att välja nästa drag.','settle.blackjack':'Rundan avslutas med blackjack.',
    'settle.dealerBust':'Rundan avslutas när dealern har gått över 21.','settle.win':'Rundan avslutas med vinst.',
    'settle.push':'Rundan avslutas oavgjort.','settle.other':'Rundan avslutas med övrigt resultat, till exempel förlust.',
  })[slot.eventId]??slot.title;
}
export function slotSpeech(slot) { return slot.sourceType === 'speak' ? SPEECH_LINES[slot.situation] ?? '' : ''; }
export function groupSlots(slots) {
  if(slots.some(slot=>slot.game==='roulette'))return [
    ['roulette-reference','Vila','Referensbild','#d6ff3a','roulette.reference'],
    ['roulette-idle','Vänta','Dealer · grundloop','#d6ff3a','roulette.idle'],
    ['roulette-betting','Insatser','Dealer · tal','#9d8cff','roulette.plan.betting'],
    ['roulette-start','Starta','Dealer · kulsläpp','#3ad6c4','roulette.wheel-start'],
    ['roulette-outcome','Hjul','Bord · 37 utfall','#ffb547','roulette.plan.outcome'],
    ['roulette-result','Resultat','Dealer · tillbaka till vila','#9d8cff','roulette.plan.result'],
  ].map(([id,title,subtitle,color,eventId])=>({id,title,subtitle,color,slots:slots.filter(slot=>slot.game==='roulette'&&slot.eventId===eventId)})).filter(group=>group.slots.length);
  const definitions = [
    ['wait','Vänta','Grundloop','#d6ff3a',slot=>slot.sourceType==='idle'],
    ['ready','Redo','Till / från skon','#3ad6c4',slot=>slot.sourceType==='transition'],
    ['players','Deal','Spelarplatser','#ffb547',slot=>slot.eventId.startsWith('deal.player.')],
    ['dealer','Deal','Dealerns kort','#ffb547',slot=>slot.eventId==='deal.dealer'],
    ['reveal','Visa','Vänd kort','#ff7a59',slot=>slot.sourceType==='reveal'],
    ['table-talk','Tal','Vid bordet','#9d8cff',slot=>slot.sourceType==='speak'&&!results.has(slot.situation)],
    ['result-talk','Tal','Resultat','#9d8cff',slot=>slot.sourceType==='speak'&&results.has(slot.situation)],
    ['game','Spel','Tur & resultat','#a3a8b0',slot=>['turn','settle'].includes(slot.sourceType)],
  ];
  return definitions.map(([id,title,subtitle,color,matches])=>({id,title,subtitle,color,slots:slots.filter(matches)})).filter(group=>group.slots.length);
}
export function layoutClipCards(cards, canvasWidth, positions = {}, minimumRowStep = 355) {
  const columns = canvasWidth < 610 ? 1 : canvasWidth < 1100 ? 2 : 4;
  const layout = {};
  let y = 0;
  for (let start = 0; start < cards.length; start += columns) {
    const row = cards.slice(start, start + columns);
    let rowStep = minimumRowStep;
    row.forEach((card, column) => {
      layout[card.id] = positions[card.id] ?? { x: column * 306, y };
      if (Number.isFinite(card.height) && card.height > 0) rowStep = Math.max(rowStep, card.height + 26);
    });
    y += rowStep;
  }
  return layout;
}
export function affectedRooms(before, after, rooms) {
  const changedDealers = new Set(after.dealers.filter(dealer =>
    JSON.stringify(before.lines.filter(line=>line.dealerId===dealer.id))!==JSON.stringify(after.lines.filter(line=>line.dealerId===dealer.id))
    || JSON.stringify(before.dealerIdlePolicies?.find(row=>row.dealerId===dealer.id))!==JSON.stringify(after.dealerIdlePolicies?.find(row=>row.dealerId===dealer.id))
    || JSON.stringify(before.dealers.find(row=>row.id===dealer.id))!==JSON.stringify(dealer)
  ).map(dealer=>dealer.id));
  for (const id of new Set([...(before.mediaPolicy??[]).map(row=>row.familyId),...(after.mediaPolicy??[]).map(row=>row.familyId)])) if (JSON.stringify(before.mediaPolicy?.find(row=>row.familyId===id))!==JSON.stringify(after.mediaPolicy?.find(row=>row.familyId===id))) changedDealers.add(id.split('/')[0]);
  if (JSON.stringify(before.idlePolicy)!==JSON.stringify(after.idlePolicy)) changedDealers.add(after.idlePolicy?.familyId?.split('/')[0] ?? before.idlePolicy?.familyId?.split('/')[0]);
  const changedTriggers=new Set([...before.triggers,...after.triggers].filter(trigger=>JSON.stringify(before.triggers.find(row=>row.id===trigger.id))!==JSON.stringify(after.triggers.find(row=>row.id===trigger.id))).map(trigger=>trigger.id));
  for(const line of [...before.lines,...after.lines])if(line.variants.some(variant=>variant.triggerIds.some(id=>changedTriggers.has(id))))changedDealers.add(line.dealerId);
  const changedLanes = new Set((after.lanes ?? []).filter(lane=>JSON.stringify(before.lanes?.find(row=>row.id===lane.id))!==JSON.stringify(lane)).map(lane=>lane.id));
  return rooms.filter(room=>room.dealerIds.some(id=>changedDealers.has(id))||changedLanes.has(room.compositionId));
}
