import type { OriginalMediaCatalog } from './original-media.mjs';
export function loadOriginalMediaCatalog(): Promise<OriginalMediaCatalog>;
export function getOriginalMediaResponse(parts: string[], request: Request): Promise<Response>;
