'use client';
import { useState } from 'react';
import type { VideoInventory } from './studio-types';
import { clipLabel } from '../lib/clip-label.mjs';
import { mediaFamilyFolder, mediaSituationLabel } from '../lib/media-family-policy.mjs';
import styles from './media-family-editor.module.css';
import type { StudioProject } from '../lib/studio-model.mjs';

const familiesFor = (inventory: VideoInventory, dealerId: string) => (inventory.families ?? []).filter(family => family.dealerId === dealerId);
const matchesGroup = (eventId: string, type: string) => eventId.startsWith(`${type}.`) || type === 'deal' && eventId === 'reveal.dealer';
const familyLabel = (family: { eventId: string; situation: string }) => family.eventId === 'reveal.dealer' ? 'Vänd croupierns dolda kort' : mediaSituationLabel(family.situation);

export function FamilyNavigation({ inventory, project, dealerId, selectedFamilyId, eventId, filter, onOpen }: {
  inventory: VideoInventory; project: StudioProject; dealerId: string; selectedFamilyId?: string; eventId: string; filter: string;
  onOpen: (eventId: string, situation: string) => void;
}) {
  const families = (inventory.families ?? []).filter(family => family.dealerId === dealerId
    && `${mediaFamilyFolder(family)} ${familyLabel(family)}`.toLowerCase().includes(filter.trim().toLowerCase()));
  return <div className="event-tree" aria-label="Videomappar och spelsignaler"><div className="tree-title"><span>VIDEOMAPPAR</span><span>{families.length}</span></div>
    {([['deal', 'Kort till plats'], ['speak', 'Exakt replik'], ['idle', 'Vänteläge']] as const).map(([type, title]) => <div className="event-group" key={type}><div className="event-group-title">{title}</div>
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
  const groups = [['deal', 'Kort till rätt plats'], ['speak', 'Exakta repliker'], ['idle', 'Vänteläge']] as const;
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

const namedClip = (video: { id: string; familyId?: string; role?: string; relativePath?: string; fileName?: string; classification?: { label?: string } } | undefined, id: string, role: string, clipLabels?: Record<string, string>) => {
  const legacy = video?.classification?.label || video?.fileName || id;
  const name = clipLabel({ id: video?.id ?? id, familyId: video?.familyId, role: video?.role ?? role, relativePath: video?.relativePath }, clipLabels);
  return { name, legacy, text: name === legacy ? legacy : `${name} · ${legacy}` };
};

export function FamilyVideoLibrary({ inventory, dealerId, onOpen, onRefresh, refreshing, familyType, clipLabels }: {
  inventory: VideoInventory; dealerId: string; onOpen: (eventId: string, situation: string) => void; onRefresh: () => void; refreshing: boolean; familyType?: 'deal' | 'speak'; clipLabels?: Record<string, string>;
}) {
  const [filter, setFilter] = useState('');
  const [previewId, setPreviewId] = useState('');
  const needle = filter.trim().toLocaleLowerCase('sv');
  const videosById = new Map(inventory.videos.map(video => [video.id, video]));
  const families = (inventory.families ?? []).filter(family => family.dealerId === dealerId
    && (!familyType || matchesGroup(family.eventId, familyType))
    && (`${mediaFamilyFolder(family)} ${familyLabel(family)} ${family.situation}`.toLocaleLowerCase('sv').includes(needle)
      || [...family.standardIds, ...family.variantIds].some(id => {
        const video = videosById.get(id);
        const named = namedClip(video, id, family.standardIds.includes(id) ? 'standard' : 'variant', clipLabels);
        return video && `${named.text} ${video.label} ${video.fileName} ${video.id}`.toLocaleLowerCase('sv').includes(needle);
      })));
  const selectedVideo = videosById.get(previewId);
  const preview = selectedVideo?.available ? selectedVideo : undefined;
  const previewNamed = preview ? namedClip(preview, preview.id, preview.role ?? 'standard', clipLabels) : undefined;
  const previewName = previewNamed?.text;
  return <section aria-label="Videomappar"><div className={styles.libraryHeader}><div><h2>{familyType === 'deal' ? 'Kort & deal' : familyType === 'speak' ? 'Fasta repliker / ljud' : 'Dina videomappar'}</h2><p className={styles.count}>{families.length} situationer · välj klipp eller inställningar</p></div><button className="text-button" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Läser…' : 'Läs in nya filer'}</button></div>
    <details className={styles.situation}><summary>Lägg till eller stäng av klipp</summary>
      <p>Välj <strong>Ladda upp klipp</strong> för att lägga till en MP4 eller WebM i rätt familj. Öppna sedan Inställningar för att aktivera varianten. Idleklipp läggs till i Idle-policyn.</p>
      <p>I Deal anger du frekvens per variant i procent. Resten använder standardklippet. Sätt <strong>0 %</strong> för att stänga av varianten. I Idle väljer du <strong>Manuell</strong>; i Repliker stänger du av alla variantval. Spara inställningarna. Klippet finns kvar för förhandsvisning.</p>
      <p>Gränssnittet kan inte radera råfiler eller flytta dem mellan familjer. Mappen avgör vilken plats eller replik filmen hör till.</p>
    </details>
    <label className={styles.search}>Hitta klipp eller mapp<input type="search" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Sök namn, replik eller plats…" /></label>
    {preview ? <div className={styles.situation}><strong>{previewName}</strong><video key={preview.id} src={preview.previewUrl} controls autoPlay muted playsInline style={{ width: '100%', maxHeight: 420 }} aria-label={`Förhandsvisa ${previewName}`} /><button className="text-button" onClick={() => setPreviewId('')}>Stäng klippet</button></div> : null}
    <div className={styles.libraryGrid}>{families.map(family => {
      const standardId = family.standardIds.find(id => videosById.get(id)?.available);
      return <article key={family.id} className={styles.situation}>
        <header className={styles.cardHeader}><h3>{familyLabel(family)}</h3><small>{family.standardIds.length} standard · {family.variantIds.length} varianter</small></header>
        <div className={styles.cardActions}><button type="button" disabled={!standardId} aria-label={`Spela standard · ${familyLabel(family)}`} onClick={() => standardId && setPreviewId(standardId)}>Spela standard</button><button type="button" aria-label={`Inställningar · ${familyLabel(family)}`} onClick={() => onOpen(family.eventId, family.situation)}>Inställningar</button></div>
        <details className={styles.files}><summary>Filer · {family.standardIds.length + family.variantIds.length}</summary><code>{mediaFamilyFolder(family)}/</code>
          {[...family.standardIds, ...family.variantIds].map(id => { const video = videosById.get(id); const named = namedClip(video, id, family.standardIds.includes(id) ? 'standard' : 'variant', clipLabels); return <button key={id} type="button" className="text-button" title={id} disabled={!video?.available} onClick={() => setPreviewId(id)}>{named.text} · {family.standardIds.includes(id) ? 'standard' : video?.source === 'upload' ? 'uppladdad variant' : 'variant/'}{video?.available ? ' · Spela' : ' · saknas'}</button>; })}
        </details>
      </article>;
    })}</div>
    {!families.length ? <p>Inga mappar matchar sökningen.</p> : null}
  </section>;
}
