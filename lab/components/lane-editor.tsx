'use client';

import { useState, type FormEvent } from 'react';
import {
  BACKGROUND_MODES,
  OPENCLAW_MODES,
  OPENCLAW_PHASES,
  OPERATOR_ADJUSTABLE,
  defaultPresentationLane,
  validateProject,
  type LaneBackgroundMode,
  type OpenClawMode,
  type OperatorAdjustable,
  type StudioLane,
  type StudioProject,
} from '../lib/studio-model.mjs';
import styles from './lane-editor.module.css';

export const LANE_ID_HELP = 'Id ska vara samma som ett lane-id under Administration → Spel, lanes & bord för att spelet ska kunna köra lanen.';

type Edit = (edit: (current: StudioProject) => StudioProject) => void;

export function commitLanes(project: StudioProject, lanes: StudioLane[]) {
  const next = structuredClone(project);
  next.lanes = structuredClone(lanes);
  return validateProject(next);
}

export function addLane(project: StudioProject, id: string, label: string) {
  const lane = defaultPresentationLane();
  lane.id = id;
  lane.label = label;
  return commitLanes(project, [...(project.lanes ?? []), lane]);
}

export function addDefaultLane(project: StudioProject) {
  return commitLanes(project, [...(project.lanes ?? []), defaultPresentationLane()]);
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

function linesOf(value: string) {
  return value.split('\n').map(item => item.trim()).filter(item => item.length > 0);
}

function layerText(lane: StudioLane) {
  const mark = (enabled: boolean) => enabled ? 'på' : 'av';
  return `Bakgrund ${mark(lane.layers.background.enabled)}, bord ${mark(lane.layers.table.enabled)}, dealer ${mark(lane.layers.dealer.enabled)}`;
}

function openClawText(lane: StudioLane) {
  return `OpenClaw ${OPENCLAW_PHASES.map(phase => `${phase} ${lane.openclaw[phase]}`).join(', ')}`;
}

function LaneSummary({ lane }: { lane: StudioLane }) {
  const items: [string, string][] = [
    ['Id', lane.id],
    ['Namn', lane.label],
    ['Dealers', lane.dealers.join(', ')],
    ['Lager', layerText(lane)],
    ['OpenClaw', openClawText(lane)],
  ];
  return <dl className={styles.summary}>
    {items.map(([term, value], index) => <div className={styles.summaryItem} key={term}>
      {index > 0 ? <span className={styles.dot} aria-hidden="true">·</span> : null}
      <dt>{term}</dt>
      <dd>{value}</dd>
    </div>)}
  </dl>;
}

function IdHelp({ id }: { id: string }) {
  return <p id={id} className={styles.help}>{LANE_ID_HELP}</p>;
}

function applyWhenValid(project: StudioProject, onEdit: Edit, change: (current: StudioProject) => StudioProject, after: () => void) {
  try { change(project); }
  catch (cause) { onEdit(() => { throw cause; }); return; }
  onEdit(change);
  after();
}

export function LaneEditor({ project, onEdit }: { project: StudioProject; onEdit: Edit }) {
  const lanes = project.lanes ?? [];
  const [selectedId, setSelectedId] = useState('');
  const [draftId, setDraftId] = useState('');
  const [draftLabel, setDraftLabel] = useState('');
  const selected = lanes.find(lane => lane.id === selectedId) ?? lanes[0] ?? null;
  const suggestion = defaultPresentationLane();

  function addNew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = draftId.trim();
    const label = draftLabel.trim();
    applyWhenValid(project, onEdit, current => addLane(current, id, label), () => {
      setDraftId('');
      setDraftLabel('');
      setSelectedId(id);
    });
  }

  function addSuggested() {
    applyWhenValid(project, onEdit, current => addDefaultLane(current), () => setSelectedId(suggestion.id));
  }

  return <>
    <section className={styles.card} aria-labelledby="lanes-in-project">
      <h2 id="lanes-in-project">Lanes i projektet</h2>
      {lanes.length === 0 ? <div className={styles.suggestion}>
        <p>Ingen lane i projektet. Förslag:</p>
        <LaneSummary lane={suggestion} />
        <IdHelp id="default-lane-id-help" />
        <button type="button" className="sg-btn sg-btn-secondary" onClick={addSuggested}>Lägg till standardlane</button>
      </div> : <ul className={styles.laneList}>
        {lanes.map(lane => <li key={lane.id}>
          <button type="button" className={styles.pick} aria-pressed={selected?.id === lane.id} onClick={() => setSelectedId(lane.id)}>
            <LaneSummary lane={lane} />
          </button>
        </li>)}
      </ul>}
      {selected ? <LaneFields key={selected.id} project={project} lane={selected} onEdit={onEdit} /> : null}
    </section>
    <form className={styles.card} onSubmit={addNew} aria-labelledby="new-lane-title">
      <h2 id="new-lane-title">Ny lane</h2>
      <div className={styles.create}>
        <label className={styles.field}>Id
          <input value={draftId} aria-describedby="new-lane-id-help" autoComplete="off" spellCheck={false} onChange={event => setDraftId(event.target.value)} />
        </label>
        <label className={styles.field}>Namn
          <input value={draftLabel} maxLength={80} onChange={event => setDraftLabel(event.target.value)} />
        </label>
        <button type="submit" className="sg-btn sg-btn-secondary">Ny lane</button>
      </div>
      <IdHelp id="new-lane-id-help" />
    </form>
  </>;
}

