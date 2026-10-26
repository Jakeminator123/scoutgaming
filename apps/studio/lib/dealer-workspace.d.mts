export type DealerWorkspaceSection = 'idle' | 'deal' | 'clips';
export const DEALER_WORKSPACE_SECTIONS: readonly { id: DealerWorkspaceSection; label: string }[];
export function workspaceLocation(hash: string): { section: DealerWorkspaceSection; upload: boolean; redirect: string | null };
