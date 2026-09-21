import type { StudioEvent } from '../lib/studio-model.mjs';
import type { OriginalMediaCatalog } from '../lib/original-media.mjs';

// A sample selector within the existing speech group, not a project migration
// or an inferred speech instruction on a received turn/settle event.
export function SpeechSource({ event, originals, dealerId, observed, onSelect, onOpenSpeech }: {
  event: StudioEvent; originals: OriginalMediaCatalog | null; dealerId: string; observed: boolean;
  onSelect: (line: string) => void; onOpenSpeech: () => void;
}) {
  if (event.sourceType === 'turn' || event.sourceType === 'settle') return <p className="workspace-footnote">
    {event.sourceType === 'turn' ? 'Turmarkeringen visar vem som får agera. Ingen egen turvideo finns i originalkartan.' : 'Resultatet visar motorns utfall. Resultattalet kommer i ett separat tal-event, så att repliken spelas en gång.'}
    {' '}<button className="text-button" onClick={onOpenSpeech}>Öppna tal-klippen →</button>
  </p>;
  if (event.sourceType === 'reveal') return <p className="workspace-footnote">Kortvändningen görs av spelaren. Originalkartan anger ingen separat reveal-video.</p>;
  if (event.id !== 'speak.other') return null;
  const clips = originals?.entries.filter(entry => entry.dealerId === dealerId && entry.kind === 'speech' && entry.eventId === 'speak.other' && entry.available) ?? [];
  const line = String(event.exampleEvent.line ?? '');
  if (observed) return <p className="workspace-footnote">Mottagen exakt replik: <strong>{line}</strong>. Sekvensens replik behålls vid variantval.</p>;
  return <label className="field">Tal-klipp att prova · {clips.length} lokala original
    <select value={line} onChange={e => onSelect(e.target.value)}>
      {!clips.some(clip => clip.situation === line) ? <option value={line}>{line} · originalvideo saknas</option> : null}
      {clips.map(clip => <option key={clip.id} value={clip.situation}>{clip.situation}{clip.caption ? ` · ${clip.caption}` : ''}</option>)}
    </select>
    <small className="helper">Väljer ett labbexempel. Standard använder exakt replik; inspelade event behåller sin egen replik.</small>
  </label>;
}
