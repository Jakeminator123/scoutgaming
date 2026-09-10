// Presentation inventory only. Counts come from the public table response;
// no future cards, outcomes, balances or game commands are stored here.
export function createDiscardState(){
  let shoeId=null,version=-1,base=0,onTable=0;
  const landed=new Set();
  const view=()=>({shoeId,count:base+landed.size,onTable:onTable-landed.size});
  return {view,
    sync(snapshot,{collecting=false}={}){
      const {shoe,round}=snapshot??{};
      if(!shoe||typeof shoe.id!=='string'||!shoe.id||!Number.isInteger(shoe.dealt)||!Number.isInteger(shoe.total)||shoe.dealt<0||shoe.dealt>shoe.total||!Number.isInteger(snapshot.version))throw new Error('Invalid discard snapshot');
      if(shoe.id===shoeId&&snapshot.version<=version)return view();
      const count=round?round.hands.reduce((n,h)=>n+h.cards.length,0)+round.dealer.length+(round.dealer.length===1&&round.holeDraw?1:0):collecting&&shoe.id===shoeId?onTable:0;
      if(count>shoe.dealt)throw new Error('Round contains more cards than the public shoe');
      shoeId=shoe.id;version=snapshot.version;onTable=count;base=shoe.dealt-count;landed.clear();
      return view();
    },
    land(cardKey){
      if(cardKey===null||cardKey===undefined)throw new Error('Collection requires a card identity');
      if(landed.has(cardKey))return view();
      if(landed.size>=onTable)throw new Error('Collection exceeds the server round');
      landed.add(cardKey);return view();
    },
  };
}
