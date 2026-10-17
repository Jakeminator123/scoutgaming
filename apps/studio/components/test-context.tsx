'use client';
import type { TestContext } from './studio-types';
import styles from './event-test-panel.module.css';

export const neutralContext: TestContext = { chat: { signal: 'none' }, playerHistory: { returning: false, preferredLanguage: 'sv' }, session: { recentWins: 0, recentLosses: 0 }, temperament: { mood: 'calm' } };
export const contextPresets: { label: string; value: TestContext }[] = [
  { label: 'Neutral', value: neutralContext },
  { label: 'Återkommande spelare', value: { ...neutralContext, playerHistory: { ...neutralContext.playerHistory, returning: true } } },
  { label: 'Beröm i chatten', value: { ...neutralContext, chat: { signal: 'praise' }, temperament: { mood: 'warm' } } },
  { label: 'Två förluster', value: { ...neutralContext, session: { recentLosses: 2, recentWins: 0 } } },
];
export function TestContextPanel({ value, onChange }: { value: TestContext; onChange: (value: TestContext) => void }) {
  const selected = contextPresets.find(p => JSON.stringify(p.value) === JSON.stringify(value));
  return <fieldset className={styles.context}><legend>Välj testsituation · simulerad indata</legend>
    <div className={styles.presets} role="group" aria-label="Förvalda testsituationer">{contextPresets.map(preset => <button type="button" key={preset.label} aria-pressed={selected === preset} onClick={() => onChange(structuredClone(preset.value))}>{preset.label}</button>)}</div>
    <details className={styles.adjust}><summary>Justera testvärden<span>{selected?.label ?? 'Egna testvärden'} · {value.session.recentWins} vinster / {value.session.recentLosses} förluster</span></summary>
      <div className={styles.fields}><label className="field">Chattsignal<select value={value.chat.signal} onChange={event => onChange({ ...value, chat: { signal: event.target.value as TestContext['chat']['signal'] } })}><option value="none">Ingen särskild signal</option><option value="praise">Beröm</option><option value="inappropriate">Olämpligt språk</option></select></label><label className="field">Språk<select value={value.playerHistory.preferredLanguage} onChange={event => onChange({ ...value, playerHistory: { ...value.playerHistory, preferredLanguage: event.target.value as TestContext['playerHistory']['preferredLanguage'] } })}><option value="sv">Svenska</option><option value="en">Engelska</option><option value="de">Tyska</option></select></label><label className="field">Croupierns framtoning<select value={value.temperament.mood} onChange={event => onChange({ ...value, temperament: { mood: event.target.value as TestContext['temperament']['mood'] } })}><option value="calm">Lugn</option><option value="warm">Varm</option><option value="playful">Lekfull</option><option value="reserved">Återhållsam</option></select></label><label className="field">Avgjorda vinster<input type="number" min={0} max={100} value={value.session.recentWins} onChange={event => onChange({ ...value, session: { ...value.session, recentWins: Number(event.target.value) } })} /></label><label className="field">Avgjorda förluster<input type="number" min={0} max={100} value={value.session.recentLosses} onChange={event => onChange({ ...value, session: { ...value.session, recentLosses: Number(event.target.value) } })} /></label><label className="check-field returning-player"><input type="checkbox" checked={value.playerHistory.returning} onChange={event => onChange({ ...value, playerHistory: { ...value.playerHistory, returning: event.target.checked } })} /><span>Spelaren återkommer<small>Simulerad spelarhistorik</small></span></label></div>
    </details>
    <p className={styles.note}>Knapparna sätter simulerad kontext för variantvalet. De hämtar inga livesignaler och styr inte Astrid-chatten.</p>
  </fieldset>;
}
