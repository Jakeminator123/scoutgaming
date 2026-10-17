'use client';
import { useEffect, useState } from 'react';
import type { DealerId, LegacyClipBinding, StudioProject } from '../../packages/presentation/contracts/studio-model.mjs';
import type { LegacyClipControls } from '../../packages/presentation/contracts/legacy-clip-types.mjs';
import { LEGACY_CLIP_PARTS, LEGACY_PART_LABELS, upsertLegacyClipBinding } from '../../packages/presentation/runtime/legacy-clip-policy.mjs';
import { clipLabel, clipSituationLabel } from '../lib/clip-label.mjs';
import { requestJson } from './studio-types';
import {DealerClipPreview} from './dealer-video-surface';
import { legacyPartInSection, selectedDealerClips, type LegacyWorkspaceSection } from '../lib/dealer-workspace.mjs';

// Controlled draft editor: the parent's usual save/CAS/history owns every edit.
// Reading the inventory does not replace a draft or write either BO or Studio.
export function LegacyClipEditor({ project, onChange, dealerId: controlledDealerId, section = 'all' }: { project: StudioProject; onChange: (policy: LegacyClipBinding[]) => void; dealerId?: DealerId; section?: LegacyWorkspaceSection }) {
  const [controls, setControls] = useState<LegacyClipControls | null>(null);
  const [localDealerId, setDealer] = useState<DealerId>('vera');
  const dealerId = controlledDealerId ?? localDealerId;
  const [error, setError] = useState('');
  const [previewId, setPreviewId] = useState('');
  useEffect(() => {
    let mounted = true;
    requestJson<LegacyClipControls>('/api/clip-controls').then(data => { if (mounted) setControls(data); }).catch(cause => { if (mounted) setError(cause.message); });
    return () => { mounted = false; };
  }, []);
  const choose = (part: string, clipId: string) => onChange(upsertLegacyClipBinding(project.legacyClipPolicy, { dealerId, part, clipId }));
  const bindings = project.legacyClipPolicy?.filter(row => row.dealerId === dealerId) ?? [];
  const clips = selectedDealerClips(controls?.clips ?? [], dealerId, section);
  const name = (clip: NonNullable<typeof controls>['clips'][number]) => clipLabel({ id: clip.id, label: clip.lineId ? clipSituationLabel('speak.other', clip.lineId) : clip.exactParts[0] ? LEGACY_PART_LABELS[clip.exactParts[0] as keyof typeof LEGACY_PART_LABELS] : clip.id }, project.clipLabels);
  const preview = clips.find(clip => clip.id === previewId && clip.available);
  function bindingField(part: string, showMissing = false) {
    const binding = bindings.find(row => row.part === part);
    const candidates = clips.filter(clip => clip.available && clip.exactParts.includes(part));
    const valid = !binding || candidates.some(clip => clip.id === binding.clipId);
    if (!candidates.length && !binding) return showMissing ? <p key={part} className="helper">Exakt klippkoppling saknas.</p> : null;
    return <label className="field" key={part}>{clipSituationLabel('deal.dealer', part)}<select aria-label={`${dealerId} ${part}`} value={binding?.clipId ?? ''} onChange={event => choose(part, event.target.value)}>
      <option value="">Registrerat standardval</option>
      {!valid ? <option value={binding!.clipId}>Inaktiv: {binding!.clipId}</option> : null}
      {candidates.map(clip => <option key={clip.id} value={clip.id}>{name(clip)}</option>)}
    </select>{!valid ? <small>Exakt fil eller situation saknas. Välj en giltig koppling före sparning.</small> : null}</label>;
  }
  return <section className="panel" aria-label={controlledDealerId ? `Befintliga klipp för ${dealerId}` : 'Gemensamma klippval för alla dealers'}>
    <div className="inspector-heading"><span className="eyebrow">DEALERNS KLIPP</span><h2>{section === 'clips' ? 'Förinspelade repliker och ljud' : section === 'all' ? 'Klipp och kopplingar' : section === 'idle' ? 'Grundloop och variationer' : 'Utdelning'}</h2>
</div>
    <div className="inspector-content">
      {!controlledDealerId ? <label className="field">Croupier<select value={dealerId} onChange={event => setDealer(event.target.value as DealerId)}>{project.dealers.map(dealer => <option key={dealer.id} value={dealer.id}>{dealer.label}</option>)}</select></label> : null}
      {error ? <p role="alert">{error}</p> : !controls ? <p role="status">Läser befintliga medieregister…</p> : <>
        {preview?.previewSrc ? <DealerClipPreview key={preview.id} url={preview.previewSrc} label={`Förhandsvisa ${name(preview)}`}/> : null}
        {section === 'clips' ? <div className="variant-list">{clips.filter(clip => clip.lineId).map(clip => <article key={clip.id}><strong>{name(clip)}</strong>{clip.text ? <p>{clip.text}</p> : null}{clip.previewSrc ? <button type="button" className="text-button" disabled={!clip.available} onClick={() => setPreviewId(clip.id)}>Spela</button> : null}</article>)}</div> : null}
        {section === 'deal' || section === 'all' ? <div aria-label="Spelarpositioner och dealer" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,240px),1fr))',gap:16}}>
          {Array.from({length:7},(_,box)=><section key={box} data-position={`box${box}`}><h3>Spelarplats {box+1}</h3>{bindingField(`box${box}`,true)}</section>)}
          <section data-position="dealer"><h3>Dealer</h3>{['dealer-up','dealer-hole'].map(part=> <div key={part}><strong>{clipSituationLabel('deal.dealer',part)}</strong>{bindingField(part,true)}</div>)}</section>
        </div> : null}
        {section === 'deal' ? <details><summary>Avancerat · befintliga utdelningsrörelser</summary>{['deal','dealWatch'].map(part=>bindingField(part))}</details> : section !== 'clips' ? LEGACY_CLIP_PARTS.filter(part => legacyPartInSection(part, section) && !/^box[0-6]$/.test(part) && !['dealer-up','dealer-hole'].includes(part)).map(part=>bindingField(part)) : null}
        <details><summary>Avancerat · klippidentitet och spelväg · {clips.length} filer</summary>
          <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Fil-ID</th><th>Källa / spelväg</th><th>Exakt situation / replik</th><th>Status</th></tr></thead><tbody>{clips.map((clip, index) => <tr key={`${clip.id}:${index}`}><td><code>{clip.id}</code></td><td><code>{clip.source}</code><br /><code>{clip.route}</code></td><td>{clip.lineId ?? (clip.exactParts.join(', ') || 'Endast granskning, ingen säker koppling')}{clip.text ? <p>{clip.text}</p> : null}</td><td>{clip.available ? 'Tillgänglig' : 'Saknas eller spärrad'}<br />{clip.reviewStatus}<br />{clip.previewSrc ? 'Förhandsvisning finns' : 'Ingen separat förhandsvisning'}</td></tr>)}</tbody></table></div>
        </details>
      </>}
    </div>
  </section>;
}
