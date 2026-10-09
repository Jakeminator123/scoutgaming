'use client';

import { useEffect, useState } from 'react';
import { labUrl } from '../lib/lab-url.mjs';
import { CONTROL_TOOLS, controlToolPath, legacyControlView } from '../lib/control-workspace.mjs';
import { workspaceSurfacePath } from '../lib/workspace-surfaces.mjs';
import styles from './control-workspace.module.css';

type ConnectedOperator = { id: string; slug: string; name: string };

function partnerOpsHref(slug: string) {
  return workspaceSurfacePath('partner', 'ops', slug) ?? '/partner';
}

function listedOperators(operators: ConnectedOperator[]) {
  return operators.slice().sort((left, right) =>
    left.name.localeCompare(right.name, 'sv') || left.slug.localeCompare(right.slug, 'sv'));
}

export function ControlWorkspace({ user, operators = [] }: { user: string; initialView?: string; operators?: ConnectedOperator[] }) {
  const listed = listedOperators(operators);
  const [slug, setSlug] = useState(listed[0]?.slug ?? '');
  const selected = listed.find(operator => operator.slug === slug) ?? listed[0];
  useEffect(() => {
    const navigate = () => {
      const next = legacyControlView(window.location.hash);
      if (!next) return;
      const tool = controlToolPath(next);
      if (tool) window.location.replace(labUrl(tool));
    };
    navigate();
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);

  const primary = CONTROL_TOOLS[0];
  return <main className={styles.shell}>
    <header className={styles.intro}><p className={styles.kicker}>// NIVÅ 1 · INTERN DRIFT</p><h1>Översikt</h1>
      <span className={styles.user}>Inloggad som {user}</span>
    </header>
    <section aria-label="Snabbval" className={styles.quick}><h2>Snabbval</h2>{CONTROL_TOOLS.map(tool => <div className={styles.quickItem} key={tool.href}>
      <a className={tool === primary ? 'sg-btn sg-btn-primary' : 'sg-btn sg-btn-secondary'} href={labUrl(tool.href)}><span>{tool.title}</span><span aria-hidden="true">→</span></a>
    </div>)}</section>
    <section className={styles.operators} aria-label="Anslutna bolag"><h2>Anslutna bolag</h2>
      {selected ? <><div className={styles.operatorPick}><label className={styles.operatorLabel}>Bolag
        <select value={selected.slug} onChange={event => setSlug(event.target.value)}>{listed.map(operator =>
          <option key={operator.id} value={operator.slug}>{operator.name}</option>)}</select></label>
        <a className="sg-btn sg-btn-secondary" href={partnerOpsHref(selected.slug)}>Öppna arbetsyta →</a></div>
        <ul className={styles.operatorList}>{listed.map(operator => <li key={operator.id}>
          <a href={partnerOpsHref(operator.slug)}>{operator.name}</a><span>{operator.slug}</span>
        </li>)}</ul></> : <p>Inga bolag ännu.</p>}</section>
    <section className={styles.levels} aria-label="Spelbolag och spelare"><div><h2>Nivå 2 · Spelbolag</h2><a href="/partner">Öppna spelbolagens arbetsytor →</a></div>
      <div><h2>Nivå 3 · Spelare</h2><a href="/play">Öppna spelarytan →</a></div></section>
  </main>;
}
