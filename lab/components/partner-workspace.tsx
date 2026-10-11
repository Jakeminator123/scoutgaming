'use client';

import { useState } from 'react';
import { workspaceSurfacePath } from '../lib/workspace-surfaces.mjs';
import { usePartnerPreferences } from './kevin-bo/partner-copy.mjs';
import { PartnerSessionActions } from './partner-session-actions';
import styles from './partner-workspace.module.css';

type Partner = { slug: string; name: string };

export function PartnerWorkspace({ user, operators, accessClass, apiBase = '/studio/api/partner/snapshot' }: {
  user: string; operators: Partner[]; accessClass: 'partner' | 'internal-admin'; apiBase?: string;
}) {
  const { language, theme, copy, setLanguage, setTheme } = usePartnerPreferences();
  const [query, setQuery] = useState('');
  const admin = accessClass === 'internal-admin';
  // Invalid destinations never become a fallback to another operator.
  const partners = operators.flatMap(operator => {
    const href = workspaceSurfacePath('partner', 'ops', operator.slug);
    return href ? [{ ...operator, href }] : [];
  });
  const matching = partners.filter(operator => `${operator.name} ${operator.slug}`.toLocaleLowerCase(language).includes(query.trim().toLocaleLowerCase(language)));
  return <div className={styles.portal} data-theme={theme} lang={language}>
    <aside className={styles.sidebar}>
      <a className={styles.brand} href="/partner">scout<span>/</span>gaming<small>{copy.portal}</small></a>
      <nav aria-label={copy.portal}><a className={styles.active} href="/partner" aria-current="page">{copy.partners}</a></nav>
      {admin && <nav className={styles.levels} aria-label={copy.sameLogin}>
        <p>{copy.sameLogin}</p><a href="/control">{copy.control}<span aria-hidden="true"> ↗</span></a>
        <a href="/play">{copy.player}<span aria-hidden="true"> ↗</span></a>
      </nav>}
      <div className={styles.identity}><span className={styles.avatar} aria-hidden="true">{user.slice(0, 2).toUpperCase()}</span>
        <div><strong>{user}</strong><small>{admin ? copy.admin : copy.member}</small></div></div>
    </aside>
    <main className={styles.main}>
      <header className={styles.topbar}><span>{copy.portal} <span aria-hidden="true">/</span> {copy.partners}</span>
        <div className={styles.headerActions}><div className={styles.preferences}><label>{copy.language}<select value={language} onChange={event => setLanguage(event.target.value)}><option value="sv">Svenska</option><option value="en">English</option></select></label>
          <label>{copy.theme}<select value={theme} onChange={event => setTheme(event.target.value)}><option value="light">{copy.light}</option><option value="dark">{copy.dark}</option></select></label></div>
          <PartnerSessionActions apiBase={apiBase} accessClass={accessClass} language={language} returnTo="/partner"/></div>
      </header>
      <div className={styles.content}>
        <header className={styles.heading}><p className={styles.eyebrow}>{copy.level}</p><h1>{copy.partners}</h1>
          <p>{admin ? copy.directoryIntroAdmin : copy.directoryIntroMember}</p></header>
        {partners.length > 0 && <label className={styles.search}>{copy.search}<input type="search" value={query} onChange={event => setQuery(event.target.value)}/></label>}
        {matching.length ? <section className={styles.grid} aria-label={copy.partners}>
          {matching.map(operator => <a className={styles.partner} key={operator.slug} href={operator.href}>
            <span className={styles.company}>{copy.company}</span><h2>{operator.name}</h2>
            <span className={styles.open}>{copy.open}<span aria-hidden="true"> →</span></span>
          </a>)}
        </section> : <section className={styles.empty} role="status"><h2>{partners.length ? copy.noMatches : copy.noPartners}</h2><p>{partners.length ? copy.noMatchesBody : copy.noPartnersBody}</p></section>}
        <p className={styles.note}>{copy.directoryNote}</p>
      </div>
    </main>
  </div>;
}
