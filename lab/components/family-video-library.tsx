'use client';
import { useState } from 'react';
import type { VideoInventory } from './studio-types';
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

export function FamilyOverview({ inventory, project, dealerId, onOpen }: { inventory: VideoInventory; project: StudioProject; dealerId: string; onOpen: (eventId: string, situation: string) => void }) {
  const groups = [['deal', 'Kort till rätt plats'], ['speak', 'Exakta repliker'], ['idle', 'Vänteläge']] as const;
  return <section aria-label="Händelser och videomappar"><div className="event-heading"><div><span className="eyebrow">ÖVERSIKT</span><h1>Händelse → videomapp</h1><p>Välj en destination eller replik för att spela dess standardklipp och se varianterna som faktiskt finns.</p></div></div>
    {groups.map(([type, title]) => <section key={type} className={styles.situation}><h2>{title}</h2><div className={styles.overviewGrid}>{(inventory.families ?? []).filter(family => family.dealerId === dealerId && matchesGroup(family.eventId, type)).map(family => <button type="button" className={styles.familyButton} key={family.id} onClick={() => onOpen(family.eventId, family.situation)}><strong>{familyLabel(family)}</strong><code>{mediaFamilyFolder(family)}/</code><small>{family.standardIds.length} standard · {family.variantIds.length} varianter</small></button>)}</div></section>)}
    <details className={styles.situation}><summary>Övriga spelsignaler</summary><p>Tur och resultat har egna eventdata. Talet kommer separat som en exakt replik.</p>{project.events.filter(event => ['turn', 'settle', 'reveal'].includes(event.sourceType) && !familiesFor(inventory, dealerId).some(family => family.eventId === event.id)).map(event => <button className="text-button" key={event.id} onClick={() => onOpen(event.id, '')}>{event.label}</button>)}</details>
  </section>;
}

export function FamilyVideoLibrary({ inventory, dealerId, onOpen, onRefresh, refreshing, familyType }: {
  inventory: VideoInventory; dealerId: string; onOpen: (eventId: string, situation: string) => void; onRefresh: () => void; refreshing: boolean; familyType?: 'deal' | 'speak';
}) {
  const [filter, setFilter] = useState('');
  const [previewId, setPreviewId] = useState('');
  const families = (inventory.families ?? []).filter(family => family.dealerId === dealerId
    && (!familyType || matchesGroup(family.eventId, familyType))
    && `${mediaFamilyFolder(family)} ${family.situation}`.toLowerCase().includes(filter.trim().toLowerCase()));
  const preview = inventory.videos.find(video => video.id === previewId && video.available);
  return <section aria-label="Videomappar"><div className="event-heading"><div><span className="eyebrow">VIDEOBANKEN</span><h1>{familyType === 'deal' ? 'Utdelning till sju platser och croupiern' : familyType === 'speak' ? 'Repliker och varianter' : 'Dina videomappar'}</h1><p>Samma standardfiler och varianter som används i Eventstudion och native-följningen.</p></div><button className="text-button" onClick={onRefresh} disabled={refreshing}>Läs in nya filer</button></div>
    <details className={styles.situation}><summary>Lägg till eller stäng av klipp</summary>
      <p>Välj <strong>Ladda upp &amp; bibliotek</strong> för att skicka en MP4 direkt till rätt familj. Lokala mappfiler kan också läsas in från <code>variant/</code>. Öppna sedan familjen och välj hur den nya varianten får användas. En ny idlefilm behöver också läggas till i Idle-policyn.</p>
      <p>I Deal anger du frekvens per variant i procent. Resten använder standardklippet. Sätt <strong>0 %</strong> för att stänga av varianten. I Idle väljer du <strong>Manuell</strong>; i Repliker stänger du av alla variantval. Spara inställningarna. Klippet finns kvar för förhandsvisning.</p>
      <p>Gränssnittet kan inte radera råfiler eller flytta dem mellan familjer. Mappen avgör vilken plats eller replik filmen hör till.</p>
    </details>
    <label className="field">Hitta klipp eller mapp<input value={filter} onChange={event => setFilter(event.target.value)} placeholder="deal_pos3, goodluck, idle…" /></label>
    {preview ? <div className={styles.situation}><strong>{preview.fileName}</strong><video key={preview.id} src={preview.previewUrl} controls autoPlay muted playsInline style={{ width: '100%', maxHeight: 420 }} aria-label={`Förhandsvisa ${preview.fileName}`} /><button className="text-button" onClick={() => setPreviewId('')}>Stäng klippet</button></div> : null}
    <div className={familyType ? styles.libraryGrid : undefined}>{families.map(family => <article key={family.id} className={styles.situation}><strong>{familyLabel(family)}</strong><code>emil/dealklipp-v1/{mediaFamilyFolder(family)}/</code>
      {[...family.standardIds, ...family.variantIds].map(id => { const video = inventory.videos.find(row => row.id === id); return <button key={id} type="button" className="text-button" disabled={!video?.available} onClick={() => setPreviewId(id)}>{video?.fileName ?? id} · {family.standardIds.includes(id) ? 'standard' : 'variant/'}{video?.available ? ' · Spela' : ' · saknas'}</button>; })}
      <small>{family.variantIds.length ? `${family.variantIds.length} varianter i variant/` : '0 varianter — standard används'}</small><button className="primary-button" onClick={() => onOpen(family.eventId, family.situation)}>{family.eventId.startsWith('deal.') ? 'Ställ in frekvenser →' : 'Öppna klipp och inställningar →'}</button>
    </article>)}</div>
    {!families.length ? <p>Inga mappar matchar sökningen.</p> : null}
  </section>;
}
