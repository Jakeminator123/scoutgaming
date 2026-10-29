export type RoomLimitProfile = { id: string; label: string; min: number; max: number; sideMax: number; chips: number[]; refill: number; stakes: string };
export const roomLimitProfileNote: string;
export function formatAmount(value: number): string;
export function roomLimitProfiles(): RoomLimitProfile[];
