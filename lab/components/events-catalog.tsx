'use client';

import { situationsForEvent } from '../lib/video-intake.mjs';
import { clipSituationLabel } from '../lib/clip-label.mjs';
import type { DealerId, StudioProject } from '../lib/studio-model.mjs';
import { OUTPUT_GROUPS, presentationProfile } from '../lib/presentation-profile.mjs';
import { FamilyNavigation } from './family-video-library';
import type { VideoInventory } from './studio-types';
import styles from './control-events-page.module.css';

export function EventsCatalog({ project, videos, dealerId, eventId, situation, familyId, managed, filter, onFilter, onSelectDealer, onSelectEvent }: {
  project: StudioProject;
  videos: VideoInventory;
  dealerId: DealerId;
  eventId: string;
  situation?: string;
  familyId?: string;
  managed: boolean;
  filter: string;
  onFilter: (value: string) => void;
  onSelectDealer: (id: DealerId) => void;
  onSelectEvent: (id: string, situation?: string) => void;
}) {
  const visibleEvents = project.events.filter(item => `${item.label} ${item.id}`.toLocaleLowerCase('sv').includes(filter.toLocaleLowerCase('sv')));
  return <section className={styles.catalog} aria-label="Event i projektet">
    <div className="sg-chip-row" role="group" aria-label="Välj dealer">
      {project.dealers.map(item => <button type="button" className="sg-chip" aria-pressed={dealerId === item.id} key={item.id} onClick={() => onSelectDealer(item.id)}>{item.label.slice(0, 1)} {item.label}</button>)}
    </div>
    <label className="search-field">
      <span aria-hidden="true">⌕</span>
      <input type="search" placeholder="Hitta fack eller händelse…" aria-label="Sök event" value={filter} onChange={event => onFilter(event.target.value)} />
    </label>
    {managed ? <FamilyNavigation inventory={videos} project={project} dealerId={dealerId} selectedFamilyId={familyId} eventId={eventId} filter={filter} onOpen={(id, situation) => onSelectEvent(id, situation)} /> : <label className="field">Klippfack
      <select aria-label="Välj klippfack" value={eventId+'|'+(situation || situationsForEvent(project.events.find(row=>row.id===eventId)!).at(0) || '')} onChange={event=>{const [id,slot]=event.target.value.split('|');onSelectEvent(id,slot||undefined);}}>
        {OUTPUT_GROUPS.map(group=>{const events=visibleEvents.filter(item=>presentationProfile(item.sourceType)?.id===group.id);return events.length?<optgroup key={group.id} label={group.label}>{events.flatMap(item=>{const slots=situationsForEvent(item);return (slots.length?slots:['']).map(slot=><option key={item.id+'|'+slot} value={item.id+'|'+slot}>{clipSituationLabel(item.id,slot)}</option>);})}</optgroup>:null;})}
      </select>
      {!visibleEvents.length?<span>Inga klippfack matchar sökningen.</span>:null}
    </label>}

    <p className="helper">
      <strong>{'Ett klippfack per situation.'}</strong>
      {' '}
      <span>{'Välj exakt utdelningsplats eller replik. Spelets händelser och kortdata behåller sina befintliga kopplingar.'}</span>
    </p>
  </section>;
}
