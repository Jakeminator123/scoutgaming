'use client';

import React from 'react';

// Partner snapshots carry apiBase ending in /snapshot; branding lives beside it.
export function brandingApiBase(apiBase) {
  return typeof apiBase === 'string' ? apiBase.replace(/\/snapshot$/, '') : '';
}

/** @param {Omit<Parameters<typeof import('./partner-appearance').PartnerAppearance>[0], 'initial'> & {operatorId?: string}} props */
export function PartnerAppearanceLoader({ apiBase, operatorId, operatorSlug, onSaved, language = 'sv', roomId, onRoomChange = undefined, onDirtyChange, onBusyChange = undefined, onStatus = undefined, disabled = false, roomLayout = false, adminChoices = false, active = true, roomState = undefined, settings = undefined, history = undefined, children = null }) {
  const [state, setState] = React.useState({ status: 'loading' });
  const base = brandingApiBase(apiBase);
  const identity = `${base}:${operatorId || ''}:${operatorSlug}`;
  const en = language === 'en';
  const activeIdentity = React.useRef(identity);
  activeIdentity.current = identity;
  React.useEffect(() => {
    let cancelled = false; activeIdentity.current = identity;
    const abort = new AbortController();
    setState({ status: 'loading', identity });
    (async () => {
      try {
        if (!/^(?:\/studio)?\/api\/partner$/.test(base)) { setState({ status: 'hidden', identity }); return; }
        const [response, panel] = await Promise.all([
          fetch(`${base}/branding?operator=${encodeURIComponent(operatorSlug)}`, {
            credentials: 'same-origin', cache: 'no-store', signal: abort.signal, headers: { accept: 'application/json' },
          }),
          import('./partner-appearance'),
        ]);
        if (cancelled) return;
        if (response.status === 404) { setState({ status: 'none', identity }); return; }
        if (response.status === 403) { setState({ status: 'denied', identity }); return; }
        if (!response.ok) { setState({ status: 'hidden', identity }); return; }
        const payload = await response.json().catch(() => null);
        if (cancelled) return;
        if (!Number.isSafeInteger(payload?.packageRevision) || payload.packageRevision < 1 || !Array.isArray(payload.adjustable) || !Array.isArray(payload.lanes)
          || typeof payload.operatorId !== 'string' || operatorId && payload.operatorId !== operatorId
          || payload.rooms !== undefined && (!Array.isArray(payload.rooms) || payload.rooms.some(room => room?.game !== undefined && !['blackjack','roulette'].includes(room.game)))) {
          setState({ status: 'hidden', identity }); return;
        }
        if (!payload.presentation) { setState({ status: 'legacy', identity }); return; }
        setState({ status: 'ready', identity, initial: payload, Panel: panel.PartnerAppearance });
      } catch {
        if (!cancelled) setState({ status: 'hidden', identity });
      }
    })();
    return () => { cancelled = true; if (activeIdentity.current === identity) activeIdentity.current = null; abort.abort(); };
  }, [base, operatorId, operatorSlug, identity]);
  const current = state.identity === identity ? state : { status: 'loading' };
  // The sibling editor (children) stays available while the layer panel is loading or unavailable.
  const state_ = (role, text) => {
    const line = React.createElement('p', { role, className: 'kevin-appearance-state' }, text);
    return children ? React.createElement(React.Fragment, null, line, children) : line;
  };
  if (current.status === 'hidden') return state_('alert', en ? 'The appearance could not be loaded. Reload or check your access.' : 'Spelbordets utseende kunde inte hämtas. Ladda om eller kontrollera din åtkomst.');
  if (current.status === 'denied') return state_('alert', en ? 'Your role lacks the permission presentations.read, so the table appearance is not shown.' : 'Rollen saknar behörigheten presentations.read, så spelbordets utseende visas inte.');
  if (current.status === 'legacy') return state_('status', en ? 'Scoutgaming must first publish a package with separate layers.' : 'Inställningarna öppnas när Scoutgaming har publicerat paketet med tre lager.');
  if (current.status === 'loading') return state_('status', en ? 'Loading appearance…' : 'Hämtar utseende…');
  if (current.status === 'none') return state_('status', en ? 'No package is published yet. Scoutgaming publishes the company package first.' : 'Inget paket är publicerat än. Scoutgaming publicerar bolagets paket först.');
  if (roomId && !current.initial.rooms?.some(room => room.id === roomId)) return state_('alert', en ? 'This table is not available in the current published package. Reload or check the table publication.' : 'Spelbordet är inte tillgängligt i det aktuella publicerade paketet. Ladda om eller kontrollera spelbordets publicering.');
  return React.createElement('section', { className: 'kevin-appearance', 'aria-label': en ? 'Appearance and publishing' : 'Utseende och publicering' },
    React.createElement(current.Panel, { key: identity, initial: current.initial, apiBase: base, operatorSlug, language, active, roomId, onRoomChange, onDirtyChange, onBusyChange, onStatus, disabled, roomLayout, adminChoices, roomState, settings, history, onSaved: saved => {
      if (activeIdentity.current !== identity || saved.operatorId !== current.initial.operatorId) return;
      setState(previous => previous.status === 'ready' && previous.identity === identity && previous.initial.operatorId === saved.operatorId ? { ...previous, initial: saved } : previous);
      onSaved?.(saved);
    } }, children));
}
