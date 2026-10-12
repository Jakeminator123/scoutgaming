'use client';

import { useEffect, useRef } from 'react';
import type { PlaybackReceipt } from './stage';
import {DealerVideoSurface} from './dealer-video-surface';

/** One mounted instance owns one file/play ID. Never share a render-time turn
 * ref between consecutive clips: an interrupted React render is not a new play. */
export function FileVideo({ url, name, playId, playing, blocked, onReceipt, onFailure, onEnd }: {
  url: string; name?: string; playId: number; playing: boolean; blocked: boolean;
  onReceipt: (receipt: PlaybackReceipt) => void; onFailure: () => void; onEnd: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const current = useRef({ mounted: false, blocked, live: false, started: false, terminal: false, epoch: 0, attempted: false });
  const callbacks = useRef({ onReceipt, onFailure, onEnd });
  useEffect(() => { callbacks.current = { onReceipt, onFailure, onEnd }; });
  useEffect(() => { current.current.mounted = true; return () => { current.current.mounted = false; current.current.live = false; }; }, []);

  function finish(element: HTMLVideoElement) {
    const run = current.current;
    if (!run.live || run.terminal || element !== video.current || !element.ended) return;
    run.terminal = true;
    callbacks.current.onReceipt({ playId, phase: 'completed', medium: 'video', currentTimeMs: Math.round(element.currentTime * 1000) });
    callbacks.current.onEnd();
  }
  function fail(reason: string) {
    const run = current.current;
    if (!run.live || run.terminal) return;
    run.terminal = true; video.current?.pause();
    callbacks.current.onReceipt({ playId, phase: 'fallback', medium: 'video', reason });
    callbacks.current.onFailure();
  }
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const run = current.current;
    const epoch = ++run.epoch;
    run.blocked = blocked;
    run.live = !blocked && playing;
    run.started = false; run.terminal = false;
    if (!run.live) { element.pause(); return; }
    run.attempted = true;
    const startedAt = performance.now();
    // The ended property is actual media evidence. Checking it also handles a
    // coalesced/missed ended callback; elapsed duration alone never completes a clip.
    const timer = window.setInterval(() => {
      if (run.epoch !== epoch || !run.live || run.terminal) return;
      if (element.ended) { finish(element); return; }
      const elapsed = performance.now() - startedAt;
      if (!run.started && elapsed > 6000) fail('Videon startade inte inom sex sekunder.');
      else if (elapsed > (Number.isFinite(element.duration) ? element.duration * 1000 : 120000) + 15000) fail('Videon gav inget avslut. Uppspelningen avbröts.');
    }, 250);
    void element.play().catch(() => { if (run.epoch === epoch) fail('Videon kunde inte startas.'); });
    return () => { run.epoch++; run.live = false; window.clearInterval(timer); element.pause(); };
  }, [playing, blocked]);
  return <DealerVideoSurface><video ref={video} src={url} controls={!blocked} preload="metadata" muted playsInline
    aria-label={`Labbklipp: ${name ?? 'video'}`}
    onPlaying={event => {
      const element = event.currentTarget, run = current.current;
      if (!run.mounted || run.blocked || element !== video.current || element.paused || element.ended) return;
      // Native controls can start a manual preview without an automatic queue.
      if (!run.live || run.terminal) { run.started = false; run.terminal = false; }
      run.live = true;
      run.attempted = true;
      if (run.started) return;
      run.started = true;
      callbacks.current.onReceipt({ playId, phase: 'started', medium: 'video', durationMs: Number.isFinite(element.duration) ? Math.round(element.duration * 1000) : undefined });
    }} onEnded={event => finish(event.currentTarget)} onTimeUpdate={event => { if (event.currentTarget.ended) finish(event.currentTarget); }}
    onError={() => {
      const run = current.current;
      if (!run.mounted || run.blocked) return;
      // Initial metadata loading can fail before play. A stopped run, however,
      // must never turn a delayed error into a new playback owner.
      if (!run.attempted) run.live = true;
      fail('Videon kunde inte läsas.');
    }} />
    <button type="button" disabled={blocked} aria-label="Spela eller pausa klippet" style={{position:'absolute',top:8,right:8,zIndex:2,maxWidth:'calc(100% - 16px)'}} onClick={()=>{
      const element=video.current,run=current.current,epoch=run.epoch;
      if(!element||!run.mounted||run.blocked||blocked)return;
      if(!element.paused){element.pause();return;}
      run.live=true;run.started=false;run.terminal=false;run.attempted=true;
      void element.play().catch(()=>{if(run.epoch===epoch)fail('Videon kunde inte startas.');});
    }}>Spela / pausa</button></DealerVideoSurface>;
}
