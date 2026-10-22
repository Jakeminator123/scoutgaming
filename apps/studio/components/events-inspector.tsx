'use client';

import { MediaFamilyEditor } from './media-family-editor';
import { TriggerEditor, categoryLabels, defaultValue } from './trigger-editor';
import { VariantSelectionEditor } from './variant-selection';
import { VariantVideoBinding } from './video-library';
import { studioHref } from './studio-types';
import type { MediaFamily, VideoInventory } from '../../../packages/presentation/contracts/media-inventory.mjs';
import { clipLabel } from '../lib/clip-label.mjs';
import { upsertMediaVariantPolicy } from '../../../packages/presentation/runtime/media-family-policy.mjs';
import { DEALER_IDS, addVariant, allowedPathDescriptors, isAssetCompatible, maxVariantsForEvent, removeTrigger, removeVariant } from '../../../packages/presentation/contracts/studio-model.mjs';
import type { DealerId, MediaVariantPolicy, StudioAsset, StudioEvent, StudioLine, StudioProject, StudioTrigger, StudioVariant, TriggerCategory } from '../../../packages/presentation/contracts/studio-model.mjs';

export const EVENTS_EDITOR_TABS = ['event', 'triggers', 'variants'] as const;
export type EventsEditorTab = typeof EVENTS_EDITOR_TABS[number];

export function eventsEditorTab(value?: string): EventsEditorTab {
  return value === 'event' || value === 'triggers' || value === 'variants' ? value : 'variants';
}

function InspectorFooter({ dirty }: { dirty: boolean }) {
  return <div className="inspector-footer">
    <i className={dirty ? 'unsaved-dot' : 'saved-dot'} />
    {dirty ? 'Utkast · spara när du är nöjd' : 'Projekt sparat'}
    <span>Publicering till bolag görs separat.</span>
  </div>;
}

