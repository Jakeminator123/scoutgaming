'use client';
import { useCallback, useRef, useState } from 'react';
import { StudioAdministration, StudioAdminUiError, type StudioAdminApiBase } from './studio-administration';
import { createStudioLoginClient, StudioLoginUiError } from '../lib/studio-login-client.mjs';
import styles from './studio-administration.module.css';

export function NativeAdministration({ apiBase, availableActions,gameOrigin }: {apiBase: StudioAdminApiBase; availableActions: string[];gameOrigin?:string}) {
  const [epoch,setEpoch] = useState(0), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const writing = useRef(false);
  const session = useCallback(async () => {
    const response = await fetch(`${apiBase.replace(/\/admin$/, '/auth')}/session`, {
      credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new StudioAdminUiError(response.status);
    return response.json();
  }, [apiBase]);
  async function logout() {
    if (writing.current) return;
    writing.current = true; setBusy(true); setError(''); setEpoch(value => value+1);
    const authBase = apiBase === '/studio/api/admin' ? '/studio/api/auth' : '/api/auth';
    try { await createStudioLoginClient({authBase}).request('logout',{}); window.location.assign(apiBase === '/studio/api/admin' ? '/studio/login' : '/login'); }
    catch (error) { setError(error instanceof StudioLoginUiError ? error.message : 'Utloggningen kunde inte bekräftas.'); }
    finally { writing.current = false; setBusy(false); }
  }
  return <main className={styles.shell}>{error && <p role="alert" className={styles.error}>{error}</p>}
    {busy ? <p role="status">Loggar ut…</p> : <StudioAdministration key={epoch} apiBase={apiBase} session={session} availableActions={availableActions} gameOrigin={gameOrigin} readIdentity="response-headers-v1"
      sessionAction={<button type="button" className="sg-btn sg-btn-ghost" onClick={() => void logout()}>Logga ut</button>} />}</main>;
}
