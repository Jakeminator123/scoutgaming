import type { Dealer } from './catalog.mjs';
export type Portrait = Dealer & { image: string; clips: readonly string[] };
export const dealerPortraits: readonly Portrait[];
export const portraitBackdrop: string;
export function portraitFor(dealer: Dealer): Portrait | undefined;
export function dealerCards(availableDealers?: Dealer[]): (Dealer & { available: boolean })[];
