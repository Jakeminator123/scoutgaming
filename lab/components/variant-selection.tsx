'use client';
import type { StudioVariant, VariantSelection } from '../lib/studio-model.mjs';
import { selectionFor } from '../lib/video-intake.mjs';

export function VariantSelectionFields({ value, onChange }: {value: VariantSelection; onChange: (value: VariantSelection) => void}) {
  return <fieldset className="trigger-assignment"><legend>Hur får alternativet väljas?</legend>
    {([['rules', 'Regler', 'Kan väljas deterministiskt efter prioritet.'], ['model', 'OpenClaw', 'Får föreslås av modellen.'], ['random', 'Slumpvariation', 'Kan ingå i en slumpad presentation. Av från början.']] as const).map(([key, label, help]) =>
      <label className="check-field" key={key}><input type="checkbox" checked={value[key]} onChange={e => onChange({ ...value, [key]: e.target.checked })} /><span>{label}<small>{help}</small></span></label>)}
    <p className="helper">Alla av = endast manuell förhandsvisning. Valda triggers måste fortfarande matcha. Standardläget spelar alltid standard.</p>
  </fieldset>;
}
export function VariantSelectionEditor({ variant, onChange }: {variant: StudioVariant; onChange: (value: VariantSelection) => void}) {
  return <VariantSelectionFields value={selectionFor(variant)} onChange={onChange} />;
}
