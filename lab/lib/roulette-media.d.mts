import type {StudioEvent,StudioProject} from './studio-model.mjs';
export const ROULETTE_MEDIA_EVENTS: ReadonlyArray<StudioEvent & {situations:string[]}>;
export function rouletteMediaEvent(id:string): (StudioEvent & {situations:string[]})|undefined;
export function dealerMediaEvents(project:Pick<StudioProject,'events'>): StudioEvent[];
export function rouletteMediaDefaults(eventId:string,situation:string): {game:'roulette';action:string;startPose:'VILA'|'WHEEL'|'unverified';endPose:'VILA'|'WHEEL'|'unverified'};
export function validateRouletteMedia(input:unknown): void;
