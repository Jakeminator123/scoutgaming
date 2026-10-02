// Props are supplied by the caller; filmed print never determines card identity.
export function resolveFrameCards(frame, deliveries) {
  return (frame?.cards ?? []).flatMap(pose => {
    const delivery=deliveries.get(pose.id);
    if(!delivery || !pose.quad)return [];
    const face=delivery.faceDown || pose.face==='back' ? 'back' : 'front';
    if(face==='front' && (!delivery.card?.r || !delivery.card?.s))throw Error(`Missing issued card for delivery ${pose.id}`);
    return [{...pose,face,card:face==='front'?delivery.card:undefined}];
  });
}
