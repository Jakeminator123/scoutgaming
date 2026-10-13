import { SPEECH_LINES } from '../../../../web/public/speech-lines.mjs';
const captions = { greeting:'Välkommen', placebets:'Lägg insatser', goodluck:'Lycka till', insurance:'Försäkring', double:'Dubbling', peek:'Kontrollera kort', blackjack:'Blackjack', dealerblackjack:'Dealerns blackjack', bust:'Spelaren över 21', dealerbust:'Dealern över 21', win:'Vinst', push:'Lika', lose:'Förlust', sidebet:'Sidospel', chatter1:'Småprat 1', chatter2:'Småprat 2', farewell:'Tack för spelet', 'to-shoe':'Till skon', 'from-shoe':'Från skon', 'dealer-up':'Öppet kort', 'dealer-hole':'Dolt kort' };
const results = new Set(['blackjack','dealerblackjack','bust','dealerbust','win','push','lose','sidebet']);
export function slotCaption(slot) { return captions[slot.situation] ?? (/^box[0-6]$/.test(slot.situation) ? `Plats ${Number(slot.situation.slice(3))+1}` : slot.title); }
export function slotSpeech(slot) { return slot.sourceType === 'speak' ? SPEECH_LINES[slot.situation] ?? '' : ''; }
export function groupSlots(slots) {
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
export function affectedRooms(before, after, rooms) {
  const changedDealers = new Set(after.dealers.filter(dealer =>
    JSON.stringify(before.lines.filter(line=>line.dealerId===dealer.id))!==JSON.stringify(after.lines.filter(line=>line.dealerId===dealer.id))
    || JSON.stringify(before.dealerIdlePolicies?.find(row=>row.dealerId===dealer.id))!==JSON.stringify(after.dealerIdlePolicies?.find(row=>row.dealerId===dealer.id))
    || JSON.stringify(before.dealers.find(row=>row.id===dealer.id))!==JSON.stringify(dealer)
  ).map(dealer=>dealer.id));
  for (const id of new Set([...(before.mediaPolicy??[]).map(row=>row.familyId),...(after.mediaPolicy??[]).map(row=>row.familyId)])) if (JSON.stringify(before.mediaPolicy?.find(row=>row.familyId===id))!==JSON.stringify(after.mediaPolicy?.find(row=>row.familyId===id))) changedDealers.add(id.split('/')[0]);
  if (JSON.stringify(before.idlePolicy)!==JSON.stringify(after.idlePolicy)) changedDealers.add(after.idlePolicy?.familyId?.split('/')[0] ?? before.idlePolicy?.familyId?.split('/')[0]);
  const changedLanes = new Set((after.lanes ?? []).filter(lane=>JSON.stringify(before.lanes?.find(row=>row.id===lane.id))!==JSON.stringify(lane)).map(lane=>lane.id));
  return rooms.filter(room=>room.dealerIds.some(id=>changedDealers.has(id))||changedLanes.has(room.compositionId));
}
