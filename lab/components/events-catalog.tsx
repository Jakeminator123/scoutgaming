'use client';

import type { DealerId, StudioProject } from '../lib/studio-model.mjs';
import { OUTPUT_GROUPS, presentationProfile } from '../lib/presentation-profile.mjs';
import { FamilyNavigation } from './family-video-library';
import type { VideoInventory } from './studio-types';
import styles from './control-events-page.module.css';

export function EventsCatalog({ project, videos, dealerId, eventId, familyId, managed, filter, onFilter, onSelectDealer, onSelectEvent }: {
  project: StudioProject;
  videos: VideoInventory;
  dealerId: DealerId;
  eventId: string;
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
    {managed ? <FamilyNavigation inventory={videos} project={project} dealerId={dealerId} selectedFamilyId={familyId} eventId={eventId} filter={filter} onOpen={(id, situation) => onSelectEvent(id, situation)} /> : <div className="event-tree">
      <div className="tree-title"><span>EVENTTRÄD</span><span>{project.events.length}</span></div>
      {OUTPUT_GROUPS.map(group => {
        const items = visibleEvents.filter(item => presentationProfile(item.sourceType)?.id === group.id);
        if (!items.length) return null;
        return <div className="event-group" key={group.id}>
          <div className="event-group-title"><span>{group.symbol}</span>{group.label}<code>{items.length}</code></div>
          {items.map(item => <button type="button" className={`event-node ${eventId === item.id ? 'active' : ''}`} key={item.id} aria-pressed={eventId === item.id} onClick={() => onSelectEvent(item.id)}>
            <i />
            <span className="event-node-label">{item.label}<small title="Källtyp · Labbets nod-ID">({item.sourceType} · {item.id})</small></span>
            {eventId === item.id ? <span className="node-arrow">↗</span> : null}
          </button>)}
        </div>;
      })}
      {!visibleEvents.length ? <p className="helper">Inga event matchar sökningen.</p> : null}
    </div>}
    <p className="helper">
      <strong>{managed ? 'En mapp per situation.' : 'Äldre grupper för test och variantval.'}</strong>
      {' '}
      <span>{managed ? 'Kortdata finns kvar i eventet. Mapparna väljer rörelsen.' : 'Vänster, mitten och höger är samlingsgrupper. Exakt plats eller replik väljs i arbetsytan.'}</span>
    </p>
  </section>;
}
