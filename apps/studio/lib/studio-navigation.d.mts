export type StudioNavigationContext = {
  dealerId?: string;
  eventId?: string;
  variantId?: string;
  situation?: string;
  laneId?: string;
  operatorId?: string;
  operatorSlug?: string;
  tableId?: string;
  game?: string;
};
export function studioNavigationContextFromQuery(query?: Pick<URLSearchParams, 'get'> | null): StudioNavigationContext;
export function studioNavigationHref(path: string, context?: StudioNavigationContext): string;
export function studioScopedHref(path: string, query?: Pick<URLSearchParams, 'get' | 'getAll'> | null, context?: StudioNavigationContext): string;
