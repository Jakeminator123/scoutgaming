export type StudioHistory = {
  subscribe(callback: (event?: Event) => void): () => void;
  guardTraversal(guard: (href: string, event: Event) => boolean): () => void;
  snapshotHref(): string;
  isRestoring(): boolean;
  canNavigate(href: string): boolean;
  replaceContext(href: string): void;
  push(href: string | URL, replace?: boolean): boolean;
};
export function studioHistory(window: Window): StudioHistory;
export const studioHistoryBootstrap: string;
