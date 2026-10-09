'use client';

import type {PresentationPackage} from '../../web/presentation-layers.mjs';
import { useState } from 'react';
import styles from './partner-appearance.module.css';
import {effectivePartnerAdjustments} from '../lib/partner-package-view.mjs';

// Lane token table.color is stored on the package as branding.color.
const TABLE_COLOR_KEY = 'color';
const BRANDING_FIELDS = ['name', 'logo', 'wordmark', 'primary', 'accent'] as const;
const ADJUSTMENTS = [
  ['table.color', 'Bordsfärg'],
  ['table', 'Bord'],
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
  presentation?: PresentationPackage;
  canConfigure?: boolean;
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
    if (![TABLE_COLOR_KEY,'background','table','dealer','lane'].includes(key) && typeof branding[key] === 'string' && !keys.includes(key)) keys.push(key);
  }
  return Object.fromEntries(keys.map(key => [key, textOf(branding, key)]));
}

export function PartnerAppearance({ initial, apiBase, operatorSlug, section = 'all' }: {
  initial: PartnerAppearanceInitial;
  apiBase: string;
  operatorSlug: string;
  section?: 'all'|'theme'|'design'|'background'|'dealers';
}) {
  const [laneId,setLaneId]=useState(initial.presentation?.lanes.find(row=>row.id===initial.branding.lane)?.id??initial.presentation?.lanes[0]?.id??'');
  const lane=initial.presentation?.lanes.find(row=>row.id===laneId);
  const allowed = new Set<string>(lane?effectivePartnerAdjustments(lane):initial.adjustable);
  const editable=initial.canConfigure!==false;
  const fields=ADJUSTMENTS.filter(([id])=>section==='all'||section==='theme'&&id==='branding'||section==='design'&&['table','table.color'].includes(id)||section==='background'&&id==='background'||section==='dealers'&&id==='dealer');
  const [choices,setChoices]=useState<Record<string,string>>(()=>Object.fromEntries(['background','table','dealer'].map(role=>[role,textOf(initial.branding,role)])));

  const [revision, setRevision] = useState(initial.packageRevision);
  const [color, setColor] = useState(textOf(initial.branding, TABLE_COLOR_KEY)||lane?.layers.table.colors?.[0]||'#000000');
  const [texts, setTexts] = useState<Record<string, string>>(() => brandingFields(initial.branding));
  const [problem, setProblem] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const colorHex = HEX.test(color);
  const picker = colorHex ? expandHex(color) : '#000000';

  async function save() {
    const branding: Record<string, string|null> = {};
    if(!editable)return;
    if(lane){branding.lane=lane.id;for(const role of ['background','table','dealer'] as const)if(fields.some(([id])=>id===role)&&allowed.has(role))branding[role]=choices[role]||null;}

    if (fields.some(([id])=>id==='table.color')&&allowed.has('table.color')) branding[TABLE_COLOR_KEY] = expandHex(color).toLowerCase();
    if (fields.some(([id])=>id==='branding')&&allowed.has('branding')) {
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
      {initial.presentation?<label>Lane<select value={laneId} onChange={event=>{
        setLaneId(event.target.value);const next=initial.presentation?.lanes.find(row=>row.id===event.target.value);
        setChoices(Object.fromEntries(['background','table','dealer'].map(role=>[role,next?.layers[role as 'background'|'table'|'dealer'].default??''])));
        setColor(next?.layers.table.colors?.[0]??'#000000');
      }}>{initial.presentation.lanes.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>:<p>Lanes {initial.lanes.join(', ')}</p>}

      {saved ? <p role="status">Sparad revision {saved}</p> : null}
      {problem ? <p role="alert">{problem}</p> : null}
      {!editable?<p>Din roll kan läsa paketet. Ändring kräver rättigheten att konfigurera presentationer.</p>:null}
      {lane&&!lane.composition?<p>Fullbildsklipp: bord och bakgrund är inbakade och kan inte bytas separat.</p>:null}
      <fieldset disabled={!editable||busy} style={{border:0,padding:0,margin:0,display:'grid',gap:16}}>
      {fields.map(([id, label]) => {
        if (!allowed.has(id)) {
          return (
            <label key={id} className={styles.row}>
              {label}
              <input value={DENIED} disabled readOnly />
            </label>
          );
        }
        if (id === 'table.color') {
          if(lane?.layers.table.colors?.length)return <label key={id} className={styles.row}>{label}<select value={color} onChange={event=>setColor(event.target.value)}>{lane.layers.table.colors.map(value=><option key={value} value={value}>{value}</option>)}</select></label>;
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
        const layer=lane?.layers[id as 'background'|'table'|'dealer'];
        return <label key={id} className={styles.row}>{label}<select aria-label={label} disabled={!layer} value={choices[id]??''} onChange={event=>setChoices(current=>({...current,[id]:event.target.value}))}>
          <option value="">Lanens standard</option>{layer?.allowed.map(value=><option key={value} value={value}>{initial.presentation?.assets.find(asset=>asset.id===value)?.label??value}</option>)}
        </select></label>;
      })}
      </fieldset>
      <button type="button" className="sg-btn sg-btn-primary" disabled={!editable||busy||!fields.some(([id])=>allowed.has(id))} onClick={save}>Spara utseende</button>
    </section>
  );
}
