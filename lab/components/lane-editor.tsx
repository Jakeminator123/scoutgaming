'use client';
import {labUrl} from '../lib/lab-url.mjs';

import { useRef, useState, type FormEvent } from 'react';
import { PROBE_MODELS } from '../lib/probe-policy.mjs';
import {
  LANE_PROBE_MODES,
  OPENCLAW_MODES,
  OPENCLAW_PHASES,
  OPERATOR_ADJUSTABLE,
  defaultPresentationLane,
  validateProject,
  type LaneIdle,
  type LaneProbe,
  type LaneProbeMode,
  type OpenClawMode,
  type OperatorAdjustable,
  type StudioLane,
  type StudioProject,
} from '../lib/studio-model.mjs';
import styles from './lane-editor.module.css';

export const LANE_ID_HELP = 'Unikt id: små bokstäver, siffror och bindestreck.';
const modeLabels:Record<string,string>={off:'Av',rules:'Regler',random:'Slump',shadow:'Förslag utan att styra',active:'OpenClaw styr'};
const phaseLabels:Record<string,string>={idle:'Grundloop',deal:'Kortgivning',reveal:'Visa kort',speak:'Repliker',probe:'AI-småprat vid inaktivitet'};
const adjustmentLabels:Record<string,string>={'table.color':'Bordsfärg',table:'Bord',background:'Bakgrund',dealer:'Dealer',branding:'Bolagets profil'};

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

function writeIdle(draft: StudioLane, change: (idle: LaneIdle) => void) {
  const idle: LaneIdle = { ...draft.idle };
  change(idle);
  if (idle.frequencyPercent === undefined && idle.variants === undefined) delete draft.idle;
  else draft.idle = idle;
}

function layerText(lane: StudioLane) {
  const mark = (enabled: boolean) => enabled ? 'på' : 'av';
  return `Bakgrund ${mark(lane.layers.background.enabled)}, bord ${mark(lane.layers.table.enabled)}, dealer ${mark(lane.layers.dealer.enabled)}`;
}

