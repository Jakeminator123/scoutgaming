export type BackgroundMaterialSource = {
  readonly kind: 'image' | 'video';
  readonly contentType: 'image/png' | 'video/mp4';
  readonly sha256: string;
  readonly size: number;
  readonly width: number;
  readonly height: number;
};
export type BackgroundMaterial = {
  readonly id: string;
  readonly role: 'background';
  readonly game: null;
  readonly label: string;
  readonly sources: readonly BackgroundMaterialSource[];
};
export const BACKGROUND_MATERIALS: readonly BackgroundMaterial[];
