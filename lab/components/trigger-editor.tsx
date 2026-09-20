'use client';

import { useState } from 'react';
import type { PathDescriptor, PredicateOperator, Scalar, StudioTrigger, TriggerCategory } from '../lib/studio-model.mjs';
import { parseTriggerValue } from './trigger-value.mjs';

export const categoryLabels: Record<TriggerCategory, string> = { deterministic: 'Spel & regler', social: 'Socialt & minne', temperament: 'Temperament' };
const categoryDescriptions: Record<TriggerCategory, string> = {
  deterministic: 'En exakt regel om det publicerade spelet eller redan avslutad spelhistorik.',
  social: 'En signal från chatt eller en spelarpreferens. I labbet är dessa testdata, inte ett riktigt minne.',
  temperament: 'Den ton croupiern får använda. I labbet anger du stämningen själv.',
};
const operatorLabels: Record<PredicateOperator, string> = { eq: 'är lika med', ne: 'är inte', gt: 'är större än', gte: 'är minst', lt: 'är mindre än', lte: 'är högst', includes: 'innehåller', all_eq: 'alla är', in: 'finns i listan', exists: 'finns' };

export function defaultValue(descriptor: PathDescriptor): Scalar | Scalar[] {
  if (descriptor.values?.length) return descriptor.values[0];
  if (descriptor.kind === 'number') return descriptor.min ?? 0;
  if (descriptor.kind === 'boolean') return true;
  return '';
}

export function TriggerEditor({ triggers, descriptors, onChange, onAdd, onRemove }: {
  triggers: StudioTrigger[];
  descriptors: readonly PathDescriptor[];
  onChange: (id: string, patch: Partial<StudioTrigger>) => void;
  onAdd: (category: TriggerCategory) => string;
  onRemove: (id: string) => void;
}) {
  const [category, setCategory] = useState<TriggerCategory>('social');
  const [selectedId, setSelectedId] = useState('');
  const visible = triggers.filter(trigger => trigger.category === category);
  const selected = visible.find(trigger => trigger.id === selectedId) ?? visible[0];
  const paths = descriptors.filter(descriptor => descriptor.category === category);
  const descriptor = paths.find(path => path.path === selected?.path);

  function changePath(path: string) {
    const next = descriptors.find(item => item.path === path);
    if (next && selected) onChange(selected.id, { path, category: next.category, op: next.operators[0], value: defaultValue(next) });
  }

  function changeValue(raw: string) {
    if (!selected || !descriptor) return;
    onChange(selected.id, { value: parseTriggerValue(raw, descriptor, selected.op) });
  }

  return <div className="trigger-editor">
    <div className="category-tabs" role="group" aria-label="Triggerkategori">{(Object.keys(categoryLabels) as TriggerCategory[]).map(key => <button type="button" key={key} className={category === key ? 'active' : ''} aria-pressed={category === key} onClick={() => setCategory(key)}>{categoryLabels[key]}</button>)}</div>
    <p className="helper">{categoryDescriptions[category]}</p>
    <div className="trigger-list">{visible.map(trigger => <button key={trigger.id} type="button" className={`trigger-list-item ${selected?.id === trigger.id ? 'active' : ''}`} onClick={() => setSelectedId(trigger.id)}><span className={`trigger-dot ${category}`} /><span>{trigger.label}</span><span aria-hidden="true">›</span></button>)}</div>
    <button className="text-button add-trigger" type="button" onClick={() => setSelectedId(onAdd(category))}>＋ Ny trigger i {categoryLabels[category].toLowerCase()}</button>
    {selected ? <div className="trigger-form" key={selected.id}>
      <label className="field">Namn<input value={selected.label} maxLength={120} onChange={event => onChange(selected.id, { label: event.target.value })} /></label>
      <label className="field">Fält att kontrollera<select value={selected.path} onChange={event => changePath(event.target.value)}>{paths.map(path => <option key={path.path} value={path.path}>{path.label}</option>)}</select></label>
      <label className="field">Villkor<select value={selected.op} onChange={event => { const op = event.target.value as PredicateOperator; onChange(selected.id, { op, value: op === 'exists' ? true : op === 'in' ? [defaultValue(descriptor!) as Scalar] : defaultValue(descriptor!) }); }}>{descriptor?.operators.map(op => <option key={op} value={op}>{operatorLabels[op]}</option>)}</select></label>
      <label className="field">Värde{selected.op === 'exists' || descriptor?.kind === 'boolean' && selected.op !== 'in' ? <select value={String(selected.value)} onChange={event => changeValue(event.target.value)}><option value="true">Ja</option><option value="false">Nej</option></select> : descriptor?.values && selected.op !== 'in' ? <select value={String(selected.value)} onChange={event => changeValue(event.target.value)}>{descriptor.values.map(value => <option key={String(value)} value={String(value)}>{String(value)}</option>)}</select> : <input type={descriptor?.kind === 'number' && selected.op !== 'in' ? 'number' : 'text'} value={Array.isArray(selected.value) ? selected.value.join(', ') : String(selected.value ?? '')} min={descriptor?.min} max={descriptor?.max} onChange={event => changeValue(event.target.value)} />}</label>
      <code className="technical-id">{selected.path}</code>
      <p className="helper">Ändringen gäller alla varianter som använder denna trigger. Koppla den under fliken Varianter.</p>
      <button className="danger-button" type="button" onClick={() => onRemove(selected.id)}>Ta bort trigger</button>
    </div> : <p className="empty-copy">Inga triggers i denna kategori ännu.</p>}
  </div>;
}
