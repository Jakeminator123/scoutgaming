'use client';
import type { StudioVariant, VariantSelection } from '../../../packages/presentation/contracts/studio-model.mjs';
import { selectionFor } from '../../../packages/presentation/contracts/video-intake.mjs';

export function VariantSelectionFields({ value, onChange }: {value: VariantSelection; onChange: (value: VariantSelection) => void}) {
  return <fieldset className="trigger-assignment"><legend>Variantval</legend>
    <label className="check-field"><input type="checkbox" checked={value.model} onChange={e => onChange({ ...value, model: e.target.checked })} /><span>Tillåt OpenClaw att välja alternativet<small>Variantens villkor måste också matcha.</small></span></label>
    <details className="selection-diagnostics"><summary>Tillåt i jämförelsetester</summary>{([['rules', 'Regeltest', 'Kan väljas efter prioritet, utan OpenClaw.'], ['random', 'Slumptest', 'Kan ingå i ett slumpat variantval.']] as const).map(([key, label, help]) =>
      <label className="check-field" key={key}><input type="checkbox" checked={value[key]} onChange={e => onChange({ ...value, [key]: e.target.checked })} /><span>{label}<small>{help}</small></span></label>)}
    </details><p className="helper">Alla val av = endast manuell förhandsvisning. Standardvarianten finns alltid som reserv.</p>
  </fieldset>;
}
export function VariantSelectionEditor({ variant, onChange }: {variant: StudioVariant; onChange: (value: VariantSelection) => void}) {
  return <VariantSelectionFields value={selectionFor(variant)} onChange={onChange} />;
}
