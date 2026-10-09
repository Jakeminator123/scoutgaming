'use client';

import React from 'react';

// Partner snapshots carry apiBase ending in /snapshot; branding lives beside it.
export function brandingApiBase(apiBase) {
  return typeof apiBase === 'string' ? apiBase.replace(/\/snapshot$/, '') : '';
}

// Plain .mjs with createElement so Kevin's portal test can require it from Node.
// The panel itself (tsx) is loaded only in the browser, after the first read.
export function PartnerAppearanceLoader({ apiBase, operatorSlug, section = 'all', onSaved }) {
  const [state, setState] = React.useState({ status: 'loading' });
  const base = brandingApiBase(apiBase);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [response, panel] = await Promise.all([
          fetch(`${base}/branding?operator=${encodeURIComponent(operatorSlug)}`, {
            credentials: 'same-origin', headers: { accept: 'application/json' },
          }),
          import('./partner-appearance'),
        ]);
        if (cancelled) return;
        if (response.status === 404) { setState({ status: 'none' }); return; }
        if (!response.ok) { setState({ status: 'hidden' }); return; }
        const payload = await response.json().catch(() => null);
        if (cancelled) return;
        if (typeof payload?.packageRevision !== 'number' || !Array.isArray(payload.adjustable) || !Array.isArray(payload.lanes)) {
          setState({ status: 'hidden' }); return;
        }
        if (!payload.presentation) { setState({ status: 'legacy' }); return; }
        setState({ status: 'ready', initial: payload, Panel: panel.PartnerAppearance });
      } catch {
        if (!cancelled) setState({ status: 'hidden' });
      }
    })();
    return () => { cancelled = true; };
  }, [base, operatorSlug]);
  if (state.status === 'hidden') return React.createElement('p', { role: 'alert', className: 'kevin-appearance-state' }, 'Paketets inställningar kunde inte hämtas. Ladda om eller kontrollera din åtkomst.');
  if (state.status === 'legacy') return React.createElement('p', { role: 'status', className: 'kevin-appearance-state' }, 'Inställningarna öppnas när intern personal har publicerat paketet med tre lager.');
  if (state.status === 'loading') return React.createElement('p', { role: 'status', className: 'kevin-appearance-state' }, 'Hämtar utseende…');
  if (state.status === 'none') {
    return React.createElement('p', { role: 'status', className: 'kevin-appearance-state' },
      'Inget operatörspaket är publicerat än. Intern personal publicerar under Publicering.');
  }
  return React.createElement('section', { className: 'kevin-appearance', 'aria-label': 'Utseende inom lanen' },
    React.createElement('h3', null, 'Utseende inom lanen'),
    React.createElement(state.Panel, { initial: state.initial, apiBase: base, operatorSlug, section, onSaved:saved=>{
      setState(current=>current.status==='ready'&&current.initial.operatorId===saved.operatorId?{...current,initial:saved}:current);
      onSaved?.(saved);
    } }));
}
