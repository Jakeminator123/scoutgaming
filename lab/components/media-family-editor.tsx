'use client';

import type { MediaVariantPolicy, StudioEvent, StudioProject, StudioVariant } from '../lib/studio-model.mjs';
import type { MediaFamily, VideoInventory } from './studio-types';
import { mediaFamilyFolder, mediaSituationForEvent, mediaSituationLabel, mediaVariantPolicy } from '../lib/media-family-policy.mjs';
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
  return <aside className={`inspector ${styles.inspector}`} aria-label="Videor från mappen">
    <div className="inspector-heading"><span className="eyebrow">MATERIAL FÖR SITUATIONEN</span><h2>Standard och varianter</h2><p>{family ? `${standard.length} standard · ${alternatives.length} varianter` : 'Ingen videofamilj för den här signalen.'}</p></div>
    <div className="inspector-content">
      {folder ? <div className={styles.folder}><strong>Mapp</strong><code>emil/dealklipp-v1/{folder}/</code><small>Standardfilen ligger här. Alternativa klipp ligger i <code>variant/</code>.</small></div> : <p className="helper">Ingen videomapp är kopplad till den här signalen.</p>}
      <div className="variant-list">{variants.map((variant, index) => <button type="button" key={variant.id} className={`variant-option ${selectedId === variant.id ? 'active' : ''}`} aria-pressed={selectedId === variant.id} onClick={() => onSelect(variant.id)}><span className="variant-number">{index === 0 ? '◇' : String(index).padStart(2, '0')}</span><span><strong>{variant.label}</strong><small>{index === 0 ? 'Standard · väljs när inget alternativ används' : 'Fil från variant/ · samma situation'}</small></span></button>)}</div>
      {family && !alternatives.length ? <p className={styles.empty}>0 varianter — standardfilen används.</p> : null}
      {alternatives.filter(video => !video?.available).map(video => <p className="helper" key={video!.id}>{video!.fileName} · saknas, kan inte väljas.</p>)}
      {policy && family ? <div className={styles.policy}><h3>När får varianten väljas?</h3><VariantSelectionEditor variant={selected} onChange={selection => onPolicy(family.id, { ...policy, selection })} />
        <details><summary>Villkor och prioritet</summary><label className="field">Prioritet<input type="number" min={-100} max={100} value={policy.priority} onChange={e => onPolicy(family.id, { ...policy, priority: Math.max(-100, Math.min(100, Number(e.target.value))) })} /></label>
          {project.triggers.map(trigger => <label className="check-field" key={trigger.id}><input type="checkbox" checked={policy.triggerIds.includes(trigger.id)} onChange={e => onPolicy(family.id, { ...policy, triggerIds: e.target.checked ? [...policy.triggerIds, trigger.id] : policy.triggerIds.filter(id => id !== trigger.id) })} /><span>{trigger.label}</span></label>)}
        </details><p className="helper">Nya filer är manuella tills du tillåter regler, slump eller OpenClaw. Spara projekt för att behålla valet.</p>
      </div> : null}
      <details className={styles.instructions}><summary>Lägg till eller byt klipp</summary><p>Lägg högst fyra alternativa MP4-filer i familjens <code>variant/</code>. Uppdatera sedan manifestet från mapparna:</p><code>node pipeline/build-lab-video-manifest.mjs</code><p>Bytta bytes får ett nytt video-ID och är manuella tills du väljer deras policy. Filerna förhandsvisas i labbet; detta är inget läppsynkgodkännande.</p></details>
      <button type="button" className="text-button" disabled={refreshing} onClick={onRefresh}>{refreshing ? 'Läser…' : 'Läs om videomapparna'}</button>
    </div>
  </aside>;
}
