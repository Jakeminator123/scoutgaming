export const TABLE_COLOR_BRANDING_KEY: 'color';

export interface PartnerBrandingView {
  operatorId: string;
  packageRevision: number;
  lanes: string[];
  branding: Record<string, unknown>;
  adjustable: string[];
  presentation?: import('../../web/presentation-layers.mjs').PresentationPackage;
  dealerChoices?: Record<string,string[]>;
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
      expectedRevision: number;
      operatorId: string;
      lanes: readonly string[];
      games: readonly string[];
      tables: readonly string[];
      branding: Record<string, unknown>;
    }): Promise<PartnerPackageRecord>;
  };
  readProject(): Promise<unknown>;
  readAdministration():Promise<{revision:string;value:unknown}>;
  withWriteContext<T>(work:(context:{
    store:Parameters<typeof createPartnerBrandingApi>[0]['store'];
    readAdministration():Promise<{revision:string;value:unknown}>;
    reauthorize():Promise<boolean>;
  })=>Promise<T>):Promise<T>;
}): {
  read(input: { operatorId: string }): Promise<PartnerBrandingView>;
  write(input: {
    operatorId: string;
    actor: string;
    expectedRevision: number;
    branding: Record<string, unknown>;
  }): Promise<PartnerBrandingView>;
};
