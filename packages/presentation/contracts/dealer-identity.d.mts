export const BASE_DEALER_IDS: readonly string[];
export const MAX_DEALERS: number;
export function isDealerId(value: unknown): value is string;
export function isActiveDealerId(value: unknown): value is string;
export function isRegisteredDealer(project: {dealers?: readonly {id: string}[]} | undefined, dealerId: unknown): boolean;
export function registeredDealerIds(project: unknown): Set<string>;
