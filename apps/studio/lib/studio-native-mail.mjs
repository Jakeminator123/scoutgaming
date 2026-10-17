import { effectiveAccountRole } from '../../../packages/studio-access/account-role.mjs';

const mailbox = value => typeof value === 'string' && value.length <= 254
  && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,63}$/.test(value);

const escapeHtml = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

function partnerDetail(value, max) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!text || /[\u0000-\u001f\u007f-\u009f]/.test(text)) return '';
  return text.slice(0, max);
}

function message({ to, kind, role, link, operatorName, roleLabel }, origin) {
  const partner = role === 'partner';
  const admin = effectiveAccountRole(role) === 'admin', invite = kind === 'invite';
  const company = partner ? partnerDetail(operatorName, 120) : '';
  const label = partner ? partnerDetail(roleLabel, 80) : '';
  const heading = partner
    ? `${invite ? 'Inbjudan' : 'Återställ lösenord'} – operatörspersonal, nivå 2`
    : admin
    ? `${invite ? 'Inbjudan' : 'Återställ lösenord'} – adminpersonal, nivå 1`
    : `${invite ? 'Aktivera ditt konto' : 'Återställ lösenord'} – spelare, nivå 3`;
  const introduction = partner
    ? `${invite ? 'Du har bjudits in som' : 'Det här mejlet gäller ditt konto som'} operatörspersonal${company ? ` hos ${company}` : ''}${label ? ` med rollen ${label}` : ''}.`
    : admin
    ? `${invite ? 'Du har bjudits in som' : 'Det här mejlet gäller ditt konto som'} intern adminpersonal hos ScoutGamingGroup med administratörsbehörighet på nivå 1.`
    : `${invite ? 'Aktivera' : 'Återställ lösenordet för'} ditt spelarkonto hos ScoutGamingGroup.`;
  const access = partner
    ? 'Behörighet: nivå 2 (spelbolagets arbetsyta i partnerportalen).'
    : admin
    ? 'Behörighet: hela nivå 1 (intern administration), nivå 2 (spelbolagens arbetsytor) och nivå 3 (spelarlobbyn och spelen). Du använder samma konto och lösenord på alla tre nivåerna. Nivå 2 visar tills vidare demonstrationer; kundval aktiveras när spelbolag ansluts till partnerportalen.'
    : 'Behörighet: nivå 3 (spelarlobbyn och spelen).';
  const action = invite ? 'Aktivera kontot och välj lösenord' : 'Välj nytt lösenord';
  const expiry = `Länken gäller i ${invite ? '72' : '2'} timmar och kan användas en gång. Vid behov kan en administratör skicka en ny länk.`;
  const login = partner ? `${origin}/partner/login` : admin ? `${origin}/studio/login?returnTo=%2Fcontrol` : `${origin}/player-login`;
  const safety = 'Lösenord skickas aldrig via e-post. Dela inte aktiverings- eller återställningslänken. Om du inte känner igen detta mejl kan du bortse från det.';
  const text = [`ScoutGamingGroup: ${heading}`, introduction, access, `Inloggningsadress: ${to}`,
    `${action}: ${link}`, expiry, `Logga in efteråt: ${login}`, ...(partner ? [] : [`Spelarlobby: ${origin}/play`]), safety].join('\n\n');
  const lobby = partner ? '' : ` · <a href="${origin}/play">Spelarlobby</a>`;
  const html = `<!doctype html><html lang="sv"><body style="margin:0;background:#f3f4f6;color:#17212b;font-family:Arial,sans-serif;line-height:1.6"><main style="max-width:600px;margin:32px auto;padding:32px;background:#fff;border-radius:12px"><p style="font-weight:700">ScoutGamingGroup</p><h1 style="font-size:24px">${escapeHtml(heading)}</h1><p>${escapeHtml(introduction)}</p><p>${escapeHtml(access)}</p><p><strong>Inloggningsadress:</strong> ${escapeHtml(to)}</p><p style="margin:28px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#173f5f;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">${action}</a></p><p>${expiry}</p><p>Om knappen inte fungerar: <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p><p><a href="${escapeHtml(login)}">Logga in efteråt</a>${lobby}</p><p style="font-size:13px;color:#536273">${safety}</p></main></body></html>`;
  return { subject: `ScoutGamingGroup: ${heading}`, text, html };
}

// Server configuration is explicit. A provider key alone does not establish
// ownership of the old sender domain or enable invitations/password resets.
export function createNativeStudioMail({ env = process.env, fetchImpl = fetch } = {}) {
  const key = env.RESEND_API_KEY, from = env.CROUPIER_STUDIO_MAIL_FROM;
  let origin;
  try { origin = new URL(env.CROUPIER_PUBLIC_ORIGIN); } catch { return undefined; }
  if (typeof key !== 'string' || !key || key.length > 512 || /[\s\u0000-\u001f\u007f]/.test(key)
    || !mailbox(from) || origin.origin !== env.CROUPIER_PUBLIC_ORIGIN || origin.protocol !== 'https:'
    || origin.username || origin.password) return undefined;
  return Object.freeze({ async send({ to, kind, role, link, operatorName, roleLabel }) {
    let url;
    try { url = new URL(link); } catch { return { sent: false }; }
    const studioPath = !!effectiveAccountRole(role) && url.pathname === '/studio/set-password';
    const partnerPath = role === 'partner' && url.pathname === '/partner/set-password';
    if (!mailbox(to) || !['invite','reset'].includes(kind) || (!studioPath && !partnerPath) || url.origin !== origin.origin
      || url.username || url.password || url.hash
      || [...url.searchParams.keys()].length !== 1 || !/^[A-Za-z0-9_-]{32,128}$/.test(url.searchParams.get('t') || '')) {
      return { sent: false };
    }
    try {
      const sent = await fetchImpl('https://api.resend.com/emails', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `ScoutGamingGroup <${from}>`, to: [to], ...message({ to, kind, role, link: url.href, operatorName, roleLabel }, origin.origin) }) });
      await sent.body?.cancel(); return { sent: sent.ok };
    } catch { return { sent: false }; }
  } });
}
