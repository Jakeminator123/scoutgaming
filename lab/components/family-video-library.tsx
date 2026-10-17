'use client';
import { useState } from 'react';
import type { VideoInventory } from '../../packages/presentation/contracts/media-inventory.mjs';
import { clipLabel, clipSituationLabel } from '../lib/clip-label.mjs';
import { mediaFamilyFolder, mediaSituationLabel } from '../../packages/presentation/runtime/media-family-policy.mjs';
import styles from './media-family-editor.module.css';
import type { StudioProject } from '../../packages/presentation/contracts/studio-model.mjs';
import {DealerClipPreview} from './dealer-video-surface';

const familiesFor = (inventory: VideoInventory, dealerId: string) => (inventory.families ?? []).filter(family => family.dealerId === dealerId);
const matchesGroup = (eventId: string, type: string) => eventId.startsWith(`${type}.`) || type === 'deal' && eventId === 'reveal.dealer';
const familyLabel = (family: { eventId: string; situation: string }) => clipSituationLabel(family.eventId, family.situation);

export function FamilyNavigation({ inventory, project, dealerId, selectedFamilyId, eventId, filter, onOpen }: {
  inventory: VideoInventory; project: StudioProject; dealerId: string; selectedFamilyId?: string; eventId: string; filter: string;
  onOpen: (eventId: string, situation: string) => void;
}) {
  const families = (inventory.families ?? []).filter(family => family.dealerId === dealerId
    && `${mediaFamilyFolder(family)} ${familyLabel(family)}`.toLowerCase().includes(filter.trim().toLowerCase()));
  return <div className="event-tree" aria-label="Videomappar och spelsignaler"><div className="tree-title"><span>VIDEOMAPPAR</span><span>{families.length}</span></div>
    {([['deal', 'Kort till plats'], ['speak', 'Exakt replik'], ['idle', 'Grundloop']] as const).map(([type, title]) => <div className="event-group" key={type}><div className="event-group-title">{title}</div>
      {families.filter(family => matchesGroup(family.eventId, type)).map(family => <button type="button" key={family.id} className={`event-node ${family.id === selectedFamilyId ? 'active' : ''}`} aria-pressed={family.id === selectedFamilyId} onClick={() => onOpen(family.eventId, family.situation)}><i /><span className="event-node-label">{familyLabel(family)}<small>{mediaFamilyFolder(family)} · {family.variantIds.length} varianter</small></span></button>)}
    </div>)}
    <details><summary>Övriga spelsignaler</summary>{project.events.filter(event => ['turn', 'settle', 'reveal'].includes(event.sourceType) && !familiesFor(inventory, dealerId).some(family => family.eventId === event.id) && event.label.toLowerCase().includes(filter.toLowerCase())).map(event => <button type="button" className={`event-node ${event.id === eventId ? 'active' : ''}`} key={event.id} onClick={() => onOpen(event.id, '')}>{event.label}</button>)}</details>
  </div>;
}

export function FamilyOverview({ inventory, project, dealerId, onOpen, hrefFor }: {
  inventory: VideoInventory; project: StudioProject; dealerId: string;
  onOpen?: (eventId: string, situation: string) => void;
  hrefFor?: (eventId: string, situation: string) => string;
}) {
  const groups = [['deal', 'Kort till rätt plats'], ['speak', 'Exakta repliker'], ['idle', 'Grundloop']] as const;
  return <section aria-label="Händelser och videomappar"><p className="helper">Välj en destination eller replik för att spela dess standardklipp och se varianterna som faktiskt finns.</p>
    {groups.map(([type, title]) => <section key={type} className={styles.situation}><h2>{title}</h2><div className={styles.overviewGrid}>{(inventory.families ?? []).filter(family => family.dealerId === dealerId && matchesGroup(family.eventId, type)).map(family => {
      const href = hrefFor?.(family.eventId, family.situation);
      const body = <><strong>{familyLabel(family)}</strong><code>{mediaFamilyFolder(family)}/</code><small>{family.standardIds.length} standard · {family.variantIds.length} varianter</small></>;
      return href ? <a key={family.id} className={styles.familyButton} href={href}>{body}</a> : <button type="button" className={styles.familyButton} key={family.id} onClick={() => onOpen?.(family.eventId, family.situation)}>{body}</button>;
    })}</div></section>)}
    <details className={styles.situation}><summary>Övriga spelsignaler</summary><p>Tur och resultat har egna eventdata. Talet kommer separat som en exakt replik.</p>{project.events.filter(event => ['turn', 'settle', 'reveal'].includes(event.sourceType) && !familiesFor(inventory, dealerId).some(family => family.eventId === event.id)).map(event => {
      const href = hrefFor?.(event.id, '');
      return href ? <a className="text-button" key={event.id} href={href}>{event.label}</a> : <button className="text-button" key={event.id} onClick={() => onOpen?.(event.id, '')}>{event.label}</button>;
    })}</details>
  </section>;
}

