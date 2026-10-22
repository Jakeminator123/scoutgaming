export type StudioDealerTab = 'clips' | 'generate' | 'speech' | 'replies' | 'settings';
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
export type StudioNavigationOptions = StudioNavigationContext & {
  dealerLabel?: string;
  active?: StudioDealerTab;
};
export const STUDIO_DEALER_TABS: readonly { id: StudioDealerTab; label: string; href: string }[];
export function studioNavigationContextFromQuery(query?: Pick<URLSearchParams, 'get'> | null): StudioNavigationContext;
export function studioNavigationHref(path: string, context?: StudioNavigationContext): string;
export function studioNavigationTabs(context?: StudioNavigationContext, hrefs?: Partial<Record<StudioDealerTab, string>>): { id: StudioDealerTab; label: string; href: string }[];
