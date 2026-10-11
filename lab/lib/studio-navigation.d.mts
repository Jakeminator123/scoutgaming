export type StudioDealerTab = 'idle' | 'clips' | 'scene' | 'speech' | 'settings';
export type StudioNavigationContext = {
  dealerId?: string;
  eventId?: string;
  variantId?: string;
  situation?: string;
  laneId?: string;
};
export type StudioCrumb = { label: string; href?: string };
export type StudioNavigationCrumbOptions = StudioNavigationContext & {
  dealerLabel?: string;
  active?: StudioDealerTab;
  crumbs?: readonly StudioCrumb[];
};
export const STUDIO_DEALER_TABS: readonly { id: StudioDealerTab; label: string; href: string }[];
export function studioNavigationHref(path: string, context?: StudioNavigationContext): string;
export function studioNavigationTabs(context?: StudioNavigationContext, hrefs?: Partial<Record<StudioDealerTab, string>>): { id: StudioDealerTab; label: string; href: string }[];
export function studioNavigationCrumbs(options?: StudioNavigationCrumbOptions): StudioCrumb[];
