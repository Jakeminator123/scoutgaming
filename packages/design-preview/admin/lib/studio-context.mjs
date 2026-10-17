// Resolve ownership first. Shared assets, labels and a published dealer list
// never establish another operator's draft permissions.
import {isActiveOperator} from './studio-resource-lifecycle.mjs';
export function studioContext(catalog, project, selection = {}) {
  const registry=catalog.administration;
  const operators=registry.operators.filter(isActiveOperator);
  const requestedRoom=registry.rooms.find(row=>row.id===selection.roomId);
  const requestedOperator=registry.operators.find(row=>row.id===selection.operatorId||!selection.operatorId&&row.id===requestedRoom?.operatorId);
  const library=selection.library===true;
  const libraryOperator=selection.operatorId
    ? operators.find(row=>row.id===selection.operatorId)
    : operators.find(row=>row.id===requestedRoom?.operatorId);
  const operator=library?libraryOperator:requestedOperator&&!isActiveOperator(requestedOperator)?undefined:operators.find(row=>row.id===selection.operatorId)
    ?? operators.find(row=>row.id===requestedRoom?.operatorId) ?? operators[0];
  const rooms=registry.rooms.filter(row=>row.operatorId===operator?.id&&row.state!=='archived'
    &&(!selection.game||row.game===selection.game));
  // Library work must not silently adopt another room or write its context into links.
  const room=rooms.find(row=>row.id===selection.roomId)??(library?undefined:rooms[0]);
  const lane=project.lanes?.find(row=>row.id===room?.compositionId);
  const dealers=project.dealers.filter(row=>(selection.library===true||lane?.layers.dealer.allowed.includes(row.id))
    &&registry.dealers.some(item=>item.id===row.id&&!item.archived));
  const dealer=dealers.find(row=>row.id===selection.dealerId)
    ??dealers.find(row=>row.id===lane?.layers.dealer.default)??dealers[0];
  return {operator,rooms,room,lane,dealers,dealer,game:room?.game??null};
}
