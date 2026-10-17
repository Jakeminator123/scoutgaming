import { isGameLaneId } from './game-lanes.mjs';
import { isOperatorSlug } from '../../packages/navigation/operator-slug.mjs';
import { isDealerId } from '../../packages/presentation/contracts/dealer-identity.mjs';

const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const fail = () => { throw Error('Invalid operator rooms'); };
function exact(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Object.getOwnPropertySymbols(value).length || Object.getOwnPropertyNames(value).length !== keys.length
    || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail();
  for (const key of keys) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) fail();
}
function text(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) fail();
}
function rows(value, max, check) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > max
    || Object.getOwnPropertyNames(value).length !== value.length + 1 || Object.getOwnPropertySymbols(value).length
    || Object.keys(value).length !== value.length) fail();
  const ids = new Set();
  for (let i = 0; i < value.length; i++) {
    if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, i) ?? {}, 'value')) fail();
    check(value[i]);
    if (ids.has(value[i].id)) fail();
    ids.add(value[i].id);
  }
}
function layer(value, background) {
  exact(value, ['enabled', 'default', 'allowed', ...(background ? ['mode'] : [])]);
  if (typeof value.enabled !== 'boolean' || background && !['baked', 'image', 'video'].includes(value.mode)) fail();
  rows(value.allowed, 32, item => { exact(item, ['id', 'label']); if (!UUID.test(item.id)) fail(); text(item.label, 80); });
  if (value.default !== null && !value.allowed.some(item => item.id === value.default)) fail();
  if ((!value.enabled || background && value.mode === 'baked') && (value.allowed.length || value.default !== null)) fail();
}
/** The public lobby contains labels and authorized IDs, never media URLs or
 * draft/administration objects. The game independently revalidates every choice. */
export function validatePublicOperatorRooms(value, { operatorSlug } = {}) {
  exact(value, ['schemaVersion', 'operator', 'packageRevision', 'rooms']);
  exact(value.operator, ['slug', 'name']);
  if (value.schemaVersion !== 1 || !isOperatorSlug(value.operator.slug)
    || operatorSlug !== undefined && value.operator.slug !== operatorSlug) fail();
  text(value.operator.name, 120);
  if (value.packageRevision !== null && (!Number.isSafeInteger(value.packageRevision) || value.packageRevision < 1)) fail();
  rows(value.rooms, 128, room => {
    exact(room, ['id', 'name', 'laneId', 'presentation', 'dealerDefault', 'dealers', 'playUrl', ...(Object.hasOwn(room,'game')?['game']:[])]);
    if (!['blackjack','roulette'].includes(Object.hasOwn(room,'game') ? room.game : 'blackjack')) fail();
    if (!isGameLaneId(room.id) || !isGameLaneId(room.laneId)) fail();
    text(room.name, 100); exact(room.presentation, ['id', 'label']);
    if (!isGameLaneId(room.presentation.id)) fail();
    text(room.presentation.label, 80);
    rows(room.dealers, 32, dealer => {
      exact(dealer, ['id', 'label', 'presentation', 'independentLayers', 'table', 'background']);
      if (!isDealerId(dealer.id) || !['local', 'original', 'layered'].includes(dealer.presentation)
        || typeof dealer.independentLayers !== 'boolean') fail();
      text(dealer.label, 120); layer(dealer.table, false); layer(dealer.background, true);
      if (dealer.presentation === 'original' && dealer.independentLayers
        || !dealer.independentLayers && (dealer.table.enabled || dealer.background.enabled)) fail();
    });
    if (!room.dealers.length || !room.dealers.some(dealer => dealer.id === room.dealerDefault)
      || room.playUrl !== `/play/${room.game ?? 'blackjack'}?` + new URLSearchParams({ operator: value.operator.slug, table: room.id }).toString()) fail();
  });
  if (value.packageRevision === null && value.rooms.length) fail();
  return structuredClone(value);
}
