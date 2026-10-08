'use client';

import {useEffect, useState} from 'react';
import {
  OPERATOR_STORAGE_KEY, clearedOperatorLocation, operatorChoice, operatorLoginPath, operatorPlayPath,
  operatorPublicView, operatorSlugFromSearch,
} from '@/lib/player-operator.mjs';

type Operator = {slug: string, name: string};

export function PlayerLobbyOperator({
  initial, playHref, playLabel, directPlay,
}: {
  initial: Operator | null;
  playHref: string;
  playLabel: string;
  directPlay: boolean;
}) {
  const [operator, setOperator] = useState<Operator | null>(initial);
  useEffect(() => {
    const stored = window.localStorage.getItem(OPERATOR_STORAGE_KEY);
    const slug = operatorChoice({search: window.location.search, stored});
    if (!slug) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/operators/${encodeURIComponent(slug)}`, {headers: {accept: 'application/json'}});
        const body = response.ok ? await response.json() : null;
        if (cancelled) return;
        const view = operatorPublicView(body, slug);
        if (!view) {
          if (operatorSlugFromSearch(window.location.search)) setOperator(null);
          return;
        }
        window.localStorage.setItem(OPERATOR_STORAGE_KEY, view.slug);
        setOperator(view);
      } catch {
        if (!cancelled && !initial) setOperator(null);
      }
    })();
    return () => { cancelled = true; };
  }, [initial]);

  const href = operator ? (directPlay ? operatorPlayPath(operator.slug) : operatorLoginPath(operator.slug)) : playHref;
  function clearOperator() {
    window.localStorage.removeItem(OPERATOR_STORAGE_KEY);
    window.location.assign(clearedOperatorLocation(window.location.href));
  }
  return <>
    {operator ? <p className="mt-6 text-slate-200" data-operator>Spelar hos: {operator.name}</p> : null}
    {operator ? <button type="button" data-operator-clear className="mt-3 text-sm text-slate-300 underline" onClick={clearOperator}>Byt bolag</button> : null}
    <a href={href} className="mt-7 inline-block rounded-lg bg-emerald-300 px-6 py-3 font-semibold text-slate-950">{playLabel}</a>
  </>;
}
