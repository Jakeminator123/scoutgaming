// Counts come only from the authenticated registered workspace. A published
// room is not necessarily playable, and a background is not a player room.
import {isActiveOperator} from './studio-resource-lifecycle.mjs';
export function systemOverview(workspace, search = '') {
  const { catalog, project } = workspace;
  if (catalog.source !== 'registered') throw Error('Registrerade uppgifter krävs.');
  const { dealers } = catalog.administration;
  const operators=catalog.administration.operators.filter(isActiveOperator);
  const rooms=catalog.administration.rooms.filter(row=>row.state!=='archived'&&operators.some(operator=>operator.id===row.operatorId));
  const query = new URLSearchParams(search);
  const requestedRoom = rooms.find(row => row.id === query.get('table'));
  const operator = operators.find(row => row.id === query.get('operator'))
    ?? operators.find(row => row.id === requestedRoom?.operatorId) ?? operators[0];
  const operatorRooms = rooms.filter(row => row.operatorId === operator?.id);
  const room = operatorRooms.find(row => row.id === requestedRoom?.id) ?? operatorRooms[0];
  const compositions = project.lanes ?? [];
  const composition = room ? compositions.find(row => row.id === room.compositionId)
    : compositions.find(row => row.id === (query.get('composition') ?? query.get('lane'))) ?? compositions[0];
  const eligibleDealers = project.dealers.filter(row => !dealers.find(dealer => dealer.id === row.id)?.archived
    && (!room || room.dealerIds.includes(row.id)) && (!composition || composition.dealers.includes(row.id)));
  const dealer = eligibleDealers.find(row => row.id === query.get('dealer')) ?? eligibleDealers[0];
  const context = {};
  if (operator) context.operator = operator.id;
  if (room) context.table = room.id;
  if (composition) context.composition = composition.id;
  if (dealer) context.dealer = dealer.id;
  const kinds = [...new Set(rooms.map(row => row.game))];
  const games = ['blackjack', 'roulette', ...kinds.filter(kind => !['blackjack', 'roulette'].includes(kind)).sort()]
    .map(kind => ({ kind, name: { blackjack: 'Blackjack', roulette: 'Roulette' }[kind] ?? kind,
      rooms: rooms.filter(row => row.game === kind).length,
      playable: rooms.filter(row => row.game === kind && row.playable).length }));
  return { context, games, counts: {
    operators: operators.length, rooms: rooms.length, gameTypes: kinds.length,
    dealers: dealers.filter(row => !row.archived).length, compositions: compositions.length,
    published: rooms.filter(row => row.published).length, playable: rooms.filter(row => row.playable).length,
  } };
}

export function systemHref(path, context) {
  if (!/^\/admin(?:\/[a-z-]+)*$/.test(path)) throw Error('Systemkartans länkar måste stanna i administrationen.');
  const query = new URLSearchParams();
  for (const key of ['operator', 'table', 'composition', 'dealer']) if (context[key]) query.set(key, context[key]);
  return path + (query.size ? `?${query}` : '');
}
