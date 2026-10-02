export type StudioNavigationPath = '/' | '/tree' | '/administration' | '/openclaw' | '/activity' | '/guide';
export interface StudioNavigationItem {
  readonly href: StudioNavigationPath;
  readonly label: string;
}
export const STUDIO_PRIMARY_NAVIGATION: readonly StudioNavigationItem[];
export const STUDIO_TOOL_NAVIGATION: readonly StudioNavigationItem[];
export function studioNavigationItem(pathname: unknown, basePath?: unknown): StudioNavigationItem | null;
