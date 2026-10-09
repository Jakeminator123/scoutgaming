import { total } from './game-events.js';
import { boxLabel } from './box-label.js';
// Presentation consumes server awards; never calculate a paytable in the browser.
export function visibleSideResults(state,visible) {
  if(!state?.me||!state.roundId)return [];
  return (state.round?.hands??[]).flatMap(h=>state.me.seats.includes(h.box)?Object.entries(h.sideResults??{}).flatMap(([field,r])=>
    r.draws?.length&&r.draws.every(draw=>visible.has(draw))?[{...r,field,box:h.box,key:`${state.roundId}:${h.box}:${field}`,title:`${field==='pp'?'PERFECT PAIRS':'21+3'} · BOX ${boxLabel(h.box)}`}]:[]):[]);
}
export const visibleSideWins=(state,visible)=>visibleSideResults(state,visible).filter(r=>r.profit>0);
export function mainWin(receipt) {
  if(!receipt)return null;
  const profit=receipt.hands.reduce((n,h)=>n+h.result-h.stake-(h.insured||0),0);
  if(profit<=0)return null;
  const blackjack=receipt.hands.some(h=>h.splitFrom===null&&h.cards.length===2&&h.cards.some(c=>c.r==='A')&&h.cards.some(c=>['10','J','Q','K'].includes(c.r))&&h.result>h.stake);
  return {title:blackjack?'BLACKJACK':'HAND WIN',profit,big:blackjack};
}
// Every box's main bet at settlement (all players, split hands summed): what was staked and what came back.
export function mainResults(round,roundId) {
  const by=new Map();
  for(const h of round?.hands??[]){
    const r=by.get(h.box)??{box:h.box,stake:0,returned:0,key:`${roundId}:${h.box}:main`};
    r.stake+=h.stake;r.returned+=h.result??0;by.set(h.box,r);
  }
  return [...by.values()].filter(r=>r.stake>0);
}
// One verdict per box from the server receipt. The table shows no per-hand
// text, so without this a push beside a bust only ever read as the net loss.
export function boxResults(receipt) {
  const by=new Map();
  for(const h of receipt?.hands??[]){
    const r=by.get(h.box)??{box:h.box,net:0,bust:true};
    r.net+=h.result-h.stake-(h.insured||0);if(total(h.cards)<=21)r.bust=false;by.set(h.box,r);
  }
  return [...by.values()].sort((a,b)=>a.box-b.box).map(({box,net,bust})=>({box,net,outcome:net>0?'win':net===0?'push':bust?'bust':'lose'}));
}
// The server keeps each player's LAST settlement; a player who sat a round out
// still has the previous one. Only a receipt for the round on the table is shown.
export function currentReceipt(state) {
  const receipt=state?.me?.lastSettlement??null;
  return receipt&&receipt.roundId===(state.roundId??state.plan?.id)?receipt:null;
}
export function createWinTracker(notify) {
  let roundId=null;const seen=new Set();
  return (state,visible,enabled)=>{
    if(roundId!==state?.roundId){roundId=state?.roundId;seen.clear();}
    const wins=visibleSideWins(state,visible);
    for(const win of wins)if(!seen.has(win.key)){seen.add(win.key);if(enabled)notify(win);}
    return wins;
  };
}
export function showWinToast(title,profit,big=false) {
  if(!(profit>0))return;
  let stack=document.querySelector('#winToasts');
  if(!stack){stack=document.createElement('div');stack.id='winToasts';stack.setAttribute('aria-live','polite');(document.querySelector('#stage')??document.body).append(stack);}
  const toast=document.createElement('div');toast.className=big?'win-toast big':'win-toast';
  const label=document.createElement('b'),amount=document.createElement('span');label.textContent=title;amount.textContent=`+$${profit.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  toast.setAttribute('aria-label',`${title}: ${amount.textContent} profit`);toast.append(label,amount);stack.append(toast);
  setTimeout(()=>toast.classList.add('out'),4200);setTimeout(()=>toast.remove(),4800);
}
