export type PartnerEnvironmentName = 'BETTALOTTO_PARTNER_KEY_ID' | 'BETTALOTTO_PARTNER_SECRET' | 'BETTALOTTO_PARTNER_PLAYER_ID' | 'BETTALOTTO_PARTNER_BASE_URL';
export type PartnerInputStatus = {
  configured: boolean;
  missing: PartnerEnvironmentName[];
  invalid: PartnerEnvironmentName[];
  endpoint: string | null;
  scope: 'play';
  channel: 'api-key + partner-player';
  replay: false;
  readOnly: true;
};
export type PartnerInputEnvelope = {
  id: string;
  time: string;
  source: 'partner';
  kind: 'round' | 'status';
  data: Record<string, unknown>;
  upstreamId?: string;
};
export function createPartnerObserver(options?: Record<string, unknown>): {
  status(): PartnerInputStatus;
  endpoint(request: Request): Promise<Response>;
};
export function partnerInputEndpoint(request: Request): Promise<Response>;
