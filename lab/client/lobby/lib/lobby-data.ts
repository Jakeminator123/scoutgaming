export type { Dealer, Room, Operator, LobbyCatalog } from './catalog.mjs';
export { playUrlFor } from './catalog.mjs';

export const PLAY_URL = '#bolag';
export const HOME_URL = '/admin/structure';
export function pad(n: number) { return String(n).padStart(2, '0'); }
export function genitive(name: string) { return /[sxz]$/i.test(name) ? name : `${name}s`; }
