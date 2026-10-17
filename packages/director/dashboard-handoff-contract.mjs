export const DASHBOARD_URL = 'https://croupier-lab-director.onrender.com/openclaw/';
export function validDashboardHandoff(value, now = Date.now()) {
  return value && typeof value.bootstrapToken === 'string' && /^[a-zA-Z0-9_-]{32,256}$/.test(value.bootstrapToken)
    && Number.isSafeInteger(value.expiresAtMs) && value.expiresAtMs > now && value.expiresAtMs <= now + 10 * 60 * 1000;
}
export function dashboardBrowserUrl(value) {
  if (!validDashboardHandoff(value)) throw new Error('openclaw_dashboard_unavailable');
  const fragment = new URLSearchParams({ bootstrapToken:value.bootstrapToken, bootstrapProfile:'owner',
    gatewayUrl:DASHBOARD_URL.replace('https:', 'wss:').replace(/\/$/, '') });
  return DASHBOARD_URL + '#' + fragment;
}
export function validDashboardRequest(value) {
  return value && Object.keys(value).length === 2 && value.version === 1 && value.action === 'dashboard.open';
}
