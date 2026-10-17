import type { StudioAdminContext, StudioAdminScope } from './studio-admin-api.mjs';
import type { StudioPasswordMail } from './studio-native-auth-actions.mjs';
export interface StudioGameAuthority {
  execute(input: { action: string; body: Record<string,unknown>; actor: StudioAdminContext['actor']; scope: StudioAdminScope; request: Request }): Promise<Record<string,unknown>>;
}
export function createStudioAdminAccounts(options: {
  boDb: unknown; gameDb?: unknown; scope: StudioAdminScope; gameAuthority?: StudioGameAuthority;
  mail?: StudioPasswordMail; publicOrigin?: string; now?: () => number;
}): { handlers: Map<string,(context: StudioAdminContext) => Promise<unknown>>;
  gates: Map<string,(context: StudioAdminContext) => boolean> };
