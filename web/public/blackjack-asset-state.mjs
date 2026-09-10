// Presentation only: public shoe counts come from the existing table API.
// The adapter never draws a card or changes money/round state.
export function shoePresentation(state) {
  const {total,remaining,dealt,cutAfter,cutReached}=state??{};
  if(!Number.isInteger(total)||total<1||!Number.isInteger(remaining)||remaining<0||remaining>total||
    !Number.isInteger(dealt)||dealt<0||dealt>total||remaining+dealt!==total||
    !Number.isInteger(cutAfter)||cutAfter<0||cutAfter>total) throw new Error('Invalid authoritative shoe snapshot');
  const fraction=remaining/total;
  return {fraction,packCentre:-.0875*fraction,pusherZ:-.175*fraction-.005,
    cutZ:dealt>=cutAfter?0:-.175*(cutAfter-dealt)/total,cutRemoved:!!cutReached,hasCards:remaining>0};
}

export function bindBlackjackAssets(root) {
  const requireNode=name=>{const node=root.getObjectByName(name);if(!node)throw new Error(`Missing blackjack asset node: ${name}`);return node;};
  const nodes=Object.fromEntries(['Shoe_Outlet','Shoe_Pack','Shoe_Pusher','Shoe_CutCard','Shoe_FrontCard','Card_Template','Dealer_Cards','Discard_Landing'].map(name=>[name,requireNode(name)]));
  const edgeNodes=[];root.traverse(o=>{if(/^Pack_edge_\d+$/.test(o.name))edgeNodes.push(o);});
  // Templates are supplied for cloning; never leave a duplicate card on the felt.
  nodes.Card_Template.visible=false;
  const templates=root.getObjectByName('Prop_Templates');if(templates)templates.visible=false;
  return {nodes,
    seat(index){if(!Number.isInteger(index)||index<0||index>6)throw new Error('Seat must be 0–6');return requireNode(`Seat_${String(index+1).padStart(2,'0')}_Card_Landing`);},
    updateShoe(state){
      const s=shoePresentation(state);
      nodes.Shoe_Pack.scale.z=s.fraction;nodes.Shoe_Pack.position.z=s.packCentre;nodes.Shoe_Pack.visible=s.hasCards;
      nodes.Shoe_Pusher.position.z=s.pusherZ;nodes.Shoe_FrontCard.visible=s.hasCards;
      for(const edge of edgeNodes){edge.scale.z=s.fraction;edge.visible=s.hasCards;}
      const cut=nodes.Shoe_CutCard;
      cut.position.set(s.cutRemoved?.10:0,s.cutRemoved?-.050:.006,s.cutRemoved?.015:s.cutZ);
      cut.rotation.set(s.cutRemoved?Math.PI/2:0,0,0);
      return s;
    },
  };
}
