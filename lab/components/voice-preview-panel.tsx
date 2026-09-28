'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceResult, VoiceStatus } from '../lib/voice-preview.mjs';
import { requestJson } from './studio-types';
import styles from './voice-preview-panel.module.css';

export function VoicePreviewPanel({ latestReply = '' }: { latestReply?: string }) {
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  const [phraseId, setPhraseId] = useState('welcome');
  const [customText, setCustomText] = useState('');
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);
  const generation = useRef<AbortController | null>(null);
  const bindAudio = useCallback((element: HTMLAudioElement | null) => {
    if (audioRef.current !== element) audioRef.current?.pause();
    audioRef.current = element;
  }, []);
  const text = mode === 'preset' ? status?.phrases.find(phrase => phrase.id === phraseId)?.text ?? '' : customText;
  const tooLong = text.length > 500;

  useEffect(() => {
    const request = new AbortController();
    void requestJson<VoiceStatus>('/api/voice', { signal: request.signal }).then(setStatus).catch(cause => {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : 'Röststatus kunde inte läsas.');
    });
    return () => { request.abort(); generation.current?.abort(); audioRef.current?.pause(); };
  }, []);

  function clearPlayback() { audioRef.current?.pause(); setResult(null); setError(''); }
  function changeMode(next: 'preset' | 'custom') { clearPlayback(); setMode(next); }
  function useReply() { clearPlayback(); setMode('custom'); setCustomText(latestReply); }

  async function generate() {
    if (!status?.configured || !text.trim() || tooLong || generation.current) return;
    clearPlayback();
    const controller = new AbortController();
    generation.current = controller;
    setBusy(true);
    try {
      const next = await requestJson<VoiceResult>('/api/voice', { method: 'POST', body: JSON.stringify({ text }), signal: controller.signal });
      if (!controller.signal.aborted) setResult(next);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Röstprovet misslyckades.');
    } finally {
      if (generation.current === controller) generation.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <section className={styles.panel} aria-labelledby="voice-preview-heading">
    <div className={styles.heading}><span className="eyebrow">FRISTÅENDE LJUDPROV</span><h2 id="voice-preview-heading">Prova rösten</h2><span className={styles.voice}>Victoria · Cartesia</span></div>
    <p>Lyssna på en kort text. Detta är inte spelarchatt, lipsync eller ljud till en dealerfilm.</p>
    <div className={styles.tabs} role="group" aria-label="Text till röstprovet"><button type="button" aria-pressed={mode === 'preset'} disabled={busy} onClick={() => changeMode('preset')}>Standardfras</button><button type="button" aria-pressed={mode === 'custom'} disabled={busy} onClick={() => changeMode('custom')}>Egen text / chattsvar</button></div>
    {mode === 'preset' ? <label className={styles.field}>Välj labbfras<select value={phraseId} disabled={busy || !status} onChange={event => { clearPlayback(); setPhraseId(event.target.value); }}>{status?.phrases.map(phrase => <option value={phrase.id} key={phrase.id}>{phrase.label}</option>)}</select></label> : <button className="text-button" type="button" onClick={useReply} disabled={!latestReply || busy}>Använd senaste OpenClaw-svaret som text</button>}
    <label className={styles.field}>Exakt text som skickas<textarea value={text} rows={3} readOnly={mode === 'preset'} disabled={busy} onChange={event => { clearPlayback(); setCustomText(event.target.value); }} aria-describedby="voice-preview-cost voice-preview-count" /></label>
    <div id="voice-preview-count" className={styles.count}>{text.length} / 500 tecken</div>
    {tooLong ? <p role="alert" className="inline-error">Texten är för lång. Korta den själv till högst 500 tecken; inget kapas automatiskt.</p> : null}
    <p className={styles.cost} id="voice-preview-cost">Knappen skickar texten till Cartesia och kan förbruka krediter. Samma text och röstinställningar återanvänder ett sparat lokalt ljudprov. Ingen automatisk generering eller omkörning.</p>
    <p className={styles.status}>{status?.message ?? 'Läser lokal konfiguration…'}</p>
    <button className="primary-button" type="button" onClick={() => void generate()} disabled={busy || !status?.configured || !text.trim() || tooLong}>{busy ? 'Genererar röstprov…' : 'Generera röstprov'}</button>
    {error ? <p className="inline-error" role="alert">{error}</p> : null}
    {result ? <div className={styles.result} aria-live="polite"><strong>{result.cached ? 'Återanvänt från lokal cache' : 'Nytt röstprov sparat lokalt'}</strong><audio ref={bindAudio} controls preload="metadata" src={result.audioUrl} aria-label={`Röstprov med ${result.voiceName}`} /><p>Tryck på play för att lyssna. Ljudet spelas inte upp automatiskt.</p></div> : null}
  </section>;
}
