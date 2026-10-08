import { createHash, randomBytes } from 'node:crypto';
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const suits = ['♠','♥','♦','♣'];
const material = p => ({version:p.version,shoeId:p.shoeId,rules:p.rules,nonce:p.nonce,samples:p.samples});
export function openProof(shoeId, rules, samples) {
  const proof = {version:1,shoeId,rules:{...rules},nonce:randomBytes(32).toString('hex'),samples,draws:[]};
  proof.commitment = digest(material(proof));
  return proof;
}
// Independent replay, preserving the engine's existing rejection threshold.
export function replayShuffle(samples, decks=8) {
  if(decks!==8 || !Array.isArray(samples) || samples.length>10000)throw Error('Invalid shuffle transcript');
  const cards=[];let cursor=0;
  for(let d=0;d<decks;d++)for(const s of suits)for(const r of ranks)cards.push({r,s,serial:cards.length+1});
  for(let i=cards.length-1;i>0;i--){
    const n=i+1,max=Math.floor(0xFFFFFFFF/n)*n;let value;
    do {value=samples[cursor++];if(!Number.isInteger(value)||value<0||value>0xFFFFFFFF)throw Error('Missing or invalid random sample');}while(value>=max);
    const j=value%n;[cards[i],cards[j]]=[cards[j],cards[i]];
  }
  if(cursor!==samples.length)throw Error('Unused random samples');
  return cards.reverse(); // The engine pops from the end.
}
export function verifyShoe(proof, expectedCommitment=proof?.commitment) {
  const checks=[];
  const check=(name,pass)=>checks.push({name,pass:Boolean(pass)});
  try {
    check('Closed shoe',proof.closed===true && proof.reason==='cut-card');
    check('Eight decks / 416 cards / one burn / cut at 312',JSON.stringify(proof.rules)===JSON.stringify({decks:8,cutAfter:312,total:416,burn:1}));
    check('Opening commitment',proof.version===1 && /^[a-f0-9]{64}$/.test(proof.nonce) && digest(material(proof))===expectedCommitment && proof.commitment===expectedCommitment);
    const order=replayShuffle(proof.samples);
    check('416 unique physical cards',new Set(order.map(c=>c.serial)).size===416);
    check('Eight of every rank and suit',suits.every(s=>ranks.every(r=>order.filter(c=>c.r===r&&c.s===s).length===8)));
    const drawn=proof.draws,remaining=proof.remaining;
    check('Cut reached; complete accounting',drawn.length>=312 && drawn.length<=416 && drawn.length+remaining.length===416);
    check('Physical card identities are unique',new Set([...drawn.map(d=>d.card),...remaining].map(c=>c.serial)).size===416);
    check('Contiguous draws match RNG order',drawn.every((d,i)=>d.position===i+1 && d.kind===(i===0?'burn':'deal') && d.card.r===order[i]?.r && d.card.s===order[i]?.s && d.card.serial===order[i]?.serial));
    check('Action log matches every dealt card',JSON.stringify(proof.commandDraws)===JSON.stringify(drawn.slice(1)));
    check('Unused cards match remaining shoe',remaining.every((c,i)=>c.r===order[drawn.length+i]?.r && c.s===order[drawn.length+i]?.s && c.serial===order[drawn.length+i]?.serial));
  } catch(error){checks.push({name:error.message,pass:false});}
  return {status:checks.every(c=>c.pass)?'verified':'failed',checks,disclaimer:'Reconciles this recorded shuffle and shoe. Not independent RNG certification or proof against an operator rewriting all records.'};
}
