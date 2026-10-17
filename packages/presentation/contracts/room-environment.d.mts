export type RoomEnvironment = { kind: 'baked' | 'image' | 'video' | 'variable'; fixed: boolean; label: string; image?: string };
export function roomEnvironment(room: { dealers: { independentLayers: boolean; background: { enabled: boolean; default: string | null; mode: string; allowed: { id: string; label: string }[] } }[] }, operatorSlug: string): RoomEnvironment;
