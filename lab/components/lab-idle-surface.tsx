'use client';

import { useEffect, useRef } from 'react';

export interface IdleSurfaceReceipt { phase: 'started' | 'presented' | 'completed' | 'failed' | 'cancelled'; videoId: string; kind: 'base' | 'variant'; reason?: string }
/** A variant can report its lifecycle, but never a standard-position proof. */
export function LabIdleSurface({ url, videoId, kind = 'base', repeat = true, standardBase = true, onReady, onReceipt }: {
  url: string; videoId: string; kind?: 'base' | 'variant'; repeat?: boolean; standardBase?: boolean;
  onReady: (ready: boolean) => void; onReceipt?: (receipt: IdleSurfaceReceipt) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const callback = useRef({ onReady, onReceipt });
  useEffect(() => { callback.current = { onReady, onReceipt }; });
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    let live = true, frame: number | null = null, started = false, presented = false, terminal = false;
    const emit = (phase: IdleSurfaceReceipt['phase'], reason?: string) => callback.current.onReceipt?.({ phase, videoId, kind, ...(reason ? { reason } : {}) });
    const start = () => {
      if (!live || terminal || element.paused || element.readyState < 2) return;
      if (!started) { started = true; emit('started'); }
      if (!presented && frame === null && typeof element.requestVideoFrameCallback === 'function') frame = element.requestVideoFrameCallback(() => {
        frame = null;
        if (!live || terminal || element.paused || element.readyState < 2) return;
        presented = true; emit('presented');
        if (kind === 'base' && standardBase) callback.current.onReady(true);
      });
    };
    const fail = () => { if (!live || terminal) return; terminal = true; callback.current.onReady(false); emit('failed', 'Idleklippet kunde inte spelas.'); };
    const ended = () => { if (!live || terminal || repeat || !started || !element.ended) return; terminal = true; callback.current.onReady(false); emit('completed'); };
    callback.current.onReady(false);
    element.addEventListener('playing', start); element.addEventListener('ended', ended); element.addEventListener('error', fail);
    void element.play().then(start).catch(fail);
    return () => {
      live = false; if (frame !== null) element.cancelVideoFrameCallback(frame);
      element.removeEventListener('playing', start); element.removeEventListener('ended', ended); element.removeEventListener('error', fail);
      element.pause(); callback.current.onReady(false); if (started && !terminal) emit('cancelled');
    };
  }, [url, videoId, kind, repeat, standardBase]);
  return <div className="stage-video" style={{ position: 'relative' }}>
    <video ref={video} src={url} loop={repeat} muted playsInline preload="auto" aria-label={kind === 'variant' ? 'Labbets automatiska idlevariant' : standardBase ? 'Labbets standardposition' : 'Labbets alternativa basloop'} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    <span style={{ position: 'absolute', top: 8, left: 8, color: '#ddd', background: '#102020cc', padding: '4px 8px', fontSize: 11 }}>{kind === 'variant' ? 'Idlevariant · inte en talposition' : repeat ? 'Standardposition · väntar på svar' : 'Basloop · enligt sparad idlepolicy'}</span>
  </div>;
}
