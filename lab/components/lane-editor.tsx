'use client';

import { useRef, useState, type FormEvent } from 'react';
import {
  OPERATOR_ADJUSTABLE,
  defaultPresentationLane,
  validateProject,
  type StudioLane,
  type StudioProject,
} from '../lib/studio-model.mjs';
import styles from './lane-editor.module.css';
import { compositionLabel } from '../lib/control-flow.mjs';
import { activeStudioDealers } from './studio-types';

export const LANE_ID_HELP = 'Unikt id: små bokstäver, siffror och bindestreck.';
const adjustmentLabels:Record<string,string>={'table.color':'Bordsfärg',table:'Bord',background:'Bakgrund',dealer:'Dealer',branding:'Bolagets profil'};

type Edit = (edit: (current: StudioProject) => StudioProject) => void;

export function commitLanes(project: StudioProject, lanes: StudioLane[]) {
  const next = structuredClone(project);
  next.lanes = structuredClone(lanes);
  return validateProject(next);
}

export function addLane(project: StudioProject, id: string, label: string, dealerId: string) {
  const lane = defaultPresentationLane(dealerId);
  lane.id = id;
  lane.label = label;
  return commitLanes(project, [...(project.lanes ?? []), lane]);
}

export function newCompositionId(project: StudioProject, label: string, newKey: () => string = () => crypto.randomUUID()) {
  const normalized = label.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const stem = (/^[a-z]/.test(normalized) ? normalized : 'scen-' + normalized).slice(0, 26).replace(/-+$/g, '') || 'scen';
  for (let attempt = 0; attempt < 8; attempt++) {
    const key = newKey();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key)) break;
    const id = stem + '-' + key;
    if (!project.lanes?.some(lane => lane.id === id)) return id;
  }
  throw new Error('Ett unikt ID kunde inte skapas. Försök igen.');
}

export function addDefaultLane(project: StudioProject, dealerId: string) {
  return commitLanes(project, [...(project.lanes ?? []), defaultPresentationLane(dealerId)]);
}

export function removeLane(project: StudioProject, id: string) {
  return commitLanes(project, (project.lanes ?? []).filter(lane => lane.id !== id));
}

export function replaceLane(project: StudioProject, id: string, lane: StudioLane) {
  const lanes = structuredClone(project.lanes ?? []);
  const index = lanes.findIndex(item => item.id === id);
  if (index < 0) throw new Error(`lanes: lanen ${id} finns inte`);
  lanes[index] = structuredClone(lane);
  return commitLanes(project, lanes);
}

function layerText(lane: StudioLane) {
  const mark = (enabled: boolean) => enabled ? 'på' : 'av';
  return `Bakgrund ${mark(lane.layers.background.enabled)}, bord ${mark(lane.layers.table.enabled)}, dealer ${mark(lane.layers.dealer.enabled)}`;
}

function LaneSummary({ lane }: { lane: StudioLane }) {
  const items: [string, string][] = [
    ['Namn', compositionLabel(lane.label)],
    ['Dealers', lane.dealers.join(', ')],
    ['Lager', layerText(lane)],
  ];
  return <dl className={styles.summary}>
    {items.map(([term, value], index) => <div className={styles.summaryItem} key={term}>
      {index > 0 ? <span className={styles.dot} aria-hidden="true">·</span> : null}
      <dt>{term}</dt>
      <dd>{value}</dd>
    </div>)}
  </dl>;
}

function applyWhenValid(project: StudioProject, onEdit: Edit, change: (current: StudioProject) => StudioProject, after: () => void) {
  try { change(project); }
  catch (cause) { onEdit(() => { throw cause; }); return; }
  onEdit(change);
  after();
}

export function CompositionMetadata({ project, onEdit: onModelEdit, selectedId, onSelect, disabled = false }: {
  project: StudioProject; onEdit: Edit; selectedId: string; onSelect: (id: string) => void; disabled?: boolean;
}) {
  const onEdit: Edit = change => { if (!disabled) onModelEdit(change); };
  const dealers = activeStudioDealers(project);
  const lanes = project.lanes ?? [];
  const selected = lanes.find(lane => lane.id === selectedId) ?? lanes[0] ?? null;
  const [draftLabel, setDraftLabel] = useState('');
  const [draftDealer, setDraftDealer] = useState('');
  const creating = useRef(false);
  function addNew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = draftLabel.trim();
    if (disabled || creating.current || !label || !dealers.some(row => row.id === draftDealer)) return;
    creating.current = true;
    try {
      // Generate once outside the React updater so replays keep the same identity.
      const id = newCompositionId(project, label);
      addLane(project, id, label, draftDealer);
      onEdit(current => addLane(current, id, label, draftDealer));
      setDraftLabel(''); setDraftDealer(''); onSelect(id);
    } catch (cause) {
      creating.current = false;
      onEdit(() => { throw cause; });
    }
  }
  function rename(value: string) {
    if (!selected || disabled) return;
    onEdit(current => { const lane = current.lanes?.find(item => item.id === selected.id);
      return lane ? replaceLane(current, lane.id, { ...lane, label: value }) : current; });
  }
  return <fieldset className={styles.editor} disabled={disabled} aria-label="Välj och namnge sammansättning">
    <section className={styles.card}>
      {selected ? <div className={styles.create}>
        <label className={styles.field}>Sammansättning<select value={selected.id} onChange={event => { if (!disabled) onSelect(event.target.value); }}>{lanes.map(lane => <option key={lane.id} value={lane.id}>{compositionLabel(lane.label)}</option>)}</select></label>
        <label className={styles.field}>Sammansättningens namn<input value={compositionLabel(selected.label)} maxLength={80} onChange={event => rename(event.target.value)} /></label>
      </div> : <div className={styles.suggestion}>
        <p>Ingen sparad sammansättning. Välj ett namn och en dealer nedan.</p>
        {!dealers.length ? <p>Registrera först en dealer under Dealers &amp; klipp.</p> : null}
      </div>}
    </section>
    <details className={styles.card} open={!selected || undefined}><summary>Ny sammansättning</summary><form onSubmit={addNew} aria-labelledby="new-lane-title">
      <h2 id="new-lane-title">Skapa sammansättning</h2><div className={styles.create}>
        <label className={styles.field}>Namn på ny sammansättning<input value={draftLabel} required maxLength={80} onChange={event => { creating.current = false; setDraftLabel(event.target.value); }} /></label>
        <label className={styles.field}>Dealer för ny sammansättning<select value={draftDealer} required onChange={event => { creating.current = false; setDraftDealer(event.target.value); }}><option value="">Välj dealer</option>{dealers.map(dealer => <option key={dealer.id} value={dealer.id}>{dealer.label}</option>)}</select></label>
        <button type="submit" className="sg-btn sg-btn-secondary" disabled={!draftLabel.trim() || !draftDealer}>Skapa sammansättning</button>
      </div><p className={styles.help}>Ett tekniskt ID skapas automatiskt och behålls när namnet ändras.</p>
    </form></details>
  </fieldset>;
}

