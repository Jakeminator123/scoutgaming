import type { StudioEvent } from '../../../packages/presentation/contracts/studio-model.mjs';
import { SPEECH_LINES } from '../../../packages/presentation/contracts/speech-lines.mjs';

// A sample selector within the existing speech group, not a project migration
// or an inferred speech instruction on a received turn/settle event.
const speechExamples = Object.entries(SPEECH_LINES);

export function SpeechSource({ event, dealerId, observed, onSelect, onOpenSpeech }: {
  event: StudioEvent; dealerId: string; observed: boolean;
  onSelect: (line: string) => void; onOpenSpeech: () => void;
}) {
  if (event.sourceType === 'turn' || event.sourceType === 'settle') return <p className="workspace-footnote">
    {event.sourceType === 'turn' ? 'Turmarkeringen visar vem som får agera. Ingen egen turvideo är registrerad.' : 'Resultatet visar motorns utfall. Resultattalet kommer i ett separat tal-event, så att repliken spelas en gång.'}
    {' '}<button className="text-button" onClick={onOpenSpeech}>Öppna tal-klippen →</button>
  </p>;
  if (event.sourceType === 'reveal') return <p className="workspace-footnote">Kortvändningen görs av spelaren. Ingen separat reveal-video är registrerad.</p>;
  if (event.id !== 'speak.other') return null;
  const line = String(event.exampleEvent.line ?? '');
  if (observed) return <p className="workspace-footnote">Mottagen exakt replik: <strong>{line}</strong>. Sekvensens replik behålls vid variantval.</p>;
  return <label className="field">Tal-exempel att prova · {dealerId}
    <select value={line} onChange={e => onSelect(e.target.value)}>
      {!speechExamples.some(([id]) => id === line) ? <option value={line}>{line}</option> : null}
      {speechExamples.map(([id, caption]) => <option key={id} value={id}>{id}{caption ? ` · ${caption}` : ''}</option>)}
    </select>
    <small className="helper">Väljer ett labbexempel. Registrerad video spelas om den finns för exakt replik. Saknas den visas ingen film.</small>
  </label>;
}
