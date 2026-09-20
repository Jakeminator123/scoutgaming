'use client';
import { useMemo } from 'react';
import { auditStudio } from '../lib/studio-audit.mjs';
import type { StudioProject } from '../lib/studio-model.mjs';
import type { VideoInventory } from './studio-types';
import styles from './video-intake.module.css';

export function VideoCoverage({ project, inventory, dealerId, onOpen }: {project: StudioProject; inventory: VideoInventory; dealerId: string; onOpen: (id: string) => void}) {
  const audit = useMemo(() => auditStudio(project, inventory.videos), [project, inventory.videos]);
  const lines = audit.lines.filter(l => l.dealerId === dealerId);
  return <details className={styles.audit}><summary>Standardlinjer & kontroll av kopplingar · {lines.filter(l => l.standardAvailable).length}/{lines.length} med tillgänglig standardvideo</summary>
    <div className={styles.stats}><span><strong>{audit.events}</strong>eventnoder</span><span><strong>{audit.variants}</strong>variantposter</span><span><strong>{audit.uniqueMotions}</strong>unika 2D-rörelser + {audit.socialMotions} social</span><span><strong>{audit.uniqueVideoHashes}</strong>unika videofiler</span><span><strong>{audit.boundVideos}</strong>kopplade videor</span></div>
    <p className="helper">2D-rörelser delas av fyra dealers. Unika betyder olika rörelsedata/filhashar, inte bedömd visuell skillnad. Tabellen gäller projektutkastet. Ett klipp per bred nod bevisar inte täckning av alla repliker eller kortplatser.</p>
    {audit.problems.length ? <div role="status" className={styles.error}><strong>{audit.problems.length} kopplingar behöver ses över</strong><ul>{audit.problems.map(p => <li key={p}>{p}</li>)}</ul></div> : <p>Alla 2D-referenser matchar sina event. Inga saknade eller felkategoriserade videoreferenser hittades.</p>}
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Event</th><th>Standardvideo</th><th>Alternativ med video</th></tr></thead><tbody>{lines.map(l => <tr key={l.eventId}><td><button type="button" onClick={() => onOpen(l.eventId)}>{l.label}</button><small>{l.eventId}</small></td><td>{l.standardVideo ?? 'Ingen kopplad · 2D-reserv'}{l.standardVideo && !l.standardAvailable ? ' · fil saknas' : ''}{l.situation ? <small>Avgränsad till {l.situation}</small> : null}</td><td>{l.boundAlternatives}/{l.alternatives}</td></tr>)}</tbody></table></div>
  </details>;
}
