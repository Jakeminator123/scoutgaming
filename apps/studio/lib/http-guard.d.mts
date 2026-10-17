export function assertLocalRequest(request: Request): void;
export function assertLocalPageRequest(request: Request): void;
// Parsing is untyped; callers retain their existing runtime schema validation.
export function readLocalJson(request: Request): Promise<any>;
export function jsonResponse(data: unknown, status?: number): Response;
export function errorResponse(error: unknown): Response;
