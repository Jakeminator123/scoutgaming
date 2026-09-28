'use client';
import { labUrl } from "../lib/lab-url.mjs";
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import styles from './original-media-player.module.css';

export interface OriginalPlaybackReceipt {
  phase: 'started' | 'completed' | 'failed' | 'fallback'; medium: 'video';
  reason?: string; durationMs?: number; currentTimeMs?: number; sourcePath?: string; mediaId?: string; playId?: number;
}
export function OriginalMediaPlayer({ mediaId, playId, playing, event, onPlaybackEvent, onPlaybackEnd, onFailure }: {
  mediaId: string; playId: number; playing: boolean; event?: Record<string, unknown>;
  onPlaybackEvent?: (receipt: OriginalPlaybackReceipt) => void; onPlaybackEnd?: () => void; onFailure?: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [channel] = useState(() => crypto.randomUUID());
  const currentChannel = `${channel}:${mediaId}:${playId}`;
  const current = useRef(currentChannel); current.current = currentChannel;
  const ready = useRef('');
  const requested = useRef('');
  const phase = useRef<'ready' | 'started' | 'completed' | 'failed'>('ready');
  const shouldPlay = useRef(playing); shouldPlay.current = playing;
  const emit = useEffectEvent((receipt: OriginalPlaybackReceipt) => onPlaybackEvent?.(receipt));
  const end = useEffectEvent(() => onPlaybackEnd?.());
  const fail = useEffectEvent(() => onFailure?.());
  const sourceEvent = useRef(event); sourceEvent.current = event;

  useEffect(() => {
    ready.current = ''; requested.current = ''; phase.current = 'ready';
    const post = (command: 'play' | 'stop') => frame.current?.contentWindow?.postMessage({ type: 'croupier-original-control', channel: currentChannel, mediaId, command, event: sourceEvent.current }, window.location.origin);
    const receive = (message: MessageEvent) => {
      const data = message.data;
      if (current.current !== currentChannel || message.origin !== window.location.origin || message.source !== frame.current?.contentWindow || data?.type !== 'croupier-original-media' || data.channel !== currentChannel || data.mediaId !== mediaId) return;
      if (data.phase === 'ready') {
        ready.current = currentChannel;
        if (shouldPlay.current && requested.current !== currentChannel) { requested.current = currentChannel; post('play'); }
        return;
      }
      if (!shouldPlay.current || requested.current !== currentChannel || ['completed', 'failed'].includes(phase.current)) return;
      if (data.phase === 'started' && phase.current === 'ready') {
        phase.current = 'started'; emit({ phase: 'started', medium: 'video', mediaId, playId, sourcePath: data.sourcePath, durationMs: data.durationMs });
      } else if (data.phase === 'completed' && phase.current === 'started') {
        phase.current = 'completed'; emit({ phase: 'completed', medium: 'video', mediaId, playId, sourcePath: data.sourcePath, durationMs: data.durationMs }); end();
      } else if (data.phase === 'failed') {
        phase.current = 'failed'; emit({ phase: 'fallback', medium: 'video', mediaId, playId, reason: typeof data.reason === 'string' ? data.reason.slice(0, 240) : 'Originaluppspelningen misslyckades.' }); fail();
      }
    };
    window.addEventListener('message', receive);
    const timeout = window.setTimeout(() => {
      if (current.current !== currentChannel || !shouldPlay.current || phase.current !== 'ready') return;
      phase.current = 'failed'; post('stop'); emit({ phase: 'fallback', medium: 'video', mediaId, playId, reason: 'Originalspelaren startade inte i tid.' }); fail();
    }, 15000);
    return () => { window.clearTimeout(timeout); post('stop'); window.removeEventListener('message', receive); };
  }, [currentChannel, mediaId, playId]);
  useEffect(() => {
    if (!playing) {
      frame.current?.contentWindow?.postMessage({ type: 'croupier-original-control', channel: currentChannel, mediaId, command: 'stop' }, window.location.origin);
    } else if (ready.current === currentChannel && requested.current !== currentChannel) {
      requested.current = currentChannel;
      frame.current?.contentWindow?.postMessage({ type: 'croupier-original-control', channel: currentChannel, mediaId, command: 'play', event: sourceEvent.current }, window.location.origin);
    }
  }, [playing, currentChannel, mediaId]);
  return <div className={styles.preview}><iframe ref={frame} key={currentChannel} title="Lokalt originalförval · samma mediespelare" src={labUrl(`/api/original-media/player?id=${encodeURIComponent(mediaId)}&channel=${encodeURIComponent(currentChannel)}`)} allow="autoplay" referrerPolicy="no-referrer" /><span>Lokalt originalförval · ej ny visuell acceptans</span></div>;
}
