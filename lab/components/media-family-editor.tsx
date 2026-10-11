'use client';

import type { MediaVariantPolicy, StudioEvent, StudioProject, StudioVariant } from '../lib/studio-model.mjs';
import type { MediaFamily, VideoInventory } from './studio-types';
import { clipLabel } from '../lib/clip-label.mjs';
import { isAstridDealFamily, mediaFamilyFolder, mediaSituationForEvent, mediaSituationLabel, mediaVariantPolicy } from '../lib/media-family-policy.mjs';
import { DealFrequencyEditor } from './deal-frequency-editor';
import { situationsForEvent } from '../lib/video-intake.mjs';
import { VariantSelectionEditor } from './variant-selection';
import { eventSummary } from '../lib/activity-log.mjs';
import styles from './media-family-editor.module.css';

export function MediaSituation({ event, observed, onSelect }: { event: StudioEvent; observed: boolean; onSelect: (situation: string) => void }) {
  const situations = situationsForEvent(event);
  const current = mediaSituationForEvent(event.id, event.exampleEvent) ?? '';
  return <section className={styles.situation} aria-label="Exakt situation">
    <span className="eyebrow">{observed ? 'MOTTAGET NATIVE-EVENT' : 'LOKALT EVENTPROV'}</span>
    {situations.length > 1 ? <label className="field">{event.sourceType === 'speak' ? 'Exakt replik' : 'Kortets destination'}<select aria-label="Exakt situation" value={current} disabled={observed} onChange={e => onSelect(e.target.value)}>
      {!situations.includes(current) ? <option value={current}>{current || 'Ingen exakt situation'}</option> : null}
      {situations.map(situation => <option key={situation} value={situation}>{mediaSituationLabel(situation)}</option>)}
    </select></label> : <strong>{current ? mediaSituationLabel(current) : event.label}</strong>}
    <p>{eventSummary(event.exampleEvent)}</p>
    {event.sourceType === 'deal' ? <small>Destinationen väljer rörelsen. Kortets värde och handindex följer med som eventdata.</small> : null}
    {['turn', 'settle', 'reveal'].includes(event.sourceType) ? <small>Den här signalen uppdaterar spelbilden. Eventuellt tal kommer som ett separat replik-event.</small> : null}
    <details><summary>Visa {observed ? 'mottagna' : 'exemplets'} fält</summary><pre>{JSON.stringify(event.exampleEvent, null, 2)}</pre></details>
  </section>;
}

