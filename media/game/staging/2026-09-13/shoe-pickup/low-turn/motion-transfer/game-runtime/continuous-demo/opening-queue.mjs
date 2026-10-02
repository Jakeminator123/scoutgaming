// Presentation order only. Every identity comes from the existing server round.
export function openingQueue({hands,dealer,holeDraw}){
 if(!Array.isArray(hands)||hands.length<1||hands.length>7)throw Error('One to seven hands required');
 const queue=[],seen=new Set();
 function add(kind,handIndex,card,faceDown,shoeDraw,cards){
  if(!Number.isInteger(shoeDraw)||shoeDraw<1||seen.has(shoeDraw))throw Error('Distinct issued shoe draws required');seen.add(shoeDraw);
  if(!faceDown&&(!card||!['A','2','3','4','5','6','7','8','9','10','J','Q','K'].includes(card.r)||!['♠','♥','♦','♣'].includes(card.s)))throw Error('Visible issued card required');
  queue.push({kind,handIndex,card:faceDown?null:{r:card.r,s:card.s,shoeDraw},faceDown,shoeDraw,cards:cards.map(c=>({r:c.r,s:c.s,shoeDraw:c.shoeDraw}))});
 }
 for(let pass=0;pass<2;pass++){
  for(let i=hands.length-1;i>=0;i--){const cards=hands[i].cards;if(!Array.isArray(cards)||cards.length<2)throw Error('Opening cards required');add('player',i,cards[pass],false,cards[pass].shoeDraw,cards.slice(0,pass+1));}
  add('dealer',null,pass?null:dealer[0],pass===1,pass?holeDraw:dealer[0]?.shoeDraw,[dealer[0]]);
 }
 return queue;
}
export function openingChunks(queue){const chunks=[];for(let i=0;i<queue.length;i+=4)chunks.push(queue.slice(i,i+4));return chunks;}