function LaneSummary({ lane }: { lane: StudioLane }) {
  const items: [string, string][] = [
    ['Namn', lane.label],
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
  const lanes = project.lanes ?? [];
  const selected = lanes.find(lane => lane.id === selectedId) ?? lanes[0] ?? null;
  const [draftLabel, setDraftLabel] = useState('');
  const creating = useRef(false);
  function addNew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = draftLabel.trim();
    if (disabled || creating.current || !label) return;
    creating.current = true;
    try {
      // Generate once outside the React updater so replays keep the same identity.
      const id = newCompositionId(project, label);
      addLane(project, id, label);
      onEdit(current => addLane(current, id, label));
      setDraftLabel(''); onSelect(id);
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
        <label className={styles.field}>Sammansättning<select value={selected.id} onChange={event => { if (!disabled) onSelect(event.target.value); }}>{lanes.map(lane => <option key={lane.id} value={lane.id}>{lane.label}</option>)}</select></label>
        <label className={styles.field}>Sammansättningens namn<input value={selected.label} maxLength={80} onChange={event => rename(event.target.value)} /></label>
      </div> : <div className={styles.suggestion}>
        <p>Ingen sparad sammansättning.</p><LaneSummary lane={defaultPresentationLane()} />
        <button type="button" className="sg-btn sg-btn-secondary" onClick={() => { if (!disabled) applyWhenValid(project, onEdit, addDefaultLane, () => onSelect(defaultPresentationLane().id)); }}>Skapa standardsammansättning</button>
      </div>}
    </section>
    <details className={styles.card}><summary>Ny sammansättning</summary><form onSubmit={addNew} aria-labelledby="new-lane-title">
      <h2 id="new-lane-title">Skapa sammansättning</h2><div className={styles.create}>
        <label className={styles.field}>Namn på ny sammansättning<input value={draftLabel} required maxLength={80} onChange={event => { creating.current = false; setDraftLabel(event.target.value); }} /></label>
        <button type="submit" className="sg-btn sg-btn-secondary" disabled={!draftLabel.trim()}>Skapa sammansättning</button>
      </div><p className={styles.help}>Ett tekniskt ID skapas automatiskt och behålls när namnet ändras.</p>
    </form></details>
  </fieldset>;
}

export function CompositionSettings({ project, lane, onEdit: onModelEdit, disabled = false }: {
  project: StudioProject; lane: StudioLane; onEdit: Edit; disabled?: boolean;
}) {
  const onEdit: Edit = change => { if (!disabled) onModelEdit(change); };
  const [draftColor, setDraftColor] = useState('#1b4332');
  const [idleVariants, setIdleVariants] = useState((lane.idle?.variants ?? []).join('\n'));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tableColors = lane.layers.table.colors ?? [];
  function editLane(change: (draft: StudioLane) => void, accept?: () => void) {
    if (disabled) return;
    const next = structuredClone(lane); change(next);
    try { replaceLane(project, lane.id, next); }
    catch (cause) { onEdit(() => { throw cause; }); return; }
    accept?.(); onEdit(current => replaceLane(current, lane.id, next));
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
    <details className={styles.advanced}><summary>Uppspelning · regler, slump och OpenClaw</summary><fieldset className={styles.group}>
      <legend>OpenClaw väljer klipp</legend>
      {OPENCLAW_PHASES.map(phase => <label className={styles.field} key={phase}>{phaseLabels[phase]??phase}
        <select value={lane.openclaw[phase]} onChange={event => editLane(draft => { draft.openclaw[phase] = event.target.value as OpenClawMode; })}>
          {[...OPENCLAW_MODES].map(mode => <option key={mode} value={mode}>{modeLabels[mode]??mode}</option>)}
        </select>
      </label>)}
    </fieldset>
    <fieldset className={styles.group}>
      <legend>AI-småprat vid inaktivitet</legend>
      <label className={styles.field}>Läge
        <select value={lane.probe?.mode ?? ''} onChange={event => {
          const mode = event.target.value;
          editLane(draft => {
            if (!mode) { delete draft.probe; return; }
            const next: LaneProbe = { mode: mode as LaneProbeMode };
            if (draft.probe?.model) next.model = draft.probe.model;
            draft.probe = next;
          });
        }}>
          <option value="">Följer OpenClaw</option>
          {LANE_PROBE_MODES.map(mode => <option key={mode} value={mode}>{modeLabels[mode]??mode}</option>)}
        </select>
      </label>
      <label className={styles.field}>Modell
        <select value={lane.probe?.model ?? ''} disabled={!lane.probe} onChange={event => {
          const model = event.target.value;
          editLane(draft => {
            if (!draft.probe) return;
            if (!model) delete draft.probe.model;
            else draft.probe.model = model as LaneProbe['model'];
          });
        }}>
          <option value="">Ingen egen modell</option>
          {PROBE_MODELS.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
        </select>
      </label>
      <p className={styles.help}>Välj när OpenClaw får föreslå eller styra AI-småprat vid inaktivitet. <a href={labUrl('/control/probe')}>Öppna inställningar för AI-småprat vid inaktivitet</a></p>
    </fieldset>
    <fieldset className={styles.group}>
      <legend>Grundloopens variationer</legend>
      <label className={styles.field}>Variationsfrekvens (%)
        <input type="number" min={0} max={100} step={1} inputMode="numeric" value={lane.idle?.frequencyPercent ?? ''} onChange={event => {
          const raw = event.target.value;
          editLane(draft => writeIdle(draft, idle => {
            if (raw === '') delete idle.frequencyPercent;
            else idle.frequencyPercent = Number(raw);
          }));
        }} />
      </label>
      <label className={styles.field}>Variations-id, ett per rad
        <textarea value={idleVariants} rows={4} onChange={event => {
          const value = event.target.value;
          editLane(draft => writeIdle(draft, idle => {
            const variants = linesOf(value);
            if (variants.length === 0) delete idle.variants;
            else idle.variants = variants;
          }), () => setIdleVariants(value));
        }} />
      </label>
    </fieldset></details>
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
    <p className={styles.idLine}>Presentationens tekniska ID <strong>{lane.id}</strong></p>
    {confirmDelete ? <div className={styles.confirm} role="group" aria-label={`Bekräfta borttagning av ${lane.id}`}>
      <p>Ta bort presentation {lane.id}?</p>
      <button type="button" className="sg-btn sg-btn-secondary" onClick={() => onEdit(current => removeLane(current, lane.id))}>Ta bort presentation</button>
      <button type="button" className="sg-btn sg-btn-ghost" onClick={() => setConfirmDelete(false)}>Avbryt</button>
    </div> : <button type="button" className="sg-btn sg-btn-ghost" onClick={() => setConfirmDelete(true)}>Ta bort presentation</button>}</details>
  </fieldset>;
}
