export const OPENCLAW_DASHBOARD_URL = 'https://croupier-lab-director.onrender.com/openclaw/';
export const RENDER_CONTROL_URL = 'https://dashboard.render.com/';

// No status was supplied: use the documented deployment. An explicit invalid
// value must fail closed, rather than silently linking to another deployment.
export function openClawDashboardUrl(value = OPENCLAW_DASHBOARD_URL) {
  if (typeof value !== 'string' || value !== OPENCLAW_DASHBOARD_URL) return null;
  try {
    const url = new URL(value);
    if (url.origin !== 'https://croupier-lab-director.onrender.com'
      || url.pathname !== '/openclaw/' || url.username || url.password || url.search || url.hash) return null;
    return url.href;
  } catch { return null; }
}