const namedClip = (video: { id: string; familyId?: string; role?: string; relativePath?: string; fileName?: string; classification?: { label?: string } } | undefined, id: string, role: string, clipLabels?: Record<string, string>) =>
  clipLabel({ id: video?.id ?? id, familyId: video?.familyId, role: video?.role ?? role, relativePath: video?.relativePath }, clipLabels);

export function FamilyVideoLibrary({ inventory, dealerId, onOpen, onRefresh, refreshing, familyType, clipLabels }: {
  inventory: VideoInventory; dealerId: string; onOpen: (eventId: string, situation: string) => void; onRefresh: () => void; refreshing: boolean; familyType?: 'deal' | 'speak'; clipLabels?: Record<string, string>;
}) {
  const [filter, setFilter] = useState('');
  const [previewId, setPreviewId] = useState('');
  const needle = filter.trim().toLocaleLowerCase('sv');
  const videosById = new Map(inventory.videos.map(video => [video.id, video]));
  const dealerFamilies = (inventory.families ?? []).filter(family => family.dealerId === dealerId && (!familyType || matchesGroup(family.eventId, familyType)));
  const families = dealerFamilies.filter(family =>
    `${mediaFamilyFolder(family)} ${familyLabel(family)} ${family.situation}`.toLocaleLowerCase('sv').includes(needle)
    || [...family.standardIds, ...family.variantIds].some(id => {
      const video = videosById.get(id);
      return `${namedClip(video, id, family.standardIds.includes(id) ? 'standard' : 'variant', clipLabels)} ${video?.label ?? ''} ${video?.fileName ?? ''} ${id}`.toLocaleLowerCase('sv').includes(needle);
    }));
  const preview = videosById.get(previewId);
  const previewName = preview ? namedClip(preview, preview.id, preview.role ?? 'standard', clipLabels) : '';
  const dealFamilies = families.filter(family => matchesGroup(family.eventId, 'deal'));
  const positionGroups = [
    ...Array.from({ length: 7 }, (_, box) => ({ id: `box${box}`, label: `Spelarplats ${box + 1}`, families: dealFamilies.filter(family => family.situation === `box${box}`) })),
    { id: 'dealer', label: 'Dealer', families: dealFamilies.filter(family => ['dealer-up', 'dealer-hole'].includes(family.situation)) },
  ];
  function card(family: typeof families[number], position = false) {
    const ids = [...family.standardIds, ...family.variantIds];
    return <article key={family.id} className={styles.situation} data-family-id={family.id} data-situation={family.situation}>
      <header className={styles.cardHeader}><h3>{position && /^box[0-6]$/.test(family.situation) ? 'Kort till spelaren' : familyLabel(family)}</h3></header>
      <div className={styles.cardActions}>{ids.map((id, index) => {
        const video = videosById.get(id);
        const name = namedClip(video, id, family.standardIds.includes(id) ? 'standard' : 'variant', clipLabels);
        return <button key={id} type="button" title={video?.fileName ?? id} disabled={!video?.available} aria-label={`Spela ${name}`} onClick={() => setPreviewId(id)}>{name}{family.standardIds.includes(id) ? '' : ` · ${index - family.standardIds.length + 1}`}{!video?.available ? ' · saknas' : ''}</button>;
      })}<button type="button" aria-label={`Inställningar · ${familyLabel(family)}`} onClick={() => onOpen(family.eventId, family.situation)}>Inställningar</button></div>
      <details className={styles.files}><summary>Avancerat · filer och identitet</summary><code>{family.id}</code><code>{mediaFamilyFolder(family)}/</code>
        {ids.map(id => <p key={id}><code>{videosById.get(id)?.fileName ?? id}</code><br /><code>{id}</code></p>)}
      </details>
    </article>;
  }
  return <section aria-label="Klipp och situationer">
    <div className={styles.libraryHeader}><label className={styles.search}>Hitta klipp<input type="search" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Namn, replik eller spelarplats…" /></label><button type="button" className="text-button" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Läser…' : 'Uppdatera klipp'}</button></div>
    {preview?.available ? <div className={styles.situation}><strong>{previewName}</strong><DealerClipPreview key={preview.id} url={preview.previewUrl} framing={preview.classification?.framing} compositing={preview.classification?.compositing} muted label={`Förhandsvisa ${previewName}`}/><button type="button" className="text-button" onClick={() => setPreviewId('')}>Stäng klippet</button></div> : null}
    {familyType !== 'speak' ? <div className={styles.positionGrid} aria-label="Spelarpositioner och dealer">{positionGroups.filter(group => !needle || group.families.length).map(group => <section className={styles.position} key={group.id} data-position={group.id}><h2>{group.label}</h2>{group.families.length ? group.families.map(family => card(family, true)) : <p className="helper">Exakt klippkoppling saknas.</p>}</section>)}</div> : null}
    <div className={styles.libraryGrid}>{families.filter(family => !matchesGroup(family.eventId, 'deal')).map(family => card(family))}</div>
    {!families.length && needle ? <p>Inga klipp matchar sökningen.</p> : null}
  </section>;
}
