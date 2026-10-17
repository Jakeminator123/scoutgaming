import { createGameEntrySelector } from '../../../packages/presentation/server/game-entry-selector.mjs';
import { ROOM } from './room.mjs';

const fail = (code,statusCode=404) => { throw Object.assign(Error(code),{statusCode}); };
export function validateRoomContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).some(key=>!['operator','table','dealer'].includes(key))
      || typeof value.operator !== 'string' || typeof value.table !== 'string'
      || value.dealer !== undefined && typeof value.dealer !== 'string'
      || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value.operator ?? '')
      || !/^[a-z][a-z0-9-]{0,63}$/.test(value.table ?? '')
      || value.dealer !== undefined && !/^[a-z][a-z0-9-]{0,39}$/.test(value.dealer)) fail('invalid_room_context',400);
  return new URLSearchParams(value);
}
export function createRouletteRoomAccess({ readCurrentContext }) {
  async function resolve(value, client) {
    const query = validateRoomContext(value);
    const saved = client ? await readCurrentContext.inTransaction(client, value.operator) : await readCurrentContext(value.operator);
    if (!saved) fail('roulette_room_unavailable',503);
    const { operator, package:pack, administration } = saved;
    if (!operator || operator.status !== 'active' || operator.slug !== value.operator || !pack) fail('roulette_room_not_found');
    const select = createGameEntrySelector({ game:'roulette',
      policy:{readSaved:async()=>({administration,project:{}}),readGameConfiguration:()=>{}},
      packages:{resolve:async()=>({operator,package:pack})},log:()=>{},
    });
    const entry = await select(query);
    if (entry.status !== 200 || !entry.room) fail('roulette_room_not_found');
    const room = { ...ROOM, id:entry.room.id, operatorId:operator.id, name:entry.room.name,
      operator:operator.slug, operatorName:operator.name, packageRevision:pack.revision,
      dealer:entry.selection.dealer, branding:entry.selection.branding };
    return { room, recheck:async client=>{
      const current = await resolve(value, client);
      if (JSON.stringify(current.room) !== JSON.stringify(room)) fail('roulette_room_changed',409);
    } };
  }
  return resolve;
}
