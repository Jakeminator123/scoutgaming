import type { StudioAdminContext } from './studio-admin-api.mjs';
export function createStudioAdminData(options: {
  db: unknown; boDb: unknown; repository: unknown;
  scope: {environment: string; workspaceId: string};
  canAssignDealer?: (dealer: string) => Promise<boolean>; now?: () => string;
}): {handlers: Map<string, (context: StudioAdminContext) => Promise<unknown>>;
  gates: Map<string, (context: StudioAdminContext) => boolean>};
