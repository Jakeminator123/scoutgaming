'use client';

import { useRef, useState } from 'react';
import { endPartnerSession } from '../lib/partner-session-actions.mjs';
import { partnerCopy } from './kevin-bo/partner-copy.mjs';
import styles from './partner-session-actions.module.css';

export function PartnerSessionActions({ apiBase, accessClass, language, returnTo }: {
  apiBase: string; accessClass: 'partner' | 'internal-admin'; language: string; returnTo: string;
}) {
  const copy = partnerCopy(language);
  const writing = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  async function endSession(action: 'switch' | 'logout') {
    if (writing.current) return;
    writing.current = true; setBusy(true); setError(false);
    try {
      const destination = await endPartnerSession({ apiBase, accessClass, action, returnTo });
      window.location.assign(destination);
    } catch {
      setError(true);
    } finally {
      writing.current = false; setBusy(false);
    }
  }
  return <div className={styles.actions} aria-busy={busy}>
    <div className={styles.buttons}>
      <button type="button" className={styles.button} disabled={busy} onClick={() => void endSession('switch')}>{copy.switchAccount}</button>
      <button type="button" className={styles.button} disabled={busy} onClick={() => void endSession('logout')}>{copy.logOut}</button>
    </div>
    {busy && <span className={styles.message} role="status">{copy.loggingOut}</span>}
    {error && <span className={styles.error} role="alert">{copy.logoutError}</span>}
  </div>;
}
