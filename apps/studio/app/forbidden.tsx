'use client';
import { useEffect, useState } from 'react';
import { partnerForbiddenText } from '../lib/partner-words.mjs';

// Next renders this with HTTP 403 when a page calls forbidden() (experimental
// authInterrupts in next.config.mjs). Only Partnerportalen does so today: a view
// the role may not open, or a company the account is not a member of. The page
// gets no data; the address names the view and its permission.
export default function ForbiddenPage() {
  const [pathname, setPathname] = useState('');
  useEffect(() => { setPathname(window.location.pathname); }, []);
  const text = partnerForbiddenText(pathname);
  return <main role="alert" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 'clamp(24px, 5vw, 48px)', background: '#f4f6f5', color: '#111a17', fontFamily: 'var(--sg-next-body, system-ui, sans-serif)' }}>
    <section style={{ maxWidth: 560, background: '#fff', border: '1px solid #d9e0dc', borderRadius: 16, padding: 'clamp(20px, 4vw, 32px)', boxShadow: '0 12px 32px rgba(17, 26, 23, 0.08)' }}>
      <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, background: '#fde8e8', color: '#8a1c1c', fontSize: 12, fontWeight: 700 }}>403</span>
      <h1 style={{ margin: '12px 0 8px', fontSize: 22 }}>{text.title}</h1>
      <p style={{ margin: '0 0 20px', lineHeight: 1.5 }}>{text.body}</p>
      <a href={text.link} style={{ display: 'inline-block', padding: '10px 16px', borderRadius: 10, background: '#111a17', color: '#d7ff3f', textDecoration: 'none', fontWeight: 600 }}>{text.linkText}</a>
    </section>
  </main>;
}