function LaneFields({ project, lane, onEdit }: { project: StudioProject; lane: StudioLane; onEdit: Edit }) {
  const [label, setLabel] = useState(lane.label);
  const [backgroundDefault, setBackgroundDefault] = useState(lane.layers.background.default ?? '');
  const [backgroundAllowed, setBackgroundAllowed] = useState(lane.layers.background.allowed.join('\n'));
  const [tableDefault, setTableDefault] = useState(lane.layers.table.default ?? '');
  const [tableAllowed, setTableAllowed] = useState(lane.layers.table.allowed.join('\n'));
  const [confirmDelete, setConfirmDelete] = useState(false);

  function editLane(change: (draft: StudioLane) => void, accept?: () => void) {
    const next = structuredClone(lane);
    change(next);
    try { replaceLane(project, lane.id, next); }
    catch (cause) { onEdit(() => { throw cause; }); return; }
    accept?.();
    onEdit(current => replaceLane(current, lane.id, next));
  }

  function toggleDealer(dealerId: string, checked: boolean) {
    editLane(draft => {
      const selected = new Set(draft.dealers);
      if (checked) selected.add(dealerId);
      else selected.delete(dealerId);
      draft.dealers = project.dealers.map(item => item.id).filter(id => selected.has(id));
      draft.layers.dealer.allowed = draft.layers.dealer.allowed.filter(id => selected.has(id));
      if (draft.dealers.length > 0 && !draft.dealers.includes(draft.layers.dealer.default)) draft.layers.dealer.default = draft.dealers[0];
    });
  }

  return <div className={styles.fields}>
    <h3>{lane.label}</h3>
    <p className={styles.idLine}>Id <strong>{lane.id}</strong></p>
    <IdHelp id={`lane-id-help-${lane.id}`} />
    <label className={styles.field}>Namn
      <input value={label} maxLength={80} onChange={event => {
        const value = event.target.value;
        editLane(draft => { draft.label = value; }, () => setLabel(value));
      }} />
    </label>
    <fieldset className={styles.group}>
      <legend>Dealers</legend>
      <div className={styles.checks}>
        {project.dealers.map(dealer => <label className={styles.check} key={dealer.id}>
          <input type="checkbox" checked={lane.dealers.includes(dealer.id)} onChange={event => toggleDealer(dealer.id, event.target.checked)} />
          {dealer.label}
        </label>)}
      </div>
    </fieldset>
    <fieldset className={styles.group}>
      <legend>Bakgrund</legend>
      <label className={styles.check}><input type="checkbox" checked={lane.layers.background.enabled} onChange={event => editLane(draft => { draft.layers.background.enabled = event.target.checked; })} /> På</label>
      <label className={styles.field}>Läge
        <select value={lane.layers.background.mode} onChange={event => editLane(draft => { draft.layers.background.mode = event.target.value as LaneBackgroundMode; })}>
          {[...BACKGROUND_MODES].map(mode => <option key={mode} value={mode}>{mode}</option>)}
        </select>
      </label>
      <label className={styles.field}>Standard
        <input value={backgroundDefault} maxLength={200} onChange={event => {
          const value = event.target.value;
          editLane(draft => { draft.layers.background.default = value.trim() ? value.trim() : null; }, () => setBackgroundDefault(value));
        }} />
      </label>
      <label className={styles.field}>Tillåtna, en per rad
        <textarea value={backgroundAllowed} rows={4} onChange={event => {
          const value = event.target.value;
          editLane(draft => { draft.layers.background.allowed = linesOf(value); }, () => setBackgroundAllowed(value));
        }} />
      </label>
    </fieldset>
    <fieldset className={styles.group}>
      <legend>Bord</legend>
      <label className={styles.check}><input type="checkbox" checked={lane.layers.table.enabled} onChange={event => editLane(draft => { draft.layers.table.enabled = event.target.checked; })} /> På</label>
      <label className={styles.field}>Standard
        <input value={tableDefault} maxLength={40} onChange={event => {
          const value = event.target.value;
          editLane(draft => { draft.layers.table.default = value.trim() ? value.trim() : null; }, () => setTableDefault(value));
        }} />
      </label>
      <label className={styles.field}>Tillåtna, en per rad
        <textarea value={tableAllowed} rows={4} onChange={event => {
          const value = event.target.value;
          editLane(draft => { draft.layers.table.allowed = linesOf(value); }, () => setTableAllowed(value));
        }} />
      </label>
    </fieldset>
    <fieldset className={styles.group}>
      <legend>Dealer</legend>
      <label className={styles.check}><input type="checkbox" checked={lane.layers.dealer.enabled} onChange={event => editLane(draft => { draft.layers.dealer.enabled = event.target.checked; })} /> På</label>
      <label className={styles.field}>Standard
        <select value={lane.layers.dealer.default} onChange={event => editLane(draft => { draft.layers.dealer.default = event.target.value; })}>
          {lane.dealers.map(id => <option key={id} value={id}>{project.dealers.find(dealer => dealer.id === id)?.label ?? id}</option>)}
        </select>
      </label>
      <div className={styles.checks}>
        {lane.dealers.map(id => <label className={styles.check} key={id}>
          <input type="checkbox" checked={lane.layers.dealer.allowed.includes(id)} onChange={event => editLane(draft => {
            const selected = new Set(draft.layers.dealer.allowed);
            if (event.target.checked) selected.add(id);
            else selected.delete(id);
            draft.layers.dealer.allowed = draft.dealers.filter(dealerId => selected.has(dealerId));
          })} />
          {project.dealers.find(dealer => dealer.id === id)?.label ?? id}
        </label>)}
      </div>
    </fieldset>
    <fieldset className={styles.group}>
      <legend>OpenClaw</legend>
      {OPENCLAW_PHASES.map(phase => <label className={styles.field} key={phase}>{phase}
        <select value={lane.openclaw[phase]} onChange={event => editLane(draft => { draft.openclaw[phase] = event.target.value as OpenClawMode; })}>
          {[...OPENCLAW_MODES].map(mode => <option key={mode} value={mode}>{mode}</option>)}
        </select>
      </label>)}
    </fieldset>
    <fieldset className={styles.group}>
      <legend>Operatören får justera</legend>
      <div className={styles.checks}>
        {OPERATOR_ADJUSTABLE.map(item => <label className={styles.check} key={item}>
          <input type="checkbox" checked={lane.operatorAdjustable.includes(item)} onChange={event => editLane(draft => {
            const selected = new Set(draft.operatorAdjustable);
            if (event.target.checked) selected.add(item);
            else selected.delete(item);
            draft.operatorAdjustable = OPERATOR_ADJUSTABLE.filter(entry => selected.has(entry));
          })} />
          {item}
        </label>)}
      </div>
    </fieldset>
    {confirmDelete ? <div className={styles.confirm} role="group" aria-label={`Bekräfta borttagning av ${lane.id}`}>
      <p>Ta bort lane {lane.id}?</p>
      <button type="button" className="sg-btn sg-btn-secondary" onClick={() => onEdit(current => removeLane(current, lane.id))}>Ta bort lane</button>
      <button type="button" className="sg-btn sg-btn-ghost" onClick={() => setConfirmDelete(false)}>Avbryt</button>
    </div> : <button type="button" className="sg-btn sg-btn-ghost" onClick={() => setConfirmDelete(true)}>Ta bort lane</button>}
  </div>;
}
