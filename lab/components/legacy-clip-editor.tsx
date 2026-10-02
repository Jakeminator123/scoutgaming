'use client';
import { useEffect, useState } from 'react';
import type { DealerId, LegacyClipBinding, StudioProject } from '../lib/studio-model.mjs';
import type { LegacyClipControls } from '../lib/legacy-clip-inventory.mjs';
import { LEGACY_CLIP_PARTS, LEGACY_PART_LABELS, upsertLegacyClipBinding } from '../../presentation-runtime/legacy-clip-policy.mjs';
import { requestJson } from './studio-types';

// Controlled draft editor: the parent's usual save/CAS/history owns every edit.
// Reading the inventory does not replace a draft or write either BO or Studio.
export function LegacyClipEditor({ project, onChange }: { project: StudioProject; onChange: (policy: LegacyClipBinding[]) => void }) {
  const [controls, setControls] = useState<LegacyClipControls | null>(null);
  const [dealerId, setDealer] = useState<DealerId>('vera');
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    requestJson<LegacyClipControls>('/api/clip-controls').then(data => { if (mounted) setControls(data); }).catch(cause => { if (mounted) setError(cause.message); });
    return () => { mounted = false; };
  }, []);
  const choose = (part: string, clipId: string) => onChange(upsertLegacyClipBinding(project.legacyClipPolicy, { dealerId, part, clipId }));
  const bindings = project.legacyClipPolicy?.filter(row => row.dealerId === dealerId) ?? [];
  const clips = controls?.clips.filter(row => row.dealerId === dealerId) ?? [];
  const legacy = controls?.legacy.filter(row => row.dealerId === dealerId) ?? [];
  const route = controls?.routes.find(row => row.dealerId === dealerId);
  return <section className="panel" aria-label="Gemensamma klippval för alla dealers">
    <div className="inspector-heading"><span className="eyebrow">LAB ÄGER AKTIVA KLIPPVAL</span><h2>Klippflöden och äldre kopplingar</h2>
      <p>Alla val sparas med projektets vanliga Spara-knapp. Spelarens kvitto krävs för att ett klipp ska räknas som uppspelat.</p></div>
    <div className="inspector-content">
      <label className="field">Croupier<select value={dealerId} onChange={event => setDealer(event.target.value as DealerId)}>{project.dealers.map(dealer => <option key={dealer.id} value={dealer.id}>{dealer.label}</option>)}</select></label>
      {error ? <p role="alert">{error}</p> : !controls ? <p role="status">Läser befintliga medieregister…</p> : <>
        <p><strong>{route?.policy}</strong> · {route?.reload}</p>
        <p>Ordinarie motorkälla: <code>{route?.engineRoute}</code>. {dealerId === 'astrid' ? <>Astrids Studio-val gäller <code>{route?.studioRoute}</code>, med egna exakta replik-/destinationsfamiljer.</> : 'Förinspelat tal följer fortfarande exakt replik och dess granskade audio/video-par.'}</p>
        {LEGACY_CLIP_PARTS.filter(part => clips.some(clip => clip.exactParts.includes(part)) || bindings.some(row => row.part === part)).map(part => {
          const binding = bindings.find(row => row.part === part);
          const candidates = clips.filter(clip => clip.available && clip.exactParts.includes(part));
          const valid = !binding || candidates.some(clip => clip.id === binding.clipId);
          return <label className="field" key={part}>{LEGACY_PART_LABELS[part]}<select aria-label={`${dealerId} ${part}`} value={binding?.clipId ?? ''} onChange={event => choose(part, event.target.value)}>
            <option value="">Befintligt registrerat standardval</option>
            {!valid ? <option value={binding!.clipId}>Inaktiv: {binding!.clipId} · exakt fil eller situation saknas</option> : null}
            {candidates.map(clip => <option key={clip.id} value={clip.id}>{clip.id} · {clip.kind === 'performance' ? 'endast staged' : 'originalmotor'}</option>)}
          </select>{!valid ? <small>Ta bort eller välj en exakt koppling innan sparning. Äldre BO-val används inte som reserv.</small> : null}</label>;
        })}
        <details><summary>Äldre BO-val · {legacy.length} · inaktiva i ordinarie spel</summary>
          {legacy.length ? legacy.map((row, index) => <p key={`${row.part}:${index}`}><strong>{row.part}</strong> → <code>{row.clipId}</code><br />{row.reason}
            {row.importable ? <button type="button" className="text-button" onClick={() => choose(row.part, row.clipId)}>Importera exakt koppling till utkast</button> : null}</p>) : <p>Inga äldre tilldelningar för denna croupier.</p>}
        </details>
        <details><summary>Befintliga mediekällor · {clips.length} registrerade filer</summary><p>Registrering, tillgänglig förhandsvisning och tillåten koppling är skilda från faktisk uppspelning. Oklara staged-destinationer och tal kan granskas men lånas aldrig till en annan situation.</p>
          <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Fil-ID</th><th>Källa / spelväg</th><th>Exakt situation / replik</th><th>Status</th></tr></thead><tbody>{clips.map((clip, index) => <tr key={`${clip.id}:${index}`}><td><code>{clip.id}</code></td><td><code>{clip.source}</code><br /><code>{clip.route}</code></td><td>{clip.lineId ?? (clip.exactParts.join(', ') || 'Endast granskning, ingen säker koppling')}{clip.text ? <p>{clip.text}</p> : null}</td><td>{clip.available ? 'Tillgänglig' : 'Saknas eller spärrad'}<br />{clip.reviewStatus}<br />{clip.previewSrc ? 'Förhandsvisning finns' : 'Ingen separat förhandsvisning'}<br />Ej uppspelningskvitto</td></tr>)}</tbody></table></div>
        </details>
      </>}
    </div>
  </section>;
}
