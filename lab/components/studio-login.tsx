'use client';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createStudioLoginClient, StudioLoginUiError, studioLoginDestination, studioLoginReturnTo, studioPasswordToken } from '../lib/studio-login-client.mjs';
import styles from './studio-administration.module.css';

type Props = { authBase:'/studio/api/auth'|'/api/auth'; returnTo?:string; token?:string|null; mode?:'login'|'set-password';fetchImpl?:typeof fetch;resetAvailable?:boolean };
export function StudioLogin({ authBase,returnTo,token,mode = 'login',fetchImpl,resetAvailable = false }:Props) {
  const client = useMemo(() => createStudioLoginClient({authBase,fetchImpl}),[authBase,fetchImpl]);
  const [busy,setBusy] = useState(false), [notice,setNotice] = useState(''), [complete,setComplete] = useState(false);
  const writing = useRef(false), alive = useRef(false), passwordToken = useRef(studioPasswordToken(token));
  const loginPath = authBase === '/studio/api/auth' ? '/studio/login' : '/login';
  useEffect(() => {
    alive.current = true;
    // Remove the bearer from browser history before any interactive request.
    // No token enters DOM fields, storage, navigation, or server error text.
    if (mode === 'set-password') { passwordToken.current = studioPasswordToken(token); window.history.replaceState(null,'',window.location.pathname); }
    return () => { alive.current = false; passwordToken.current = null; };
  },[mode,token]);
  async function submit(event:FormEvent<HTMLFormElement>,action:'login'|'reset-request'|'set-password') {
    event.preventDefault();
    if (writing.current) return;
    const form = event.currentTarget, fields = new FormData(form);
    const body:Record<string,unknown> = action === 'set-password' ? {token:passwordToken.current,pass:String(fields.get('pass') || '')}
      : action === 'login' ? {user:String(fields.get('user') || '').trim(),pass:String(fields.get('pass') || ''),returnTo:studioLoginReturnTo(returnTo)}
        : {user:String(fields.get('user') || '').trim()};
    if (action === 'set-password' && body.pass !== fields.get('confirm')) { setNotice('Lösenorden stämmer inte överens.'); delete body.pass; return; }
    writing.current = true; setBusy(true); setNotice('');
    for (const name of ['pass','confirm']) { const field = form.elements.namedItem(name); if (field instanceof HTMLInputElement) field.value = ''; }
    try {
      await client.request(action,body);
      if (!alive.current) return;
      if (action === 'login') window.location.assign(studioLoginDestination(returnTo,authBase));
      else if (action === 'set-password') { passwordToken.current = null; setComplete(true); setNotice('Lösenordet är sparat. Logga in med ditt nya lösenord.'); }
      else setNotice('Om ett aktivt konto med e-post finns skickas en återställningslänk.');
    } catch (error) { if (alive.current) setNotice(error instanceof StudioLoginUiError ? error.message : new StudioLoginUiError().message); }
    finally { delete body.pass; delete body.token; writing.current = false; if (alive.current) setBusy(false); }
  }
  return <main className={styles.administration} style={{maxWidth:'40rem',margin:'2rem auto',padding:'1rem'}}>
    <section className={styles.section} aria-busy={busy}>
      <h1>{mode === 'set-password' ? 'Välj lösenord' : 'Logga in i Croupier Studio'}</h1>
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      {mode === 'login' ? <>
        <form className={styles.form} onSubmit={event => void submit(event,'login')}>
          <label>Användarnamn eller e-post<input name="user" autoComplete="username" required maxLength={254} disabled={busy} /></label>
          <label>Lösenord<input name="pass" type="password" autoComplete="current-password" required maxLength={256} disabled={busy} /></label>
          <button disabled={busy}>Logga in</button>
        </form>
        {resetAvailable && <details><summary>Glömt lösenordet?</summary><form className={styles.form} onSubmit={event => void submit(event,'reset-request')}>
          <label>Användarnamn eller e-post<input name="user" autoComplete="username" required maxLength={254} disabled={busy} /></label><button disabled={busy}>Begär återställningslänk</button>
        </form></details>}
      </> : complete ? <a href={loginPath}>Logga in</a> : passwordToken.current ? <form className={styles.form} onSubmit={event => void submit(event,'set-password')}>
        <label>Nytt lösenord (8–128 tecken)<input name="pass" type="password" minLength={8} maxLength={128} autoComplete="new-password" required disabled={busy} /></label>
        <label>Upprepa lösenordet<input name="confirm" type="password" minLength={8} maxLength={128} autoComplete="new-password" required disabled={busy} /></label><button disabled={busy}>Spara lösenord</button>
      </form> : <p role="alert">Länken saknas eller är ogiltig. Be en administratör om en ny inbjudan eller begär återställning från <a href={loginPath}>inloggningen</a>.</p>}
    </section>
  </main>;
}
