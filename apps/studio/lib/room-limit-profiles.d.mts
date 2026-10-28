export type RoomLimitProfile = { id: string; label: string; place: string; image: string; alt: string; min: number; max: number; sideMax: number; chips: number[]; refill: number; stakes: string };
export const roomLimitProfileNote: string;
export function formatAmount(value: number): string;
export function roomLimitProfiles(): RoomLimitProfile[];
export function roomLimitProfileArtwork(id: unknown): { image: string; alt: string } | undefined;
export function roomLimitProfileImage(id: unknown): string | undefined;
