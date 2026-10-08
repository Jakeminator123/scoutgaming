export const TABLE_COLOR_BRANDING_KEY: 'color';

export interface PartnerBrandingView {
  operatorId: string;
  packageRevision: number;
  lanes: string[];
  branding: Record<string, unknown>;
  adjustable: string[];
}

export interface PartnerPackageRecord {
  operatorId: string;
  revision: number;
  lanes: readonly string[];
  games: readonly string[];
  tables: readonly string[];
  branding: Record<string, unknown>;
}

export function adjustableForPackage(laneIds: readonly string[], saved: unknown): string[];

export function createPartnerBrandingApi(options: {
  store: {
    getCurrentPackage(operatorId: string): Promise<PartnerPackageRecord | null>;
    publishPackage(input: {
      actor: string;
      operatorId: string;
      lanes: readonly string[];
      games: readonly string[];
      tables: readonly string[];
      branding: Record<string, unknown>;
    }): Promise<PartnerPackageRecord>;
  };
  readProject(): Promise<unknown>;
}): {
  read(input: { operatorId: string }): Promise<PartnerBrandingView>;
  write(input: {
    operatorId: string;
    actor: string;
    expectedRevision: number;
    branding: Record<string, unknown>;
  }): Promise<PartnerBrandingView>;
};
