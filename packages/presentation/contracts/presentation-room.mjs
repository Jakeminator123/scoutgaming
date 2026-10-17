import { isGameLaneId } from './game-lane-id.mjs';

export const PRESENTATION_ROOM_SCHEMA_VERSION = 2;
export const PRESENTATION_ROOM_CAPABILITY = 'operator-owned-v2';
const fields = ['schemaVersion', 'id', 'name', 'operatorId', 'presentationLaneId', 'gameLaneId', 'state'];
export const roomGame = room => room && Object.hasOwn(room,'game') ? room.game : 'blackjack';
export const roomPlayPath = (room, slug) => `/play/${roomGame(room)}?` + new URLSearchParams({operator:slug,table:room.id});
export const isRoomOperatorId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value);
const name = value => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 100
  && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
export function isPresentationRoom(room) {
  return Boolean(room && typeof room === 'object' && !Array.isArray(room) && Object.keys(room).length === fields.length + (Object.hasOwn(room,'game') ? 1 : 0)
    && ['blackjack','roulette'].includes(roomGame(room))
    && fields.every(key => Object.hasOwn(room, key)) && room.schemaVersion === PRESENTATION_ROOM_SCHEMA_VERSION
    && isGameLaneId(room.id) && name(room.name) && isRoomOperatorId(room.operatorId)
    && isGameLaneId(room.presentationLaneId) && isGameLaneId(room.gameLaneId)
    && ['live', 'preview', 'pending'].includes(room.state));
}
