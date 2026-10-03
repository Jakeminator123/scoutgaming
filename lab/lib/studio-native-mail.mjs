const mailbox = value => typeof value === 'string' && value.length <= 254
  && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,63}$/.test(value);

// Server configuration is explicit. A provider key alone does not establish
// ownership of the old sender domain or enable invitations/password resets.
export function createNativeStudioMail({ env = process.env, fetchImpl = fetch } = {}) {
  const key = env.RESEND_API_KEY, from = env.CROUPIER_STUDIO_MAIL_FROM;
  let origin;
  try { origin = new URL(env.CROUPIER_PUBLIC_ORIGIN); } catch { return undefined; }
  if (typeof key !== 'string' || !key || key.length > 512 || /[\s\u0000-\u001f\u007f]/.test(key)
    || !mailbox(from) || origin.origin !== env.CROUPIER_PUBLIC_ORIGIN || origin.protocol !== 'https:'
    || origin.username || origin.password) return undefined;
  return Object.freeze({ async send({ to, kind, link }) {
    let url;
    try { url = new URL(link); } catch { return { sent: false }; }
    if (!mailbox(to) || !['invite','reset'].includes(kind) || url.origin !== origin.origin
      || url.username || url.password || url.hash || url.pathname !== '/studio/set-password'
      || [...url.searchParams.keys()].length !== 1 || !/^[A-Za-z0-9_-]{32,128}$/.test(url.searchParams.get('t') || '')) {
      return { sent: false };
    }
    try {
      const sent = await fetchImpl('https://api.resend.com/emails', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `Croupier Studio <${from}>`, to: [to],
          subject: kind === 'invite' ? 'Croupier: välj ditt lösenord' : 'Croupier: återställ lösenord',
          text: `${kind === 'invite' ? 'Aktivera ditt befintliga Croupier-konto' : 'Återställ lösenordet för ditt Croupier-konto'}: ${link}` }) });
      await sent.body?.cancel(); return { sent: sent.ok };
    } catch { return { sent: false }; }
  } });
}