export function EventsInspector({
  managed, isIdleEditor, editorTab, onTab, project, videos, family, dealerId, dealerLabel, event, line, variant,
  refreshing, onRefresh, selectedAsset, selectedAnimationCompatible, result, eligibleIds,
  dirty, updateProject, modelEdit, setProject, setVariantId, setError, invalidateSimulation, selectVariant,
}: {
  managed: boolean;
  isIdleEditor: boolean;
  editorTab: EventsEditorTab;
  onTab: (tab: EventsEditorTab) => void;
  project: StudioProject;
  videos: VideoInventory;
  family: MediaFamily | null;
  dealerId: DealerId;
  dealerLabel: string;
  event: StudioEvent;
  line: StudioLine;
  variant: StudioVariant;
  refreshing: boolean;
  onRefresh: () => void;
  selectedAsset?: StudioAsset;
  selectedAnimationCompatible: boolean;
  result: { eligible?: (string | { id?: string; variantId?: string })[] } | null;
  eligibleIds: Set<string>;
  dirty: boolean;
  updateProject: (edit: (draft: StudioProject) => void) => void;
  modelEdit: (edit: (value: StudioProject) => StudioProject) => void;
  setProject: (value: StudioProject) => void;
  setVariantId: (id: string) => void;
  setError: (value: string) => void;
  invalidateSimulation: (stopSocial?: boolean) => void;
  selectVariant: (id: string) => void;
}) {
  const isBaseline = variant.id === line.baselineVariantId;
  function updateVariant(patch: Partial<StudioVariant>) {
    updateProject(draft => {
      const target = draft.lines.find(item => item.dealerId === dealerId && item.eventId === event.id)!.variants.find(item => item.id === variant.id)!;
      Object.assign(target, patch);
    });
  }
  function updateTrigger(id: string, patch: Partial<StudioTrigger>) {
    updateProject(draft => { Object.assign(draft.triggers.find(item => item.id === id)!, patch); });
  }
  function createTrigger(category: TriggerCategory) {
    const descriptor = allowedPathDescriptors.find(item => item.category === category)!;
    const id = `trigger.${crypto.randomUUID()}`;
    updateProject(draft => {
      draft.triggers.push({
        id,
        label: `Ny ${category === 'deterministic' ? 'spelregel' : category === 'social' ? 'social trigger' : 'framtoning'}`,
        category,
        path: descriptor.path,
        op: descriptor.operators[0],
        value: defaultValue(descriptor),
      });
    });
    return id;
  }
  function deleteTrigger(id: string) {
    const count = project.lines.reduce((total, item) => total + item.variants.filter(item => item.triggerIds.includes(id)).length, 0);
    if (count > 0) {
      setError(`Triggern används av ${count} varianter. Koppla loss den uttryckligen under Varianter innan du tar bort den.`);
      return;
    }
    if (window.confirm('Ta bort denna oanvända trigger? Ändringen sparas först när du väljer Spara projekt.')) modelEdit(value => removeTrigger(value, id));
  }
  function updateMediaPolicy(familyId: string, policy: MediaVariantPolicy) {
    updateProject(draft => { draft.mediaPolicy = upsertMediaVariantPolicy(draft.mediaPolicy, familyId, policy); });
  }
  function addAlternative() {
    try {
      const next = addVariant(project, dealerId, event.id, `Alternativ ${line.variants.length}`);
      setProject(next);
      setVariantId(next.lines.find(item => item.dealerId === dealerId && item.eventId === event.id)!.variants.at(-1)!.id);
      invalidateSimulation();
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Varianten kunde inte skapas.');
    }
  }
  function inspectVideos() {
    window.location.assign(studioHref('/admin/videos', { dealerId, eventId: event.id, variantId: variant.id }));
  }
  const triggerEditor = <TriggerEditor triggers={project.triggers} descriptors={allowedPathDescriptors} onChange={updateTrigger} onAdd={createTrigger} onRemove={deleteTrigger} />;

  if (managed) {
    return <div>
      <div className="inspector-tabs" role="tablist" aria-label="Redigera event">
        <button type="button" role="tab" aria-selected={editorTab !== 'triggers'} onClick={() => onTab('variants')}>{isIdleEditor ? 'Grundloop' : 'Standard och varianter'}</button>
        <button type="button" role="tab" aria-selected={editorTab === 'triggers'} onClick={() => onTab('triggers')}>Villkor</button>
      </div>
      {editorTab === 'triggers' ? <aside className="inspector">
        <div className="inspector-heading">
          <span className="eyebrow">VILLKORSBIBLIOTEK</span>
          <h2>Villkor</h2>
          <p>Biblioteket gäller hela projektet, inte bara {dealerLabel}.</p>
        </div>
        <div className="inspector-content">{triggerEditor}</div>
        <InspectorFooter dirty={dirty} />
      </aside> : isIdleEditor ? null : <MediaFamilyEditor inventory={videos} family={family} project={project} variants={line.variants} selectedId={variant.id} onSelect={selectVariant} onPolicy={updateMediaPolicy} onRefresh={onRefresh} refreshing={refreshing} />}
    </div>;
  }

  return <aside className="inspector">
    <div className="inspector-heading">
      <span className="eyebrow">BYGG PRESENTATIONEN</span>
      <h2>Redigera vald nod</h2>
      <p>Valt event: {event.label} · {dealerLabel}.</p>
    </div>
    <div className="inspector-tabs" role="tablist" aria-label="Redigera event">
      <button type="button" role="tab" aria-selected={editorTab === 'event'} onClick={() => onTab('event')}>Event</button>
      <button type="button" role="tab" aria-selected={editorTab === 'variants'} onClick={() => onTab('variants')}>Varianter <span>{line.variants.length}</span></button>
      <button type="button" role="tab" aria-selected={editorTab === 'triggers'} onClick={() => onTab('triggers')}>Villkor</button>
    </div>
    <div className="inspector-content">
      {editorTab === 'event' ? <div>
        <label className="field">Eventets visningsnamn
          <input value={event.label} maxLength={120} onChange={change => { const value = change.target.value; updateProject(draft => { draft.events.find(item => item.id === event.id)!.label = value; }); }} />
        </label>
        <p className="helper">Samma labbnamn för alla fyra croupierer. Motorns typer och ID:n ligger fast.</p>
        {event.id === 'speak.other' ? <p className="notice subtle">Den här labbnoden samlar flera exakta replik-ID:n. En generisk videokoppling här är bara ett labbexempel — den kan inte användas som gemensam talvideo för alla repliker i spelet.</p> : null}
        <label className="field">Beskrivning
          <textarea rows={4} value={event.description} maxLength={600} onChange={change => { const value = change.target.value; updateProject(draft => { draft.events.find(item => item.id === event.id)!.description = value; }); }} />
        </label>
        <label className="field">Linjens namn
          <input value={line.label} maxLength={120} onChange={change => { const value = change.target.value; updateProject(draft => { draft.lines.find(item => item.dealerId === dealerId && item.eventId === event.id)!.label = value; }); }} />
        </label>
        <p className="helper">Variantuppsättningen samlar en skyddad standardvariant och möjliga alternativ för {dealerLabel}.</p>
        <div className="protected-contract">
          <span className="eyebrow">LÅST KÄLLKONTRAKT</span>
          <code>{event.id}</code>
          <p>Tekniskt event-ID och motorns fält ändras inte när du byter namn.</p>
          <details className="technical-details"><summary>Se källeventets exempel</summary><pre>{JSON.stringify(event.exampleEvent, null, 2)}</pre></details>
        </div>
      </div> : editorTab === 'triggers' ? triggerEditor : <div>
        {dealerId !== 'astrid' ? <p className="helper">{DEALER_IDS.includes(dealerId) ? `Varianter för ${dealerLabel} sparas i projektet men används inte av spelet ännu.` : `Varianter för ${dealerLabel} sparas i utkastet. Spara och publicera paketet igen för att använda dem i spelet.`}</p> : null}
        <div className="variant-list">
          {line.variants.map((item, index) => {
            const bound = item.videoGenerationId ? videos.videos.find(row => row.id === item.videoGenerationId) : undefined;
            const boundName = bound ? clipLabel({ id: bound.id, familyId: bound.familyId, role: bound.role, relativePath: bound.relativePath }, project.clipLabels) : '';
            const boundText = boundName && boundName !== item.label ? ` · ${boundName}${bound?.fileName && bound.fileName !== boundName ? ` · ${bound.fileName}` : ''}` : '';
            return <button type="button" key={item.id} className={`variant-option ${variant.id === item.id ? 'active' : ''}`} title={item.videoGenerationId ?? item.id} onClick={() => selectVariant(item.id)}>
            <span className="variant-number">{String(index).padStart(2, '0')}</span>
            <span>
              <strong>{item.label}</strong>
              <small>{item.id === line.baselineVariantId ? 'Standard · alltid tillåten' : result ? eligibleIds.has(item.id) ? 'Tillåten i senaste testet' : 'Ej valbar i detta läge' : `${item.triggerIds.length} triggers · prioritet ${item.priority}`}{boundText}</small>
            </span>
            {item.id === line.baselineVariantId ? <span className="baseline-mark" title="Skyddad standardvariant">◇</span> : null}
          </button>;
          })}
        </div>
        <button type="button" className="text-button add-variant" disabled={line.variants.length >= maxVariantsForEvent(line.eventId)} onClick={addAlternative}>
          ＋ Lägg till variant <span>{line.variants.length - 1}/{maxVariantsForEvent(line.eventId) - 1}</span>
        </button>
        <div className="variant-form">
          <span className="eyebrow">{isBaseline ? 'REDIGERA STANDARDVARIANT' : 'REDIGERA ALTERNATIV'}</span>
          <label className="field">Variantens namn
            <input value={variant.label} maxLength={120} onChange={change => updateVariant({ label: change.target.value })} />
          </label>
          <VariantVideoBinding
            key={variant.id}
            inventory={videos}
            dealerId={dealerId}
            eventId={event.id}
            variant={variant}
            isBaseline={isBaseline}
            onBind={id => updateVariant({ videoGenerationId: id })}
            onInspect={inspectVideos}
            clipLabels={project.clipLabels}
          />
          {!isBaseline ? <VariantSelectionEditor variant={variant} onChange={selection => updateVariant({ selection })} /> : null}
          <details className="reserve-editor">
            <summary>2D-reserv</summary>
            <label className="field">2D-rörelse när video saknas
              <select value={variant.assetId} aria-invalid={!selectedAnimationCompatible} onChange={change => updateVariant({ assetId: change.target.value })}>
                {!selectedAnimationCompatible ? <option value={variant.assetId} disabled>{selectedAsset?.label ?? variant.assetId} · behöver bytas (matchar inte eventet)</option> : null}
                {project.assets.filter(asset => isAssetCompatible(event, asset)).map(asset => <option value={asset.id} key={asset.id}>{asset.label} · {asset.animation}</option>)}
              </select>
            </label>
          </details>
          {!isBaseline ? <label className="field">Prioritet <span className="optional">Högre väljs först i regelläget</span>
            <input type="number" value={variant.priority} min={-100} max={100} onChange={change => updateVariant({ priority: Number(change.target.value) })} />
          </label> : null}
          {isBaseline ? <div className="notice subtle"><strong>Din standardvariant.</strong><p>Den har inga villkor och kan inte tas bort. Om ett modellval fallerar finns den alltid kvar.</p></div> : <fieldset className="trigger-assignment">
            <legend>Vilka triggers måste matcha?</legend>
            <p className="helper">Alla valda villkor måste vara sanna. Inga valda = inga extra villkor. Urvalstillåtelsen gäller fortfarande.</p>
            {project.triggers.map(trigger => <label className="check-field" key={trigger.id}>
              <input type="checkbox" checked={variant.triggerIds.includes(trigger.id)} onChange={change => updateVariant({ triggerIds: change.target.checked ? [...variant.triggerIds, trigger.id] : variant.triggerIds.filter(id => id !== trigger.id) })} />
              <span>{trigger.label}<small>{categoryLabels[trigger.category]}</small></span>
            </label>)}
            <button type="button" className="text-button" onClick={() => onTab('triggers')}>Hantera triggerbiblioteket →</button>
          </fieldset>}
          <code className="technical-id">{variant.id}</code>
          {!isBaseline ? <button type="button" className="danger-button" onClick={() => { modelEdit(value => removeVariant(value, dealerId, event.id, variant.id)); setVariantId(line.baselineVariantId); }}>Ta bort alternativ</button> : null}
        </div>
      </div>}
    </div>
    <InspectorFooter dirty={dirty} />
  </aside>;
}
