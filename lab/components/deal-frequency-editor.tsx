'use client';

import type { MediaVariantPolicy, StudioProject } from '../../packages/presentation/contracts/studio-model.mjs';
import type { MediaFamily, VideoInventory } from '../../packages/presentation/contracts/media-inventory.mjs';
import { clipLabel } from '../lib/clip-label.mjs';
import { dealFrequencyPolicies, mediaVariantPolicy } from '../../packages/presentation/runtime/media-family-policy.mjs';
import styles from './media-family-editor.module.css';

export function DealFrequencyEditor({ family, inventory, project, onPolicy }: {
  family: MediaFamily; inventory: VideoInventory; project: StudioProject;
  onPolicy: (familyId: string, policy: MediaVariantPolicy) => void;
}) {
  const saved = project.mediaPolicy?.find(row => row.familyId === family.id)?.variants ?? [];
  const frequency = dealFrequencyPolicies(project, family);
  const ids = [...new Set([...family.variantIds, ...saved.filter(row => row.frequencyPercent !== undefined).map(row => row.videoId)])];
  const total = saved.reduce((sum, row) => sum + (row.frequencyPercent ?? 0), 0);
  const legacy = !frequency && saved.some(row => Object.values(row.selection).some(Boolean));
  const activeCount = saved.filter(row => (row.frequencyPercent ?? 0) > 0).length;
  const unavailableShare = saved.filter(row => !inventory.videos.some(video => video.id === row.videoId && video.available && family.variantIds.includes(video.id)))
    .reduce((sum, row) => sum + (row.frequencyPercent ?? 0), 0);
  return <section className={styles.policy} aria-label="Utdelningsklippens frekvens">
    <h3>Frekvens</h3>
    <p className="helper">0 % = manuellt prov. Resterande andel använder standardklippet.</p>
    {legacy ? <p className="notice subtle">Ett äldre urval finns sparat för den här platsen. Första frekvensändringen ersätter det urvalet för hela platsen när du sparar. Sätt procent för varje variant du vill använda.</p> : null}
    {ids.map(id => {
      const video = inventory.videos.find(item => item.id === id);
      const fileName = video?.fileName ?? 'Tidigare variant · filen saknas';
      const derived = clipLabel({ id, familyId: video?.familyId ?? family.id, role: video?.role ?? 'variant', relativePath: video?.relativePath }, project.clipLabels);
      const clipName = derived;
      const available = Boolean(video?.available && family.variantIds.includes(id));
      const policy = mediaVariantPolicy(project, family, id);
      const percent = policy.frequencyPercent ?? 0;
      const full = percent === 0 && activeCount >= 4;
      const maximum = full ? 0 : 100 - total + percent;
      return <div className={styles.frequencyRow} key={id}>
        <label className="field" title={id}>{clipName}
          <span className={styles.percentInput}><input type="number" min={0} max={maximum} step={1} value={percent}
            aria-label={`Frekvens i procent för ${clipName}`} disabled={full || !available && percent === 0}
            onChange={event => {
              const value = event.target.valueAsNumber;
              if (Number.isFinite(value)) onPolicy(family.id, { ...policy, frequencyPercent: Math.max(0, Math.min(maximum, Math.round(value))) });
            }} /><span>%</span></span>
        </label>
        <small>{full ? 'Fyra varianter är aktiva. Sätt en av dem till 0 % för att välja detta klipp.' : available ? `${maximum} % tillgängligt för detta klipp` : 'Filen saknas. Dess andel använder standardklippet tills filen är tillbaka eller du sätter 0 %.'}</small>
        {percent > 0 ? <button type="button" className="text-button" onClick={() => onPolicy(family.id, { ...policy, frequencyPercent: 0 })}>Stäng av varianten</button> : null}
      </div>;
    })}
    <p className={styles.empty}><strong>Standardklippet: {legacy ? 'tidigare urval gäller tills du sparar en frekvens' : `${100 - total + unavailableShare} %`}</strong></p>
    <details><summary>Avancerat · frekvens och spelval</summary><p>Frekvenser gäller den exakta kortplatsen. Högst fyra aktiva varianter. Kortvärde och handindex kommer från servern.</p><p>Regler, Slump och OpenClaw använder samma frekvensval. Bara standard väljer alltid standard; Skuggläge visar standard med ett provbeslut.</p></details>
  </section>;
}
