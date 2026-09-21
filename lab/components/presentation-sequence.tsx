'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PresentationSequenceData, PresentationStep } from '../lib/presentation-sequence.mjs';
import styles from './presentation-sequence.module.css';

export interface PresentationSequenceProps {
  sequence: PresentationSequenceData;
  selectedId?: string | null;
  onSelect: (step: PresentationStep) => void;
  onPlay?: (step: PresentationStep, options: { signal: AbortSignal; mode: 'replay' }) => Promise<void>;
  onOpenEvent?: (eventId: string, step: PresentationStep) => void;
  busy?: boolean;
  children?: ReactNode;
}

// Playback completion belongs to Stage/the caller. Never estimate an event's
// duration or start a later clip while the current recorded speech still runs.
export function PresentationSequence({ sequence, selectedId, onSelect, onPlay, onOpenEvent, busy = false, children }: PresentationSequenceProps) {
  const [localId, setLocalId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const activeRun = useRef<AbortController | null>(null);
  const callbacks = useRef({ onSelect, onPlay });
  callbacks.current = { onSelect, onPlay };
  const requestedId = selectedId ?? localId;
  const index = Math.max(0, sequence.steps.findIndex(step => step.id === requestedId));
  const selected = sequence.steps[index];

  useEffect(() => () => { activeRun.current?.abort(); }, []);
  useEffect(() => { if (!sequence.steps.length) activeRun.current?.abort(); }, [sequence.steps.length]);

  function select(step: PresentationStep) {
    setLocalId(step.id); callbacks.current.onSelect(step);
  }
  function stop() { activeRun.current?.abort(); }
  async function play(all: boolean) {
    if (!selected || !callbacks.current.onPlay || playing || busy) return;
    const controller = new AbortController(); activeRun.current = controller;
    // A snapshot ends at the last instruction currently received. Later live
    // events never start an unrequested continuation of this explicit replay.
    const steps = all ? sequence.steps.slice(index) : [selected];
    setPlaying(true); setError('');
    try {
      for (const step of steps) {
        if (controller.signal.aborted) break;
        if (step.blocked || !step.eventId) throw new Error(step.issue || 'Steget har ingen spelbar labblinje.');
        select(step);
        const playback = callbacks.current.onPlay?.(step, { signal: controller.signal, mode: 'replay' });
        if (!playback) break;
        await new Promise<void>((resolve, reject) => {
          const abort = () => resolve();
          controller.signal.addEventListener('abort', abort, { once: true });
          Promise.resolve(playback).then(resolve, reject).finally(() => controller.signal.removeEventListener('abort', abort));
        });
      }
    } catch (problem) {
      if (!controller.signal.aborted) setError(problem instanceof Error ? problem.message : 'Återspelningen avbröts.');
    } finally {
      if (activeRun.current === controller) { activeRun.current = null; setPlaying(false); }
    }
  }

  return <section className={styles.panel} aria-label="Mottagen spelsekvens">
    <header className={styles.header}><div><h3>Spelsekvens</h3><p>{sequence.steps.length} instruktioner · {sequence.batchCount} kommandosvar{sequence.duplicates ? ` · ${sequence.duplicates} dubbla mottagningar hopslagna` : ''}</p></div><span className={styles.badge}>{sequence.steps.some(step => step.replay) ? 'Importerad observation' : 'Mottagna instruktioner'}</span></header>
    {!selected ? <p className={styles.note}>Inga spelinstruktioner har mottagits. En ansluten ström utan rundtrafik ger ingen sekvens. Spela i referensspelet eller läs in en observation med presentationsdata.</p> : <>
      <ol className={styles.steps} aria-label="Presentationsinstruktioner i mottagen ordning">{sequence.steps.map((step, position) => <li key={step.id}><button type="button" aria-current={step.id === selected.id ? 'step' : undefined} disabled={playing || busy} data-blocked={step.blocked} onClick={() => select(step)} title={step.label}><span>{position + 1}</span>{step.eventLabel || 'Omappad signal'}{step.blocked ? ' !' : ''}</button></li>)}</ol>
      <div className={styles.selection}>
        <p className={styles.stepLabel}><strong>Steg {index + 1}/{sequence.steps.length}</strong> · {selected.label}</p>
        <p className={styles.note}>{selected.eventId ? `Redigeringsgrupp: ${selected.eventLabel} (${selected.eventId}).` : 'Ingen befintlig redigeringsgrupp matchar.'} Kort, hand och exakt replik behålls från instruktionen.</p>
        <div className={styles.controls}>
          <button type="button" className="text-button" disabled={!index || playing || busy} onClick={() => select(sequence.steps[index - 1])}>← Föregående</button>
          <button type="button" className="text-button" disabled={index >= sequence.steps.length - 1 || playing || busy} onClick={() => select(sequence.steps[index + 1])}>Nästa →</button>
          {onPlay ? <><button type="button" className="primary-button" disabled={selected.blocked || playing || busy} onClick={() => void play(false)}>Spela steget i labbet</button><button type="button" className="text-button" disabled={!playing && (selected.blocked || busy)} onClick={() => playing ? stop() : void play(true)}>{playing ? 'Stoppa återspelning' : 'Spela från detta steg'}</button></> : null}
          {onOpenEvent && selected.eventId ? <button type="button" className="text-button" disabled={playing || busy} onClick={() => onOpenEvent(selected.eventId!, selected)}>Öppna linjen →</button> : null}
        </div>
        {selected.issue ? <p className={styles.warning} role="status">{selected.issue}</p> : null}
        {selected.uncertainty.length ? <p className={styles.warning}>{selected.uncertainty.join(' ')}</p> : null}
        {error ? <p className={styles.warning} role="alert">{error}</p> : null}
        <p className={styles.note} aria-live="polite">{playing ? 'Återspelar mottagna instruktioner i labbet. Varje steg väntar på spelarens avslut.' : 'Labbåterspelning använder mottagna instruktioner. Originalspelarens klippval, bildrutor och tidpunkter är inte verifierade av denna lista.'}</p>
        {children}
        <details className={styles.details}><summary>Indata och ursprung för steg {index + 1}</summary><pre>{JSON.stringify({ requestId: selected.requestId, version: selected.version, presentationIndex: selected.presentationIndex, source: selected.source, receivedAt: selected.receivedAt, op: selected.op, phase: selected.phase, replay: selected.replay, evidence: selected.evidence, actualPlaybackCaptured: selected.actualPlaybackCaptured, candidateEventIds: selected.candidateEventIds, deliveries: selected.deliveries, event: selected.event }, null, 2)}</pre></details>
      </div>
    </>}
    {sequence.notices.length ? <details className={styles.details}><summary>Anslutning och luckor ({sequence.notices.length})</summary><ul>{sequence.notices.map((notice, position) => <li key={position}>{notice.message}</li>)}</ul></details> : null}
    {sequence.truncated ? <p className={styles.warning}>Visningen är begränsad. Sekvensen visar inte hela observationen.</p> : null}
  </section>;
}
