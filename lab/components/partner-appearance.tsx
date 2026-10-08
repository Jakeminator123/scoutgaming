'use client';

import { useState } from 'react';
import styles from './partner-appearance.module.css';

// Lane token table.color is stored on the package as branding.color.
const TABLE_COLOR_KEY = 'color';
const BRANDING_FIELDS = ['name', 'logo', 'wordmark', 'primary', 'accent'] as const;
const ADJUSTMENTS = [
  ['table.color', 'Bordsfärg'],
  ['background', 'Bakgrund'],
  ['dealer', 'Dealer'],
  ['branding', 'Branding'],
] as const;
const FIELD_LABELS: Record<string, string> = {
  name: 'Namn',
  logo: 'Logotyp',
  wordmark: 'Ordmarke',
  primary: 'Primärfärg',
  accent: 'Accent',
};
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const DENIED = 'Tillåts inte av lanen';

export type PartnerAppearanceInitial = {
  operatorId: string;
  packageRevision: number;
  lanes: readonly string[];
  branding: Readonly<Record<string, unknown>>;
  adjustable: readonly string[];
};

function textOf(branding: Readonly<Record<string, unknown>>, key: string) {
  const value = branding[key];
  return typeof value === 'string' ? value : '';
}

function expandHex(value: string) {
  if (/^#[0-9a-fA-F]{3}$/.test(value)) return `#${value.slice(1).split('').map(char => char + char).join('')}`;
  return value;
}

function brandingFields(branding: Readonly<Record<string, unknown>>) {
  const keys = [...BRANDING_FIELDS] as string[];
  for (const key of Object.keys(branding)) {
    if (key !== TABLE_COLOR_KEY && typeof branding[key] === 'string' && !keys.includes(key)) keys.push(key);
  }
  return Object.fromEntries(keys.map(key => [key, textOf(branding, key)]));
}

export function PartnerAppearance({ initial, apiBase, operatorSlug }: {
  initial: PartnerAppearanceInitial;
  apiBase: string;
  operatorSlug: string;
}) {
  const allowed = new Set(initial.adjustable);
  const [revision, setRevision] = useState(initial.packageRevision);
  const [color, setColor] = useState(textOf(initial.branding, TABLE_COLOR_KEY));
  const [texts, setTexts] = useState<Record<string, string>>(() => brandingFields(initial.branding));
  const [problem, setProblem] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const colorHex = HEX.test(color);
  const picker = colorHex ? expandHex(color) : '#000000';

  async function save() {
    const branding: Record<string, string> = {};
    if (allowed.has('table.color')) branding[TABLE_COLOR_KEY] = color;
    if (allowed.has('branding')) {
      for (const [key, value] of Object.entries(texts)) branding[key] = value;
    }
    setBusy(true);
    setProblem('');
    setSaved('');
    try {
      const response = await fetch(`${apiBase}/branding?operator=${encodeURIComponent(operatorSlug)}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ expectedRevision: revision, branding }),
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 409) {
        setProblem('Någon annan har sparat. Ladda om.');
        return;
      }
      if (!response.ok || typeof payload?.packageRevision !== 'number') {
        setProblem(typeof payload?.error === 'string' ? payload.error : 'Kunde inte spara.');
        return;
      }
      setRevision(payload.packageRevision);
      setSaved(String(payload.packageRevision));
    } catch {
      setProblem('Kunde inte spara.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel}>
      <p>Revision {revision}</p>
      <p>Lanes {initial.lanes.join(', ')}</p>
      {saved ? <p role="status">Sparad revision {saved}</p> : null}
      {problem ? <p role="alert">{problem}</p> : null}
      {ADJUSTMENTS.map(([id, label]) => {
        if (!allowed.has(id)) {
          return (
            <label key={id} className={styles.row}>
              {label}
              <input value={DENIED} disabled readOnly />
            </label>
          );
        }
        if (id === 'table.color') {
          return (
            <div key={id} className={styles.row}>
              <label>
                {label}
                <input type="color" value={picker.length === 7 ? picker : '#000000'} onChange={event => setColor(event.target.value)} />
              </label>
              {colorHex ? (
                <label>
                  Bordsfärg som text
                  <input type="text" value={color} onChange={event => setColor(event.target.value)} />
                </label>
              ) : null}
            </div>
          );
        }
        if (id === 'branding') {
          return (
            <div key={id} className={styles.row}>
              {Object.keys(texts).map(key => (
                <label key={key}>
                  {FIELD_LABELS[key] ?? key}
                  <input type="text" value={texts[key] ?? ''} onChange={event => setTexts(current => ({ ...current, [key]: event.target.value }))} />
                </label>
              ))}
            </div>
          );
        }
        return (
          <label key={id} className={styles.row}>
            {label}
            <input type="text" aria-label={label} value="" readOnly />
          </label>
        );
      })}
      <button type="button" className="sg-btn sg-btn-primary" disabled={busy} onClick={save}>Spara utseende</button>
    </section>
  );
}
