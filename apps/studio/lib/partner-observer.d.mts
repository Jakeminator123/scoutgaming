export type PartnerEnvironmentName = 'BETTALOTTO_PARTNER_KEY_ID' | 'BETTALOTTO_PARTNER_SECRET' | 'BETTALOTTO_PARTNER_PLAYER_ID' | 'BETTALOTTO_PARTNER_BASE_URL';
export type PartnerInputStatus = {
  configured: boolean;
  missing: PartnerEnvironmentName[];
  invalid: PartnerEnvironmentName[];
  endpoint: string | null;
  scope: 'events or play';
  channel: 'api-key + partner-player';
  replay: false;
  readOnly: true;
};
export function createPartnerObserver(options?: { env?: Record<string, string | undefined> | (() => Record<string, string | undefined>) }): {
  status(): PartnerInputStatus;
};
export function partnerEnvironment(env: Record<string, string | undefined>): Record<PartnerEnvironmentName, string | undefined>;
