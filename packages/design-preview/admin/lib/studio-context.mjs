// Resolve ownership first. Shared assets, labels and a published dealer list
// never establish another operator's draft permissions.
export function studioContext(catalog, project, selection = {}) {
  const registry=catalog.administration;
  const requestedRoom=registry.rooms.find(row=>row.id===selection.roomId);
  const operator=registry.operators.find(row=>row.id===selection.operatorId)
    ?? registry.operators.find(row=>row.id===requestedRoom?.operatorId) ?? registry.operators[0];
  const rooms=registry.rooms.filter(row=>row.operatorId===operator?.id&&row.state!=='archived');
  const room=rooms.find(row=>row.id===selection.roomId)??rooms[0];
  const lane=project.lanes?.find(row=>row.id===room?.compositionId);
  const dealers=project.dealers.filter(row=>lane?.layers.dealer.allowed.includes(row.id)
    &&registry.dealers.some(item=>item.id===row.id&&!item.archived));
  const dealer=dealers.find(row=>row.id===selection.dealerId)
    ??dealers.find(row=>row.id===lane?.layers.dealer.default)??dealers[0];
  return {operator,rooms,room,lane,dealers,dealer,game:room?.game??null};
}
