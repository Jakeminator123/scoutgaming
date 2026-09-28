'use client';

import type { MediaVariantPolicy, StudioProject } from '../lib/studio-model.mjs';
import type { MediaFamily, VideoInventory } from './studio-types';
import { dealFrequencyPolicies, mediaVariantPolicy } from '../lib/media-family-policy.mjs';
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
    <h3>Hur ofta ska varianterna väljas?</h3>
    <p className="helper">Ange procent för varje kort som delas till den här platsen. 20 % betyder ungefär en av fem gånger över tid. 0 % behåller klippet som manuellt prov.</p>
    {legacy ? <p className="notice subtle">Ett äldre urval finns sparat för den här platsen. Första frekvensändringen ersätter det urvalet för hela platsen när du sparar. Sätt procent för varje variant du vill använda.</p> : null}
    {ids.map(id => {
      const video = inventory.videos.find(item => item.id === id);
      const available = Boolean(video?.available && family.variantIds.includes(id));
      const policy = mediaVariantPolicy(project, family, id);
      const percent = policy.frequencyPercent ?? 0;
      const full = percent === 0 && activeCount >= 4;
      const maximum = full ? 0 : 100 - total + percent;
      return <div className={styles.frequencyRow} key={id}>
        <label className="field">{video?.fileName ?? 'Tidigare variant · filen saknas'}
          <span className={styles.percentInput}><input type="number" min={0} max={maximum} step={1} value={percent}
            aria-label={`Frekvens i procent för ${video?.fileName ?? id}`} disabled={full || !available && percent === 0}
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
    <p className="helper">Spara inställningarna. Spelet läser dem vid nästa klippval. Frekvenserna används i Regler, Slump och OpenClaw utan modellanrop. Bara standard spelar alltid standard; Skuggläge visar standard med ett provbeslut. Klippets destination och kortdata styrs av servern.</p>
  </section>;
}
