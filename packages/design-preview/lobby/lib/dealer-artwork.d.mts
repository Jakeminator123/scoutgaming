export type SuppliedPortraitVideo = { src: string; approved: true; source: 'supplied-portrait' };
export function suppliedDealerArtwork(dealer: { id: string; name: string }): { image: string; approvedVideo: SuppliedPortraitVideo } | undefined;
export function isSuppliedPortraitVideo(image: string | undefined, video: unknown): boolean;