export function CompositionSettings({ project, lane, onEdit: onModelEdit, disabled = false }: {
  project: StudioProject; lane: StudioLane; onEdit: Edit; disabled?: boolean;
}) {
  const onEdit: Edit = change => { if (!disabled) onModelEdit(change); };
  const [draftColor, setDraftColor] = useState('#1b4332');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tableColors = lane.layers.table.colors ?? [];
  function editLane(change: (draft: StudioLane) => void) {
    if (disabled) return;
    const next = structuredClone(lane); change(next);
    try { replaceLane(project, lane.id, next); }
    catch (cause) { onEdit(() => { throw cause; }); return; }
    onEdit(current => replaceLane(current, lane.id, next));
  }
  return <fieldset className={styles.editor} disabled={disabled} aria-label="Avancerade sammansättningsinställningar">
      <details className={styles.advanced}><summary>Bordsfärger för bolaget</summary><div className={styles.addColor}>
        <label className={styles.field}>Bordsfärger
          <input type="color" value={draftColor} aria-label="Ny bordsfärg" onChange={event => setDraftColor(event.target.value)} />
        </label>
        <button type="button" className="sg-btn sg-btn-secondary" onClick={() => editLane(draft => {
          draft.layers.table.colors = [...(draft.layers.table.colors ?? []), draftColor];
        })}>Lägg till färg</button>
      </div>
      {tableColors.length > 0 ? <ul className={styles.swatches}>
        {tableColors.map(color => <li className={styles.swatch} key={color}>
          <span className={styles.chip} style={{ background: color }} />
          <span>{color}</span>
          <button type="button" className="sg-btn sg-btn-ghost" onClick={() => editLane(draft => {
            const colors = (draft.layers.table.colors ?? []).filter(item => item !== color);
            if (colors.length === 0) delete draft.layers.table.colors;
            else draft.layers.table.colors = colors;
          })}>Ta bort</button>
        </li>)}
      </ul> : null}</details>
    <details className={styles.advanced}><summary>Bolagets val och tekniska inställningar</summary><fieldset className={styles.group}>
      <legend>Bolaget får ändra</legend>
      <div className={styles.checks}>
        {OPERATOR_ADJUSTABLE.map(item => <label className={styles.check} key={item}>
          <input type="checkbox" checked={lane.operatorAdjustable.includes(item)} onChange={event => editLane(draft => {
            const selected = new Set(draft.operatorAdjustable);
            if (event.target.checked) selected.add(item);
            else selected.delete(item);
            draft.operatorAdjustable = OPERATOR_ADJUSTABLE.filter(entry => selected.has(entry));
          })} />
          {adjustmentLabels[item]??item}
        </label>)}
      </div>
    </fieldset>
    <p className={styles.idLine}>Sammansättningens tekniska ID <strong>{lane.id}</strong></p></details>
    <section className={styles.card} aria-label="Hantera sammansättning"><h3>Hantera sammansättning</h3><p>Ta bort {compositionLabel(lane.label)} ur projektet. Dealerklipp, bord och bakgrunder behålls. Publicerade spelrum behåller sin publicerade version. Hantera dem under Spelrum & publicering.</p>
    {confirmDelete ? <div className={styles.confirm} role="group" aria-label={`Bekräfta borttagning av ${lane.id}`}>
      <p>Ta bort sammansättningen {compositionLabel(lane.label)}?</p>
      <button type="button" className="sg-btn sg-btn-secondary" onClick={() => onEdit(current => removeLane(current, lane.id))}>Ta bort sammansättning</button>
      <button type="button" className="sg-btn sg-btn-ghost" onClick={() => setConfirmDelete(false)}>Avbryt</button>
    </div> : <button type="button" className="sg-btn sg-btn-ghost" onClick={() => setConfirmDelete(true)}>Ta bort sammansättning</button>}</section>
  </fieldset>;
}
