export class OpenClawAdminError extends Error {
  constructor(code = 'openclaw_admin_unavailable', statusCode = 503) { super(code); this.code = code; this.statusCode = statusCode; }
}
