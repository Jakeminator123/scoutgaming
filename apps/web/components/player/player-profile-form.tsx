'use client';

import {useState, type FormEvent} from 'react';

type Locale = 'sv' | 'en';

export function PlayerProfileForm({displayName, locale}: {displayName: string, locale: Locale}) {
  const [name, setName] = useState(displayName);
  const [language, setLanguage] = useState<Locale>(locale);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSaved('');
    setPending(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {'content-type': 'application/json', accept: 'application/json'},
        body: JSON.stringify({displayName: name, locale: language}),
      });
      const body = await response.json().catch(() => null);
      if (response.status === 422) {
        setError('Namnet ska vara 2–40 tecken utan styrtecken, och språket ska vara svenska eller engelska.');
        return;
      }
      if (response.status === 401) {
        setError('Logga in igen.');
        return;
      }
      if (body?.error === 'profile_unavailable' || body?.editable === false) {
        setError('Inte tillgängligt än');
        return;
      }
      if (!response.ok || !body || typeof body.displayName !== 'string') {
        setError('Profilen kunde inte sparas. Försök igen.');
        return;
      }
      setName(body.displayName);
      if (body.locale === 'sv' || body.locale === 'en') setLanguage(body.locale);
      setSaved('Profilen är sparad.');
    } catch {
      setError('Profilen kunde inte sparas. Försök igen.');
    } finally {
      setPending(false);
    }
  }

  return <form className="mt-6 space-y-4" data-profile-form onSubmit={onSubmit}>
    <label className="block text-slate-200">Visningsnamn
      <input name="displayName" value={name} minLength={2} maxLength={40} required autoComplete="nickname" onChange={event => setName(event.target.value)} className="mt-1 block w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-white" />
    </label>
    <label className="block text-slate-200">Språk
      <select name="locale" value={language} onChange={event => setLanguage(event.target.value === 'en' ? 'en' : 'sv')} className="mt-1 block w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-white">
        <option value="sv">Svenska</option>
        <option value="en">English</option>
      </select>
    </label>
    <button type="submit" disabled={pending} className="rounded-lg bg-lime px-6 py-3 font-semibold text-ink">Spara profil</button>
    <p role="alert" data-profile-error className="text-rose-200">{error}</p>
    <p role="status" data-profile-saved className="text-emerald-300">{saved}</p>
  </form>;
}
