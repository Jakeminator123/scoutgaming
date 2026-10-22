'use client';

import { useState, type FormEvent } from 'react';
import { partnerLoginReturnTo } from '../lib/partner-login-return.mjs';
import styles from './studio-administration.module.css';

type AuthBase = '/api/partner' | '/studio/api/partner';

function noticeFor(status: number) {
  if (status === 401 || status === 400) return 'Inloggningen kunde inte verifieras. Intern personal loggar in via Kontrollpanelen nedan.';
  if (status === 429) return 'För många försök. Vänta 15 minuter och försök igen.';
  if (status === 403) return 'Inloggningen måste göras från partnerportalen.';
  return 'Inloggningstjänsten är tillfälligt otillgänglig.';
}

// Internal administrators sign in through the N1 login, which returns them to
// the requested partner view with their existing N1 rights. This form never mints a
// session for them; it stays limited to operator staff.
export function internalLoginHref(authBase: AuthBase, returnTo?: string) {
  return `/admin/login?returnTo=${encodeURIComponent(partnerLoginReturnTo(returnTo))}`;
}

export function PartnerLogin({ authBase, returnTo }: { authBase: AuthBase; returnTo?: string }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const user = String(fields.get('user') || '').trim();
    const pass = String(fields.get('pass') || '');
    const password = form.elements.namedItem('pass');
    if (password instanceof HTMLInputElement) password.value = '';
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch(`${authBase}/login`, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, pass }),
      });
      if (!response.ok) {
        setNotice(noticeFor(response.status));
        return;
      }
      window.location.assign(partnerLoginReturnTo(returnTo));
    } catch {
      setNotice(noticeFor(503));
    } finally {
      setBusy(false);
    }
  }

  return <main className={styles.administration} style={{ maxWidth: '40rem', margin: '2rem auto', padding: '1rem' }}>
    <section className={styles.section} aria-busy={busy}>
      <h1>Logga in i partnerportalen</h1>
      <p>Operatörspersonal loggar in med sitt Croupier-konto. Intern personal använder Kontrollpanelen.</p>
      <p><a href={internalLoginHref(authBase, returnTo)}>Logga in som intern administratör</a></p>
      <noscript><p>Aktivera JavaScript för att använda den säkra inloggningen.</p></noscript>
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      <form className={styles.form} method="post" action={`${authBase}/login`} onSubmit={event => void submit(event)}>
        <label>Användarnamn eller e-post<input name="user" autoComplete="username" required maxLength={254} disabled={busy} /></label>
        <label>Lösenord<input name="pass" type="password" autoComplete="current-password" required maxLength={256} disabled={busy} /></label>
        <button type="submit" disabled={busy}>Logga in</button>
      </form>
    </section>
  </main>;
}