export function MediaFamilyEditor({ inventory, family, project, variants, selectedId, onSelect, onPolicy, onRefresh, refreshing }: {
  inventory: VideoInventory; family: MediaFamily | null; project: StudioProject; variants: StudioVariant[]; selectedId: string;
  onSelect: (id: string) => void; onPolicy: (familyId: string, policy: MediaVariantPolicy) => void; onRefresh: () => void; refreshing: boolean;
}) {
  const folder = mediaFamilyFolder(family);
  const selected = variants.find(variant => variant.id === selectedId) ?? variants[0];
  const policy = family && selected?.videoGenerationId && selected !== variants[0] ? mediaVariantPolicy(project, family, selected.videoGenerationId) : null;
  const standard = family?.standardIds.map(id => inventory.videos.find(video => video.id === id)).filter(Boolean) ?? [];
  const alternatives = family?.variantIds.map(id => inventory.videos.find(video => video.id === id)).filter(Boolean) ?? [];
  const deal = isAstridDealFamily(family);
  const clipName = (id: string | null | undefined, fallback: string) => {
    if (!id) return fallback;
    const video = inventory.videos.find(item => item.id === id);
    const role = video?.role ?? (family?.standardIds.includes(id) ? 'standard' : family?.variantIds.includes(id) ? 'variant' : undefined);
    const name = clipLabel({ id, familyId: video?.familyId ?? family?.id, role, relativePath: video?.relativePath }, project.clipLabels);
    return name;
  };
  const policyRows = project.mediaPolicy?.find(row => row.familyId === family?.id)?.variants ?? [];
  const policyFull = Boolean(policy && policyRows.length >= 4 && !policyRows.some(row => row.videoId === policy.videoId));
  return <aside className={`inspector ${styles.inspector}`} aria-label="Videor från mappen">
    <div className="inspector-heading"><h2>Klipp</h2></div>
    <div className="inspector-content">
      {folder ? <details className={styles.folder}><summary>Avancerat · filer och identitet</summary><code>{family?.id}</code><code>media/dealers/astrid/runtime/presentation/{folder}/</code><small>Alternativa klipp ligger i <code>variant/</code>.</small></details> : <p className="helper">Ingen videomapp är kopplad till den här signalen.</p>}
      <div className="variant-list">{variants.map((variant, index) => <button type="button" key={variant.id} className={`variant-option ${selectedId === variant.id ? 'active' : ''}`} aria-pressed={selectedId === variant.id} title={variant.videoGenerationId ?? variant.id} onClick={() => onSelect(variant.id)}><span className="variant-number">{index === 0 ? '◇' : String(index).padStart(2, '0')}</span><span><strong>{clipName(variant.videoGenerationId, variant.label)}</strong><small>{index === 0 ? 'Standard' : 'Alternativ'}</small></span></button>)}</div>
      {family && !alternatives.length ? <p className={styles.empty}>0 varianter — standardfilen används.</p> : null}
      {alternatives.filter(video => !video?.available).map(video => <p className="helper" key={video!.id} title={video!.id}>{clipName(video!.id, video!.fileName)} · saknas, kan inte väljas.</p>)}
      {deal && family ? <DealFrequencyEditor family={family} inventory={inventory} project={project} onPolicy={onPolicy} /> : policy && family ? <div className={styles.policy}><h3>Urval</h3>{policyFull ? <p role="status">Fyra varianter har redan inställningar. Välj en annan variant och gör den enbart manuell för att frigöra plats.</p> : <><VariantSelectionEditor variant={selected} onChange={selection => onPolicy(family.id, { ...policy, selection })} /><button type="button" className="text-button" onClick={() => onPolicy(family.id, { ...policy, selection: { rules: false, model: false, random: false } })}>Gör enbart manuell</button></>}
        <fieldset disabled={policyFull} style={{ border: 0, padding: 0 }}><details><summary>Villkor och prioritet</summary><label className="field">Prioritet<input type="number" min={-100} max={100} value={policy.priority} onChange={e => onPolicy(family.id, { ...policy, priority: Math.max(-100, Math.min(100, Number(e.target.value))) })} /></label>
          {project.triggers.map(trigger => <label className="check-field" key={trigger.id}><input type="checkbox" checked={policy.triggerIds.includes(trigger.id)} onChange={e => onPolicy(family.id, { ...policy, triggerIds: e.target.checked ? [...policy.triggerIds, trigger.id] : policy.triggerIds.filter(id => id !== trigger.id) })} /><span>{trigger.label}</span></label>)}
        </details></fieldset>
      </div> : null}
      <details className={styles.instructions}><summary>Avancerat · filhantering</summary><p>Ladda upp flera filmer till samma fack i <strong>Dealers &amp; klipp</strong>. Välj sedan <strong>Uppdatera klipp</strong> här. {deal ? 'Högst fyra klipp kan vara aktiva samtidigt. Ange frekvens för nya klipp och spara. 0 % betyder endast manuellt prov.' : 'Nya klipp är manuella tills du tillåter andra variantval och sparar.'}</p><p>{deal ? 'Sätt variantens frekvens till 0 % för att stänga av den.' : 'Stäng av alla variantval för det valda klippet för att behålla det enbart som manuellt prov.'} Oanvända uppladdningar kan tas bort och återställas i dealerbiblioteket.</p></details>
      <button type="button" className="text-button" disabled={refreshing} onClick={onRefresh}>{refreshing ? 'Läser…' : 'Uppdatera klipp'}</button>
    </div>
  </aside>;
}
