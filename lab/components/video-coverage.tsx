'use client';
import { useMemo } from 'react';
import { auditStudio } from '../lib/studio-audit.mjs';
import type { StudioProject } from '../lib/studio-model.mjs';
import type { VideoInventory } from './studio-types';
import { resolveOriginalDefault, type OriginalMediaCatalog } from '../lib/original-media.mjs';
import styles from './video-intake.module.css';

export function VideoCoverage({ project, inventory, originals, dealerId, onOpen }: {project: StudioProject; inventory: VideoInventory; originals?: OriginalMediaCatalog | null; dealerId: string; onOpen: (id: string) => void}) {
  const audit = useMemo(() => auditStudio(project, inventory.videos), [project, inventory.videos]);
  const lines = audit.lines.filter(l => l.dealerId === dealerId).map(item => {
    const line = project.lines.find(line => line.dealerId === dealerId && line.eventId === item.eventId);
    const baseline = line?.variants.find(variant => variant.id === line.baselineVariantId);
    const event = project.events.find(event => event.id === item.eventId);
    const original = baseline && baseline.videoGenerationId == null && event ? resolveOriginalDefault(originals, dealerId, event.exampleEvent) : null;
    return { ...item, bindingId: baseline?.videoGenerationId, original };
  });
  return <details className={styles.audit}><summary>Standardlinjer & kontroll av kopplingar · {lines.filter(l => l.standardAvailable).length}/{lines.length} med egen tillgänglig standardvideo</summary>
    <div className={styles.stats}><span><strong>{audit.events}</strong>eventnoder</span><span><strong>{audit.variants}</strong>variantposter</span><span><strong>{audit.uniqueMotions}</strong>unika 2D-rörelser + {audit.socialMotions} social</span><span><strong>{audit.uniqueVideoHashes}</strong>unika videofiler</span><span><strong>{audit.boundVideos}</strong>kopplade videor</span></div>
    <p className="helper">2D-rörelser delas av fyra dealers. Unika betyder olika rörelsedata/filhashar, inte bedömd visuell skillnad. Tabellen gäller projektutkastet. Originalförval visas för det sparade exemplet och räknas inte som egna videokopplingar. Ett klipp per bred nod bevisar inte täckning av alla repliker eller kortplatser.</p>
    {audit.problems.length ? <div role="status" className={styles.error}><strong>{audit.problems.length} kopplingar behöver ses över</strong><ul>{audit.problems.map(p => <li key={p}>{p}</li>)}</ul></div> : <p>Alla 2D-referenser matchar sina event. Inga saknade eller felkategoriserade videoreferenser hittades.</p>}
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Event</th><th>Standardvideo</th><th>Alternativ med video</th></tr></thead><tbody>{lines.map(l => <tr key={l.eventId}><td><button type="button" onClick={() => onOpen(l.eventId)}>{l.label}</button><small>{l.eventId}</small></td><td>{l.standardVideo ?? l.bindingId ?? (l.original ? `Originalförval · ${l.original.label}` : 'Ingen kopplad · 2D-reserv')}{l.bindingId && !l.standardAvailable ? ' · fil saknas eller koppling behöver granskas' : ''}{l.original ? <small>{l.eventId === 'speak.other' ? `Exemplet ${l.original.situation}; byts med exakt replik` : 'För sparat eventexempel'} · ej visuellt godkänt</small> : null}{l.situation ? <small>Avgränsad till {l.situation}</small> : null}</td><td>{l.boundAlternatives}/{l.alternatives}</td></tr>)}</tbody></table></div>
  </details>;
}
