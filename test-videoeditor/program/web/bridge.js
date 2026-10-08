/* Optional adapter for the READ contract in web/partner-presentation.mjs.
 * No fetch, wallet, outcomes, random cards, live backend or alternate engine.
 * Integration in scoutgaming is NOT performed by this file. */
export function attachScoutGamingBridge(player,{boxBase=0,onReceipt=()=>{},onUnsupported=()=>{}}={}){
  if(![0,1].includes(boxBase))throw Error('boxBase måste vara 0 eller 1.');
  let currentRound=null;const seen=new Set(),hands=new Map();
  const receipts=['clip-start','card-landed','clip-end','queue-idle','playback-error'];
  const handlers=receipts.map(type=>{const fn=e=>onReceipt({type,roundId:currentRound,...e.detail});player.addEventListener(type,fn);return [type,fn];});
  return {
    consume({roundId,presentation}){
      if((typeof roundId!=='string'&&typeof roundId!=='number')||!Array.isArray(presentation))throw Error('roundId och presentation[] krävs.');
      if(roundId!==currentRound){player.stop();seen.clear();hands.clear();currentRound=roundId;}
      const result={accepted:0,duplicates:0,unsupported:[]};
      for(const event of presentation){
        try{
          if(event.type==='deal'){
            if(event.shoeDraw==null)throw Error('deal saknar shoeDraw; säker deduplicering kräver draw-id.');
            const key='deal:'+event.shoeDraw;if(seen.has(key)){result.duplicates++;continue;}
            const isDealer=event.to==='dealer';
            if(!isDealer&&event.to!=='box')throw Error('Okänt utdelningsmål.');
            if(!isDealer&&(!Number.isInteger(event.box)||event.box<boxBase||event.box>boxBase+6))throw Error('Ogiltigt spelarnummer.');
            if(!isDealer&&event.handIndex!=null){
              const known=hands.get(event.box);if(known!=null&&known!==event.handIndex)throw Error('Split-händer kräver separat layout och stöds inte i v1.');
              hands.set(event.box,event.handIndex);
            }
            const faceDown=!!event.faceDown,target=isDealer?(faceDown?'hole':'dealer'):String(event.box-boxBase+1);
            if(!isDealer&&faceDown)throw Error('Face-down-klipp för spelare finns inte i materialet.');
            const card=faceDown?{r:null,s:null}:event.card;
            if(!faceDown&&(!card||card.r==null||card.s==null))throw Error('Synligt kort måste komma med rank/suit från servern.');
            player.enqueueDeal(target,{...card,faceDown,shoeDraw:event.shoeDraw,handIndex:event.handIndex},false);seen.add(key);result.accepted++;
          }else if(event.type==='reveal'){
            const key='reveal:'+event.shoeDraw;if(seen.has(key)){result.duplicates++;continue;}
            // Must be called after the deal's receipt, not while a queue is still dealing that card.
            if(player.running)throw Error('Vänta på queue-idle innan reveal tillämpas.');
            player.reveal(event.shoeDraw,event.card);seen.add(key);result.accepted++;
          }else if(event.type==='idle'){player.enqueueState('idle');result.accepted++;}
          else {throw Error('Hanteras av värdspelet, inte denna mediespelare: '+event.type);}
        }catch(e){const issue={type:event.type,message:e.message,event};result.unsupported.push(issue);onUnsupported(issue);}
      }
      return result;
    },
    reset(){player.stop();seen.clear();hands.clear();currentRound=null;},
    detach(){for(const [type,fn]of handlers)player.removeEventListener(type,fn);}
  };
}
