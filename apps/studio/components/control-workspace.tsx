'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { labUrl } from '../lib/lab-url.mjs';
import { controlToolPath, legacyControlView } from '../lib/control-workspace.mjs';
import { workspaceSurfacePath } from '../../../packages/navigation/workspace-surfaces.mjs';
import { createOverviewReader, overviewNextStep, selectedOverviewOperator, type OverviewOperator, type OverviewStudio, type OverviewReader } from '../lib/control-overview.mjs';
import styles from './control-workspace.module.css';

export function ControlWorkspace({ user, operators = [], operatorStatus = 'unavailable', studio = null }: {
  user: string; initialView?: string; operators?: OverviewOperator[];
  operatorStatus?: 'live' | 'demo' | 'unavailable'; studio?: OverviewStudio | null;
}) {
  const listed = (operatorStatus === 'unavailable' ? [] : operators).slice().sort((a, b) => a.name.localeCompare(b.name, 'sv') || a.slug.localeCompare(b.slug, 'sv'));
  const [choice, setChoice] = useState<string | null>(null);
  const selected = selectedOverviewOperator(listed, choice);
  const readerRef = useRef<OverviewReader | null>(null);
  if (!readerRef.current) readerRef.current = createOverviewReader();
  const reader = readerRef.current;
  const snapshot = useSyncExternalStore(reader.subscribe, reader.getSnapshot, reader.getSnapshot);
  const current = snapshot.key === selected?.slug;
  const status = current ? snapshot.status : 'idle';
  const data = current && status === 'ready' ? snapshot.data : null;
  const live = operatorStatus === 'live';
  const next = overviewNextStep({ operatorStatus, operator: selected, studio, status, data });
  const changed = next.kind === 'retry' && status === 'ready';
  const confirmed = live && data && !changed ? data : null;
  const roomCount = confirmed?.rooms.length;
  const dealers = [...new Map(confirmed?.rooms.flatMap(room => room.dealers).map(dealer => [dealer.id, dealer]) ?? []).values()];
  const presentations = [...new Map(confirmed?.rooms.map(room => [room.presentation.id, room.presentation]) ?? []).values()];
  const query = selected && live ? '?' + new URLSearchParams({ operator: selected.id }) : '';
  const publishingHref = labUrl('/control/rooms' + query);
  const companyHref = labUrl('/control/companies' + query);
  const playerHref = selected && live ? '/play?operator=' + encodeURIComponent(selected.slug) : '/play';
  const partnerHref = selected ? workspaceSurfacePath('partner', 'ops', selected.slug) ?? '/partner' : '/partner';
  const nextHref = ({ studio: labUrl('/control/clips'), composition: labUrl('/control/compositions' + query), publish: publishingHref, company: companyHref, play: playerHref } as Record<string, string>)[next.kind];
  const firstPublished = confirmed?.rooms[0];
  const compositionHref = labUrl('/control/compositions?' + new URLSearchParams({ ...(selected && live ? { operator: selected.id } : {}), ...(firstPublished ? { composition: firstPublished.presentation.id } : {}) }));

  useEffect(() => {
    const sync = () => setChoice(new URLSearchParams(window.location.search).get('operator'));
    const navigate = () => { const view = legacyControlView(window.location.hash); const tool = view && controlToolPath(view); if (tool) window.location.replace(labUrl(tool)); };
    sync(); navigate();
    window.addEventListener('popstate', sync); window.addEventListener('hashchange', navigate);
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', navigate); };
  }, []);
  useEffect(() => {
    if (live && selected) void reader.read(selected.slug);
    return () => reader.cancel();
  }, [reader, live, selected?.slug]);
  function choose(id: string) {
    setChoice(id);
    const params = new URLSearchParams(window.location.search);
    params.set('operator', id);
    window.history.replaceState(null, '', window.location.pathname + '?' + params + window.location.hash);
  }
  const steps = [
    { title: 'Dealer & klipp', detail: 'Välj grundloop, tal och reaktioner. Granska i verklig uppspelning.', href: labUrl('/control/clips' + query), link: 'Arbeta med dealers', meta: studio ? studio.dealers.length + ' dealers i studion' : 'Gemensamt innehåll', scope: 'STUDIO' },
    { title: 'Sammansättning', detail: 'Kombinera dealer, bord och bakgrund till en sparad sammansättning.', href: compositionHref, link: 'Sätt ihop sammansättning', meta: studio ? studio.lanes.length + ' sparade sammansättningar' : 'Sparade sammansättningar', scope: 'STUDIO' },
    { title: 'Bolagets publicering', detail: 'Välj vad bolaget får använda. En ändring i Studio behöver publiceras.', href: publishingHref, link: 'Hantera publicering', meta: confirmed ? confirmed.packageRevision ? 'Publicerat · version ' + confirmed.packageRevision : 'Ännu inte publicerat' : 'Status inväntas', scope: 'VALT BOLAG' },
    { title: 'Spelrum', detail: 'Spelarens ingång till bolagets publicerade sammansättning och dealers.', href: roomCount ? playerHref : publishingHref, link: roomCount ? 'Öppna spellobbyn' : 'Skapa spelrum', meta: roomCount === undefined ? 'Status inväntas' : roomCount + ' öppna spelrum', scope: 'VALT BOLAG' },
  ];
  return <main className={styles.shell}>
    <header className={styles.intro}><div><p className={styles.eyebrow}>DIN ARBETSYTA</p><h1>Översikt</h1><p>Från dealer till spelrum. Arbeta i Studio, publicera till ett bolag och se resultatet i lobbyn.</p></div><span className={styles.user}>Inloggad som {user}</span></header>
    <section className={styles.companyBar} aria-label="Bolagsval">
      <div className={styles.companySelect}>{selected ? <label>Bolag<select value={selected.id} onChange={event => choose(event.target.value)}>{listed.map(operator => <option key={operator.id} value={operator.id}>{operator.name}</option>)}</select></label>
        : <p role="status">{operatorStatus === 'unavailable' ? 'Bolagslistan kunde inte hämtas.' : 'Inga bolag ännu.'}</p>}
        <span className={styles.pill}>{operatorStatus === 'demo' ? 'Demonstrationsbolag' : operatorStatus === 'unavailable' ? 'Bolagsstatus saknas' : 'Anslutna bolag · ' + listed.length}</span></div>
      <div className={styles.actions}><a href={companyHref}>Bolag & team ↗</a><button className="sg-btn sg-btn-secondary" type="button" onClick={() => window.location.reload()}>Uppdatera status</button></div>
    </section>
    <div className={styles.summaryGrid}>
      <section className={styles.next} aria-labelledby="overview-next" aria-busy={next.kind === 'loading'}>
        <p className={styles.eyebrow}>NÄSTA STEG{selected && live ? ' · ' + selected.name : ''}</p>
        <h2 id="overview-next">{next.title}</h2><p className={styles.nextText} role={next.kind === 'retry' ? 'status' : undefined}>{next.text}</p>
        <div className={styles.actions}>{nextHref ? <a className="sg-btn sg-btn-primary" href={nextHref}>{next.label} <span aria-hidden="true">→</span></a>
          : next.kind === 'retry' ? <button className="sg-btn sg-btn-primary" type="button" onClick={() => { if (status === 'error' && selected) void reader.read(selected.slug); else window.location.reload(); }}>{next.label}</button>
            : <span role="status" className={styles.loading}>{next.label}</span>}
          {live && selected && next.kind !== 'publish' ? <a href={publishingHref}>Spelrum & publicering ↗</a> : null}</div>
        <p className={styles.hint}>Ett nytt spelrum publicerar den valda sammansättningen i samma steg.</p>
      </section>
      <section className={styles.statusCard} aria-labelledby="overview-status"><div className={styles.cardHeading}><h2 id="overview-status">Bolagets publicering</h2><span className={styles.pill} data-state={confirmed ? 'confirmed' : 'unknown'}>{confirmed ? 'Hämtad från spellobbyn' : operatorStatus === 'demo' ? 'Demonstration' : next.kind === 'loading' ? 'Hämtar…' : 'Ej bekräftad'}</span></div>
        <dl className={styles.metrics}><div><dt>Öppna spelrum</dt><dd>{roomCount ?? '—'}</dd></div><div><dt>Valbara dealers</dt><dd>{confirmed ? dealers.length : '—'}</dd></div><div><dt>Sammansättningar i spelrum</dt><dd>{confirmed ? presentations.length : '—'}</dd></div><div><dt>Paketversion</dt><dd>{confirmed ? confirmed.packageRevision ?? 'Ej publicerat' : '—'}</dd></div></dl>
        <p className={styles.hint}>Visar det bolagets spelare kan välja. Sparade ändringar och läppsynksbedömningar kontrolleras i Studio.</p>
      </section>
    </div>
    <section className={styles.flow} aria-labelledby="overview-flow"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>ARBETSGÅNGEN</p><h2 id="overview-flow">Fyra steg till spelaren</h2></div><p>Gemensamt innehåll → bolagets publicering</p></div>
      <ol className={styles.steps}>{steps.map((step, index) => <li className={styles.step} key={step.title}><div className={styles.stepTop}><span className={styles.number}>{String(index + 1).padStart(2, '0')}</span><span className={styles.eyebrow}>{step.scope}</span></div><h3>{step.title}</h3><p>{step.detail}</p><span className={styles.stepMeta}>{step.meta}</span><a href={step.href}>{step.link} <span aria-hidden="true">→</span></a></li>)}</ol>
    </section>
    <div className={styles.bottomGrid}>
      <section className={styles.rooms} aria-labelledby="overview-rooms"><div className={styles.cardHeading}><h2 id="overview-rooms">Spelrum för {selected?.name ?? 'valt bolag'}</h2>{confirmed ? <span className={styles.pill}>{roomCount} öppna</span> : null}</div>
        {confirmed?.rooms.length ? <ul className={styles.roomList}>{confirmed.rooms.map(room => <li key={room.id}><div><strong>{room.name}</strong><p>{room.presentation.label} · {room.dealers.map(dealer => dealer.label).join(', ')}</p></div><a href={room.playUrl}>Öppna rum <span aria-hidden="true">↗</span></a></li>)}</ul>
          : <p className={styles.empty}>{confirmed ? 'Inga öppna spelrum ännu. Skapa det första i Spelrum & publicering.' : operatorStatus === 'demo' ? 'Demonstrationen visar inga verkliga spelrum.' : 'Spelrum visas när bolagets publicering har kunnat bekräftas.'}</p>}
      </section>
      <section className={styles.destinations} aria-labelledby="overview-destinations"><h2 id="overview-destinations">Rätt vy för rätt arbete</h2><a href={partnerHref}><span>Bolagets arbetsyta<small>Bolagets spelrum, tillåtna val och team. Kräver partnerinloggning eller en aktiv administratörssession.</small></span><span aria-hidden="true">↗</span></a><a href={labUrl('/control/administration?tab=media-review')}><span>Talgranskning<small>Bedöm tal och läppsynk för exakt ljud- och videopar.</small></span><span aria-hidden="true">→</span></a><a href={labUrl('/control/guide')}><span>Guide & hjälp<small>Begrepp, arbetssätt och hur delarna hänger ihop.</small></span><span aria-hidden="true">→</span></a></section>
    </div>
  </main>;
}
