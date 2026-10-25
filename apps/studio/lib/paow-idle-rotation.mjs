import source from './paow-idle-source-f664c54d.json' with { type: 'json' };
import { validateIdlePolicy } from '../../../packages/presentation/runtime/idle-policy.mjs';

// Match the registered owner's exact original bytes. Names are display-only.
export function preparePaowIdleRotation(policy, inventory) {
  if (policy?.familyId !== 'paow/idle.ready/ready') return null;
  const matched = [];
  for (const take of source.clips) {
    const rows = (inventory?.videos ?? []).filter(video => video.dealer === 'paow' && video.available === true && video.verdict !== 'no' && !video.deletion
      && video.sha256 === take.sha256 && video.bytes === take.bytes && video.classification?.dealerId === 'paow'
      && video.classification.kind === 'idle' && video.classification.eventId === 'idle.ready'
      && (video.classification.playback ?? 'once') === 'once' && video.familyId === policy.familyId);
    if (rows.length !== 1) return { policy: null, matched: matched.length, total: source.clips.length,
      error: rows.length ? `Flera PAOW-klipp matchar ${take.id}. Välj rätt original innan sekvensen kopplas.` : `Originalklippet ${take.id} saknas eller har ändrats.` };
    matched.push({ take, video: rows[0] });
  }
  const baseline = matched.find(row => row.take.id === 'andas');
  if (policy.base[0]?.videoId !== baseline.video.id) return { policy: null, matched: matched.length, total: source.clips.length,
    error: 'Välj andas som PAOWs basklipp före inkopplingen.' };
  const next = { schemaVersion: 1, familyId: policy.familyId,
    base: [{ videoId: baseline.video.id, durationMs: baseline.take.durationMs, weight: 100 }],
    variants: matched.filter(row => row !== baseline).map(({ take, video }) => ({ videoId: video.id, durationMs: take.durationMs,
      use: 'rotation', automatic: null, description: take.id })),
    rotation: { clips: matched.map(({ take, video }) => ({ videoId: video.id, phase: take.phase, from: take.from,
      to: take.to, weight: take.weight, head: take.head, calm: take.calm })) } };
  return { policy: validateIdlePolicy(next), matched: matched.length, total: source.clips.length, error: null };
}
