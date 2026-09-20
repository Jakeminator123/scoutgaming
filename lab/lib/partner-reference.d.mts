export function createPartnerReference(options?: Record<string, unknown>): { endpoint(request: Request): Promise<Response> };
export function partnerReferenceEndpoint(request: Request): Promise<Response>;
